'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useSchemaStore } from '@/lib/schema-store';
import { ObjectDef, generateId, generateApiName, createDefaultPageLayout, createDefaultRecordType, SYSTEM_FIELDS } from '@/lib/schema';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Toast } from '@/components/ui/toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search,
  Plus, 
  Settings, 
  Download, 
  Upload,
  Trash2,
  Copy,
  MoreVertical,
  Database,
  FileText,
  Calendar,
  Users,
  Lock
} from 'lucide-react';

// Core objects that cannot be deleted
const CORE_OBJECTS = new Set([
  'Property',
  'Contact',
  'Account',
  'Product',
  'Lead',
  'Deal',
  'Project',
  'Service',
  'Quote',
  'Installation',
  'Home',
]);

export default function ObjectManagerPage() {
  const router = useRouter();
  const { 
    schema, 
    loading, 
    error,
    loadSchema, 
    createObject, 
    deleteObject,
    exportSchema,
    importSchema,
    resetSchema,
    clearError 
  } = useSchemaStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    label: '',
    apiName: '',
    description: ''
  });
  const [importData, setImportData] = useState('');

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  const filteredObjects = schema?.objects.filter(obj =>
    obj.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.apiName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleCreateObject = async () => {
    if (!createForm.label.trim()) return;

    try {
      const apiName = createForm.apiName || generateApiName(createForm.label);
      
      // Create default page layout and record type
      const defaultLayout = createDefaultPageLayout(apiName);
      const defaultRecordType = createDefaultRecordType(apiName, defaultLayout.id);

      const newObject: Omit<ObjectDef, 'id' | 'createdAt' | 'updatedAt'> = {
        apiName,
        label: createForm.label,
        fields: [...SYSTEM_FIELDS],
        recordTypes: [defaultRecordType],
        pageLayouts: [defaultLayout],
        validationRules: [],
        defaultRecordTypeId: defaultRecordType.id
      };

      const objectId = await createObject(newObject);
      setShowCreateDialog(false);
      setCreateForm({ label: '', apiName: '', description: '' });
      
      // Navigate to the new object's records list page (like properties)
      router.push(`/objects/${apiName}`);
    } catch (err) {
      console.error('Failed to create object:', err);
    }
  };

  const handleDeleteObject = async (objectApi: string) => {
    if (confirm(`Are you sure you want to delete the ${objectApi} object? This action cannot be undone.`)) {
      try {
        await deleteObject(objectApi);
        
        // Remove object from navigation tabs
        const savedTabsStr = localStorage.getItem('tabConfiguration');
        if (savedTabsStr) {
          try {
            const savedTabs = JSON.parse(savedTabsStr);
            // Filter out tabs that match this object (both /objects/slug and direct routes)
            const updatedTabs = savedTabs.filter((tab: { name: string; href: string }) => {
              const lowerApiName = objectApi.toLowerCase();
              return tab.href !== `/objects/${lowerApiName}` && 
                     tab.href !== `/${lowerApiName}`;
            });
            localStorage.setItem('tabConfiguration', JSON.stringify(updatedTabs));
          } catch (e) {
            console.error('Error updating tab configuration:', e);
          }
        }
        
        // Remove custom records storage for this object
        localStorage.removeItem(`custom_records_${objectApi.toLowerCase()}`);
        localStorage.removeItem(`${objectApi.toLowerCase()}VisibleColumns`);
        localStorage.removeItem(`${objectApi.toLowerCase()}SelectedLayoutId`);
        
      } catch (err) {
        console.error('Failed to delete object:', err);
      }
    }
  };

  const handleExportObject = (objectApi: string) => {
    const jsonData = exportSchema(objectApi);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${objectApi}_schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportAll = () => {
    const jsonData = exportSchema();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tces_schema.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSchema = async () => {
    if (!importData.trim()) return;

    try {
      await importSchema(importData, true); // merge with existing
      setShowImportDialog(false);
      setImportData('');
    } catch (err) {
      console.error('Failed to import schema:', err);
    }
  };

  const handleResetSchema = async () => {
    if (!confirm('Are you sure? This will clear the cache and reload the schema with all new fields. Any unsaved changes will be lost.')) {
      return;
    }

    try {
      await resetSchema();
    } catch (err) {
      console.error('Failed to reset schema:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="h-8 w-8 animate-spin mx-auto mb-4 text-indigo-600" />
          <p className="text-gray-600">Loading Object Manager...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#9f9fa2] shadow border-b border-black">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center">
                <Image
                  src="/tces-logo.png"
                  alt="TCES"
                  width={32}
                  height={32}
                  priority
                />
              </Link>
              <span className="text-gray-300">|</span>
              <span className="text-2xl font-bold text-gray-900">Object Manager</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={handleExportAll}>
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
              <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Import Schema
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Import Schema</DialogTitle>
                    <DialogDescription>
                      Paste your JSON schema data below. This will be merged with your existing objects.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Textarea
                      value={importData}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportData(e.target.value)}
                      placeholder="Paste JSON schema data here..."
                      rows={12}
                      className="font-mono text-sm"
                    />
                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleImportSchema} disabled={!importData.trim()}>
                        Import
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Objects</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schema?.objects.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {schema?.objects.reduce((total, obj) => total + obj.fields.length, 0) || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Schema Version</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schema?.version || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Permission Sets</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{schema?.permissionSets.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <div className="flex justify-between items-center mb-6">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-gray-400 transform -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search objects..."
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Object
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Object</DialogTitle>
                <DialogDescription>
                  Create a new custom object to store your organization's data.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="label">Object Label</Label>
                  <Input
                    id="label"
                    value={createForm.label}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const label = e.target.value;
                      setCreateForm({
                        ...createForm,
                        label,
                        apiName: generateApiName(label)
                      });
                    }}
                    placeholder="e.g., Custom Opportunity"
                  />
                </div>
                <div>
                  <Label htmlFor="apiName">API Name</Label>
                  <Input
                    id="apiName"
                    value={createForm.apiName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateForm({...createForm, apiName: e.target.value})}
                    placeholder="e.g., Custom_Opportunity"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={createForm.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCreateForm({...createForm, description: e.target.value})}
                    placeholder="Describe what this object is used for..."
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateObject} disabled={!createForm.label.trim()}>
                    Create Object
                  </Button>
                </div>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Objects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Objects</CardTitle>
            <CardDescription>
              Manage your custom objects and their configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>API Name</TableHead>
                  <TableHead>Fields</TableHead>
                  <TableHead>Record Types</TableHead>
                  <TableHead>Validation Rules</TableHead>
                  <TableHead>Last Modified</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredObjects.map((object) => (
                  <TableRow key={object.id} className="group">
                    <TableCell className="font-medium">
                      <Link
                        href={`/object-manager/${object.apiName}`}
                        className="text-indigo-600 hover:text-indigo-800"
                      >
                        {object.label}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-gray-600">
                      {object.apiName}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {object.fields.length}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {object.recordTypes.length}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">
                      {object.validationRules.length}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {new Date(object.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/object-manager/${object.apiName}`)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExportObject(object.apiName)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Export JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              // Clone object logic would go here
                              console.log('Clone object:', object.apiName);
                            }}
                          >
                            <Copy className="h-4 w-4 mr-2" />
                            Clone
                          </DropdownMenuItem>
                          {CORE_OBJECTS.has(object.apiName) ? (
                            <div className="flex items-center px-2 py-1.5 text-sm text-gray-400 bg-gray-50">
                              <Lock className="h-4 w-4 mr-2" />
                              Cannot delete - contact admin
                            </div>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleDeleteObject(object.apiName)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredObjects.length === 0 && (
              <div className="text-center py-12">
                <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No objects found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'No objects match your search criteria.' : 'Get started by creating your first custom object.'}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Object
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {error && (
          <div className="mt-4">
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl">
              <div className="flex justify-between">
                <span>{error}</span>
                <button onClick={clearError} className="text-red-600 hover:text-red-800">
                  ×
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}