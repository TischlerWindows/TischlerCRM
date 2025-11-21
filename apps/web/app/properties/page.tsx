'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPin, 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2,
  Building2,
  Users,
  Calendar,
  FolderOpen,
  AlertCircle,
  Layout
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';

interface Property {
  id: string;
  propertyNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  status: 'Active' | 'Inactive';
  contacts: string[];
  accounts: string[];
  lastActivity: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  sharepointFolder?: string;
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ 
    address: '',
    city: '',
    state: '',
    zipCode: '',
    status: 'Active' as 'Active' | 'Inactive'
  });
  const router = useRouter();
  const { schema } = useSchemaStore();
  
  // Check if Property object exists with page layouts
  const propertyObject = schema?.objects.find(obj => obj.apiName === 'Property');
  const createLayouts = propertyObject?.pageLayouts?.filter(l => l.layoutType === 'create') || [];
  const hasCreateLayout = createLayouts.length > 0;

  // Debug logging
  useEffect(() => {
    console.log('🔍 Property Object:', propertyObject);
    console.log('📋 All Page Layouts:', propertyObject?.pageLayouts);
    console.log('✨ Create Layouts:', createLayouts);
    console.log('✅ Has Create Layout:', hasCreateLayout);
  }, [propertyObject, createLayouts, hasCreateLayout]);

  useEffect(() => {
    // Mock data - replace with actual API call
    setProperties([
      {
        id: '1',
        propertyNumber: 'P-001',
        address: '123 Main Street',
        city: 'Toronto',
        state: 'ON',
        zipCode: 'M5V 3A3',
        status: 'Active',
        contacts: ['John Smith', 'Mary Johnson'],
        accounts: ['ABC Corporation'],
        lastActivity: '2024-11-10',
        createdBy: 'Development User',
        createdAt: '2024-01-15',
        lastModifiedBy: 'Development User',
        lastModifiedAt: '2024-11-10',
        sharepointFolder: 'P-001'
      },
      {
        id: '2',
        propertyNumber: 'P-002',
        address: '456 Oak Avenue',
        city: 'Mississauga',
        state: 'ON',
        zipCode: 'L5B 2K5',
        status: 'Active',
        contacts: ['Sarah Williams'],
        accounts: ['XYZ Enterprises'],
        lastActivity: '2024-11-12',
        createdBy: 'Development User',
        createdAt: '2024-02-20',
        lastModifiedBy: 'Development User',
        lastModifiedAt: '2024-11-12',
        sharepointFolder: 'P-002'
      },
      {
        id: '3',
        propertyNumber: 'P-003',
        address: '789 Pine Road',
        city: 'Brampton',
        state: 'ON',
        zipCode: 'L6Y 1M4',
        status: 'Inactive',
        contacts: [],
        accounts: [],
        lastActivity: '2024-03-15',
        createdBy: 'Development User',
        createdAt: '2024-01-10',
        lastModifiedBy: 'System',
        lastModifiedAt: '2024-11-10',
        sharepointFolder: 'P-003'
      }
    ]);
    setLoading(false);
  }, []);

  const filteredProperties = properties.filter(property =>
    property.propertyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    property.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    property.city.toLowerCase().includes(searchTerm.toLowerCase())
  );



  const handleDynamicFormSubmit = (data: Record<string, any>) => {
    // Generate next property number
    const nextNumber = properties.length + 1;
    const propertyNumber = `P-${String(nextNumber).padStart(3, '0')}`;
    
    const today = new Date().toISOString().split('T')[0];
    
    const newProperty: Property = {
      id: String(Date.now()),
      propertyNumber,
      address: data.Property__address || '',
      city: data.Property__city || '',
      state: data.Property__state || '',
      zipCode: data.Property__zipCode || '',
      status: data.Property__status || 'Active',
      contacts: data.Property__contacts || [],
      accounts: data.Property__accounts || [],
      lastActivity: today || '',
      createdBy: 'Development User',
      createdAt: today || '',
      lastModifiedBy: 'Development User',
      lastModifiedAt: today || '',
      sharepointFolder: propertyNumber
    };

    setProperties([newProperty, ...properties]);
    console.log('Dynamic form submitted:', data);
  };

  const handleDeleteProperty = (id: string) => {
    if (confirm('Are you sure you want to delete this property?')) {
      setProperties(properties.filter(p => p.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading properties...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <Link href="/" className="text-xl font-bold text-indigo-600 hover:text-indigo-800 transition-colors">
                  TCES
                </Link>
                <span className="text-gray-300">|</span>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-8 h-8 text-indigo-600" />
                  Properties
                </h1>
              </div>
              <p className="text-gray-600 mt-1">Manage property records and locations</p>
            </div>
            <button
              onClick={() => {
                if (!hasCreateLayout) {
                  setShowNoLayoutsDialog(true);
                } else if (createLayouts.length === 1 && createLayouts[0]) {
                  setSelectedLayoutId(createLayouts[0].id);
                  setShowDynamicForm(true);
                } else {
                  setShowLayoutSelector(true);
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Property
            </button>
          </div>

          {/* Info Banner */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3" />
              <div className="text-sm text-blue-800">
                <p className="font-semibold mb-1">About Properties</p>
                <p>Properties are automatically marked as <strong>Inactive</strong> after 8 months of no activity or when a project is completed. All documentation is filed under the unique Property Number in SharePoint.</p>
                {hasCreateLayout ? (
                  <p className="mt-2">
                    <strong>✨ Using Dynamic Forms:</strong> This page uses {createLayouts.length} {createLayouts.length === 1 ? 'layout' : 'layouts'} configured in Object Manager.
                    {createLayouts.length > 1 && ' Click "New Property" to choose which layout to use.'}
                  </p>
                ) : (
                  <p className="mt-2 text-amber-700">
                    <strong>⚠️ No Create Page Layout Found:</strong> Using legacy form. <Link href="/object-manager/Property" className="underline font-medium">Go to Object Manager → Property → Page Editor</Link> and create a new page layout with "Mode: New" to enable dynamic forms with custom fields and sections.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search properties by number, address, or city..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Properties Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <div
              key={property.id}
              className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <Link
                      href={`/properties/${property.id}`}
                      className="text-lg font-bold text-indigo-600 hover:text-indigo-800"
                    >
                      {property.propertyNumber}
                    </Link>
                    <div className="mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        property.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {property.status}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button className="p-1 hover:bg-gray-100 rounded">
                      <MoreVertical className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Address Section */}
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <em><strong>Address</strong></em>
                  </h3>
                  <p className="text-sm text-gray-900 font-medium">{property.address}</p>
                  <p className="text-sm text-gray-600">
                    {property.city}, {property.state} {property.zipCode}
                  </p>
                </div>

                {/* Contact Information */}
                <div className="mb-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <em><strong>Contact Information</strong></em>
                  </h3>
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Users className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        {property.contacts.length > 0 
                          ? property.contacts.join(', ')
                          : 'No contacts'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <Building2 className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-gray-600">
                        {property.accounts.length > 0 
                          ? property.accounts.join(', ')
                          : 'No accounts'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Files/Storage */}
                {property.sharepointFolder && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      <em><strong>Files/Storage</strong></em>
                    </h3>
                    <div className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 cursor-pointer">
                      <FolderOpen className="w-4 h-4 mr-2" />
                      <span>SharePoint: {property.sharepointFolder}</span>
                    </div>
                  </div>
                )}

                {/* System Information */}
                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <em><strong>System Information</strong></em>
                  </h3>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-2" />
                      <span>Last Activity: {property.lastActivity}</span>
                    </div>
                    <p><em><strong>Created By:</strong></em> {property.createdBy} on {property.createdAt}</p>
                    <p><em><strong>Last Modified:</strong></em> {property.lastModifiedBy} on {property.lastModifiedAt}</p>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 flex gap-2">
                <button
                  onClick={() => router.push(`/properties/${property.id}`)}
                  className="flex-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                >
                  View Details
                </button>
                <button
                  onClick={() => handleDeleteProperty(property.id)}
                  className="text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-12">
            <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No properties found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first property.'}
            </p>
          </div>
        )}
      </div>

      {/* No Page Layouts Dialog */}
      {showNoLayoutsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">No Page Layouts Created</h2>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="mb-3">
                    To create new properties, you need to configure a page layout in the Page Editor first.
                  </p>
                  <p className="font-medium text-gray-900">
                    This allows you to:
                  </p>
                  <ul className="list-disc list-inside mt-2 space-y-1 text-gray-600">
                    <li>Customize which fields appear</li>
                    <li>Organize fields into sections</li>
                    <li>Create multiple layout options</li>
                    <li>Control field validation</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNoLayoutsDialog(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <Link
                href="/object-manager/Property"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                onClick={() => setShowNoLayoutsDialog(false)}
              >
                <Layout className="w-4 h-4 mr-2" />
                Go to Page Editor
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Layout Selector Dialog */}
      {showLayoutSelector && createLayouts.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Select a Layout</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose which form layout to use for creating a new property
              </p>
            </div>
            <div className="p-6 space-y-3">
              {createLayouts.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => {
                    setSelectedLayoutId(layout.id);
                    setShowLayoutSelector(false);
                    setShowDynamicForm(true);
                  }}
                  className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{layout.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {layout.tabs.length} {layout.tabs.length === 1 ? 'tab' : 'tabs'} • {' '}
                      {layout.tabs.reduce((acc, tab) => acc + tab.sections.length, 0)} sections
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowLayoutSelector(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Form Dialog */}
      {hasCreateLayout && selectedLayoutId && (
        <DynamicFormDialog
          open={showDynamicForm}
          onOpenChange={(open) => {
            setShowDynamicForm(open);
            if (!open) setSelectedLayoutId(null);
          }}
          objectApiName="Property"
          layoutType="create"
          layoutId={selectedLayoutId}
          onSubmit={handleDynamicFormSubmit}
          title="New Property"
        />
      )}
    </div>
  );
}
