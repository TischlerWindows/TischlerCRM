'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Lightbulb, 
  Plus, 
  Search, 
  MoreVertical,
  Edit,
  Trash2,
  AlertCircle,
  Layout,
  Settings,
  X,
  Clock,
  User,
  List,
  Star,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Cog,
  Edit3,
  GripVertical
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import { cn } from '@/lib/utils';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';

interface Lead {
  id: string;
  leadNumber: string;
  contactName: string;
  propertyAddress: string;
  source: string;
  stage: string;
  assignedTo: string;
  estimatedValue: number;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  notes?: string;
  isFavorite?: boolean;
}

const informationModules = [
  { name: 'Properties', href: '/properties' },
  { name: 'Contacts', href: '/contacts' },
  { name: 'Accounts', href: '/accounts' },
  { name: 'Products', href: '/products' },
];

const pipelineModules = [
  { name: 'Leads', href: '/leads' },
  { name: 'Deals', href: '/deals' },
  { name: 'Projects', href: '/projects' },
  { name: 'Service', href: '/service' },
];

const financialModules = [
  { name: 'Quotes', href: '/quotes' },
  { name: 'Installations', href: '/installations' },
];

const analyticsModules = [
  { name: 'Dashboards', href: '/dashboard' },
  { name: 'Reports', href: '/reports' },
];

const defaultTabs = DEFAULT_TAB_ORDER;

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { schema } = useSchemaStore();
  
  // Check if Lead object exists with page layouts
  const leadObject = schema?.objects.find(obj => obj.apiName === 'Lead');
  const pageLayouts = leadObject?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  // Dynamically generate available columns from schema
  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!leadObject?.fields) {
      // Fallback to hard-coded columns if schema not loaded
      return [
        { id: 'leadNumber', label: 'Lead #', defaultVisible: true },
        { id: 'contactName', label: 'Contact', defaultVisible: true },
        { id: 'propertyAddress', label: 'Property Address', defaultVisible: true },
        { id: 'source', label: 'Source', defaultVisible: true },
        { id: 'stage', label: 'Stage', defaultVisible: true },
        { id: 'estimatedValue', label: 'Est. Value', defaultVisible: true },
        { id: 'assignedTo', label: 'Assigned To', defaultVisible: true },
        { id: 'notes', label: 'Notes', defaultVisible: false },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created Date', defaultVisible: false },
        { id: 'lastModifiedBy', label: 'Last Modified By', defaultVisible: false },
        { id: 'lastModifiedAt', label: 'Modified Date', defaultVisible: false }
      ];
    }

    // Generate columns from schema fields
    return leadObject.fields.map((field, index) => {
      // Strip the Lead__ prefix for display
      const cleanApiName = field.apiName.replace('Lead__', '');
      
      // Determine if field should be visible by default (first 10 non-system fields)
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 10;
      
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible
      };
    });
  }, [leadObject]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Lead Object:', leadObject);
    console.log('📋 Page Layouts:', pageLayouts);
    console.log('✅ Has Page Layout:', hasPageLayout);
  }, [leadObject, pageLayouts, hasPageLayout]);
  
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);

  useEffect(() => {
    const savedTabsStr = localStorage.getItem('tabConfiguration');

    if (savedTabsStr) {
      try {
        const savedTabs = JSON.parse(savedTabsStr);
        setTabs(savedTabs);
      } catch (e) {
        console.error('Error loading tab configuration:', e);
        setTabs(defaultTabs);
      }
    } else {
      setTabs(defaultTabs);
    }
    
    const storedObjects = localStorage.getItem('customObjects');
    if (storedObjects) {
      try {
        const objects = JSON.parse(storedObjects);
        const objectTabs = objects.map((obj: any) => ({
          name: obj.label,
          href: `/${obj.apiName.toLowerCase()}`
        }));
        setAvailableObjects(objectTabs);
      } catch (e) {
        console.error('Error loading custom objects:', e);
      }
    }
    
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // Load visible columns from localStorage or use defaults
    const storedColumns = localStorage.getItem('leadsVisibleColumns');
    if (storedColumns) {
      setVisibleColumns(JSON.parse(storedColumns));
    } else {
      const defaultColumns = AVAILABLE_COLUMNS
        .filter(col => col.defaultVisible)
        .map(col => col.id);
      setVisibleColumns(defaultColumns);
    }

    // Load leads from localStorage or use mock data
    const storedLeads = localStorage.getItem('leads');
    if (storedLeads) {
      setLeads(JSON.parse(storedLeads));
    } else {
      // Initial mock data
      const mockData = [
        {
          id: '1',
          leadNumber: 'LEAD-001',
          contactName: 'John Smith',
          propertyAddress: '123 Main Street, Springfield',
          source: 'Website',
          stage: 'Qualified',
          assignedTo: 'Sarah Johnson',
          estimatedValue: 15000,
          createdBy: 'Development User',
          createdAt: '2024-11-10',
          lastModifiedBy: 'Development User',
          lastModifiedAt: '2024-11-20',
          notes: 'Interested in window replacement for entire home'
        },
        {
          id: '2',
          leadNumber: 'LEAD-002',
          contactName: 'Maria Garcia',
          propertyAddress: '456 Oak Avenue, Riverside',
          source: 'Referral',
          stage: 'Initial Contact',
          assignedTo: 'Mike Wilson',
          estimatedValue: 8500,
          createdBy: 'Development User',
          createdAt: '2024-11-11',
          lastModifiedBy: 'Development User',
          lastModifiedAt: '2024-11-11'
        },
        {
          id: '3',
          leadNumber: 'LEAD-003',
          contactName: 'Robert Chen',
          propertyAddress: '789 Pine Road, Lakeside',
          source: 'Cold Call',
          stage: 'Needs Assessment',
          assignedTo: 'Sarah Johnson',
          estimatedValue: 22000,
          createdBy: 'Development User',
          createdAt: '2024-11-15',
          lastModifiedBy: 'Development User',
          lastModifiedAt: '2024-11-28',
          notes: 'Looking for full door and window renovation'
        }
      ];
      setLeads(mockData);
      localStorage.setItem('leads', JSON.stringify(mockData));
    }
    setLoading(false);
  }, []);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.leadNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.propertyAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.stage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.source.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesSidebar = true;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    switch (sidebarFilter) {
      case 'recent':
        matchesSidebar = new Date(lead.lastModifiedAt) >= thirtyDaysAgo;
        break;
      case 'created-by-me':
        matchesSidebar = lead.createdBy === 'Development User';
        break;
      case 'favorites':
        matchesSidebar = (lead as any).isFavorite === true;
        break;
      case 'all':
      default:
        matchesSidebar = true;
    }
    
    return matchesSearch && matchesSidebar;
  }).sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = (a as any)[sortColumn];
    const bValue = (b as any)[sortColumn];
    
    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      const aStr = aValue.join(', ').toLowerCase();
      const bStr = bValue.join(', ').toLowerCase();
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    }
    
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
    
    if (sortColumn.includes('At')) {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    if (sortColumn === 'estimatedValue') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr, undefined, { numeric: true })
      : bStr.localeCompare(aStr, undefined, { numeric: true });
  });

  const toggleColumnVisibility = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('leadsVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  const handleColumnDragStart = (index: number) => {
    setDraggedColumnIndex(index);
  };

  const handleColumnDragOver = (index: number) => {
    if (draggedColumnIndex === null || draggedColumnIndex === index) return;

    const newColumns = [...visibleColumns];
    const draggedColumn = newColumns[draggedColumnIndex];
    if (!draggedColumn) return;
    newColumns.splice(draggedColumnIndex, 1);
    newColumns.splice(index, 0, draggedColumn);

    setVisibleColumns(newColumns);
    setDraggedColumnIndex(index);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnIndex(null);
    localStorage.setItem('leadsVisibleColumns', JSON.stringify(visibleColumns));
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      localStorage.setItem('leadsVisibleColumns', JSON.stringify(newVisibleColumns));
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('leadsVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    localStorage.setItem('leadsVisibleColumns', JSON.stringify(defaultColumns));
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (lead: Lead, columnId: string) => {
    const value = (lead as any)[columnId];
    
    if (value === null || value === undefined) {
      return '-';
    }
    
    if (typeof value === 'number' && columnId === 'estimatedValue') {
      return `$${value.toLocaleString()}`;
    }
    
    return String(value);
  };

  const handleDynamicFormSubmit = (data: Record<string, any>) => {
    // Generate unique lead number
    const existingNumbers = leads
      .map(l => l.leadNumber)
      .filter(num => num.startsWith('LEAD-'))
      .map(num => parseInt(num.replace('LEAD-', ''), 10))
      .filter(num => !isNaN(num));
    
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const nextNumber = maxNumber + 1;
    const leadNumber = `LEAD-${String(nextNumber).padStart(3, '0')}`;
    
    const today = new Date().toISOString().split('T')[0];
    
    const newLead: Lead = {
      id: String(Date.now()),
      leadNumber,
      contactName: data.contactName || '',
      propertyAddress: data.propertyAddress || '',
      source: data.source || 'Website',
      stage: data.stage || 'Initial Contact',
      assignedTo: data.assignedTo || '',
      estimatedValue: data.estimatedValue || 0,
      createdBy: 'Development User',
      createdAt: today || '',
      lastModifiedBy: 'Development User',
      lastModifiedAt: today || '',
      notes: data.notes || '',
      ...data
    };

    const updatedLeads = [newLead, ...leads];
    setLeads(updatedLeads);
    localStorage.setItem('leads', JSON.stringify(updatedLeads));
    console.log('Dynamic form submitted:', data);
  };

  const handleDeleteLead = (id: string) => {
    if (confirm('Are you sure you want to delete this lead?')) {
      const updatedLeads = leads.filter(l => l.id !== id);
      setLeads(updatedLeads);
      localStorage.setItem('leads', JSON.stringify(updatedLeads));
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedLeads = leads.map(l => 
      l.id === id ? { ...l, isFavorite: !l.isFavorite } : l
    );
    setLeads(updatedLeads);
    localStorage.setItem('leads', JSON.stringify(updatedLeads));
    setOpenDropdown(null);
  };

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    localStorage.setItem('tabConfiguration', JSON.stringify(newTabs));
  };

  const handleResetToDefault = () => {
    setTabs(defaultTabs);
    saveTabConfiguration(defaultTabs);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const newTabs = [...tabs];
    const draggedTab = newTabs[draggedIndex];
    if (!draggedTab) return;
    
    newTabs.splice(draggedIndex, 1);
    newTabs.splice(index, 0, draggedTab);
    
    setTabs(newTabs);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    saveTabConfiguration(tabs);
  };

  const handleAddTab = (tab: { name: string; href: string }) => {
    const newTabs = [...tabs, tab];
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
    setShowAddTab(false);
  };

  const handleRemoveTab = (index: number) => {
    const newTabs = tabs.filter((_, i) => i !== index);
    setTabs(newTabs);
    saveTabConfiguration(newTabs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <div className="pb-6 border-b border-gray-200 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Track and qualify potential opportunities</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Leads</h3>
            <nav className="space-y-1">
              <button
                onClick={() => setSidebarFilter('recent')}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'recent'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Clock className="w-4 h-4 mr-3" />
                Recent
              </button>
              <button
                onClick={() => setSidebarFilter('created-by-me')}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'created-by-me'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <User className="w-4 h-4 mr-3" />
                Created by Me
              </button>
              <button
                onClick={() => setSidebarFilter('all')}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'all'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4 mr-3" />
                All Leads
              </button>
              <button
                onClick={() => setSidebarFilter('favorites')}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'favorites'
                    ? 'bg-indigo-50 text-indigo-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Star className="w-4 h-4 mr-3" />
                All Favorites
              </button>
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Lead Records</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>
            <button
              onClick={() => {
                if (!hasPageLayout) {
                  setShowNoLayoutsDialog(true);
                } else if (pageLayouts.length === 1 && pageLayouts[0]) {
                  setSelectedLayoutId(pageLayouts[0].id);
                  setShowDynamicForm(true);
                } else {
                  setShowLayoutSelector(true);
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Lead
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search leads by number, contact, address, stage, or source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Leads List */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {visibleColumns.map(columnId => {
                    const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                    if (!column) return null;
                    return (
                      <th 
                      key={column.id} 
                      className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort(column.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span>{column.label}</span>
                        {sortColumn === column.id && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                    );
                  })}
                  <th className="px-6 py-3"></th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    {visibleColumns.map(columnId => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                        {column.id === 'leadNumber' ? (
                          <Link href={`/leads/${lead.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                            {lead.leadNumber}
                          </Link>
                        ) : column.id === 'stage' ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            lead.stage === 'Ready for Deal' ? 'bg-green-100 text-green-800' :
                            lead.stage === 'Qualified' ? 'bg-blue-100 text-blue-800' :
                            lead.stage === 'Needs Assessment' ? 'bg-purple-100 text-purple-800' :
                            lead.stage === 'Lost' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lead.stage}
                          </span>
                        ) : (
                          formatColumnValue(lead, column.id)
                        )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === lead.id ? null : lead.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === lead.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                handleDeleteLead(lead.id);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleToggleFavorite(lead.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${lead.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredLeads.length === 0 && (
          <div className="text-center py-12">
            <Lightbulb className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first lead.'}
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
                    To create new leads, you need to configure a page layout in the Page Editor first.
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
                href="/object-manager/Lead"
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
      {showLayoutSelector && pageLayouts.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Select a Layout</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose which form layout to use for creating a new lead
              </p>
            </div>
            <div className="p-6 space-y-3">
              {pageLayouts.map((layout) => (
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
                    <Lightbulb className="w-5 h-5 text-indigo-600" />
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
      {hasPageLayout && selectedLayoutId && (
        <DynamicFormDialog
          open={showDynamicForm}
          onOpenChange={(open) => {
            setShowDynamicForm(open);
            if (!open) setSelectedLayoutId(null);
          }}
          objectApiName="Lead"
          layoutType="create"
          layoutId={selectedLayoutId}
          onSubmit={handleDynamicFormSubmit}
          title="New Lead"
        />
      )}

      {/* Column Filter Settings Dialog */}
      {showFilterSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Configure Columns</h2>
                <button
                  onClick={() => setShowFilterSettings(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Select which columns to display in the leads list
              </p>
            </div>
            
            <div className="p-6 max-h-96 overflow-y-auto">
              <div className="space-y-3">
                {AVAILABLE_COLUMNS.map((column) => (
                  <label
                    key={column.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={isColumnVisible(column.id)}
                      onChange={() => toggleColumnVisibility(column.id)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {column.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowFilterSettings(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
