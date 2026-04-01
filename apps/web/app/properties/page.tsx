'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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
  Layout,
  Filter,
  Settings,
  X,
  Clock,
  User,
  Star,
  List,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Cog,
  Edit3,
  GripVertical
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import { cn, formatFieldValue, resolveLookupDisplayName, inferLookupObjectType, evaluateFormulaForRecord } from '@/lib/utils';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { recordsService } from '@/lib/records-service';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';
import { getPropertyPrefix, generatePropertyNumber } from '@/lib/property-number';

interface Property {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  propertyNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country?: string;
  latitude?: string;
  longitude?: string;
  status: 'Active' | 'Inactive';
  contacts: string[];
  accounts: string[];
  lastActivity: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  sharepointFolder?: string;
  isFavorite?: boolean;
}

// Available columns that can be filtered
const AVAILABLE_COLUMNS = [
  { id: 'propertyNumber', label: 'Property #', defaultVisible: true },
  { id: 'address', label: 'Address', defaultVisible: true },
  { id: 'city', label: 'City', defaultVisible: true },
  { id: 'state', label: 'State', defaultVisible: true },
  { id: 'zipCode', label: 'Postal / Zip Code', defaultVisible: false },
  { id: 'country', label: 'Country', defaultVisible: false },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'contacts', label: 'Contacts', defaultVisible: false },
  { id: 'accounts', label: 'Accounts', defaultVisible: false },
  { id: 'lastActivity', label: 'Last Activity', defaultVisible: true },
  { id: 'createdBy', label: 'Created By', defaultVisible: false },
  { id: 'createdAt', label: 'Created At', defaultVisible: false },
  { id: 'lastModifiedBy', label: 'Modified By', defaultVisible: false },
  { id: 'lastModifiedAt', label: 'Modified At', defaultVisible: false },
  { id: 'sharepointFolder', label: 'SharePoint Folder', defaultVisible: false },
];

// Default tabs configuration
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

export default function PropertiesPage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const router = useRouter();
  const pathname = usePathname();
  const { schema } = useSchemaStore();
  const { canAccess } = usePermissions();
  const canCreateProperty = canAccess('Property', 'create');
  const canEditProperty = canAccess('Property', 'edit');
  const canDeleteProperty = canAccess('Property', 'delete');
  
  // Tab navigation state
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  
  // Check if Property object exists with page layouts
  const propertyObject = schema?.objects.find(obj => obj.apiName === 'Property');
  const isLookupLoaded = useLookupPreloader(propertyObject);
  const pageLayouts = propertyObject?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  // Dynamically generate available columns from schema
  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!propertyObject?.fields) {
      // Fallback to hard-coded columns if schema not loaded
      return [
        { id: 'propertyNumber', label: 'Property #', defaultVisible: true },
        { id: 'address', label: 'Address', defaultVisible: true },
        { id: 'city', label: 'City', defaultVisible: true },
        { id: 'state', label: 'State', defaultVisible: true },
        { id: 'zipCode', label: 'Zip Code', defaultVisible: false },
        { id: 'status', label: 'Status', defaultVisible: true },
        { id: 'contacts', label: 'Contacts', defaultVisible: false },
        { id: 'accounts', label: 'Accounts', defaultVisible: false },
        { id: 'lastActivity', label: 'Last Activity', defaultVisible: true },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created At', defaultVisible: false },
        { id: 'lastModifiedBy', label: 'Modified By', defaultVisible: false },
        { id: 'lastModifiedAt', label: 'Modified At', defaultVisible: false },
        { id: 'sharepointFolder', label: 'SharePoint Folder', defaultVisible: false },
      ];
    }

    // Generate columns from schema fields
    return propertyObject.fields.map((field, index) => {
      // Strip the Property__ prefix for display
      const cleanApiName = field.apiName.replace('Property__', '');
      
      // Determine if field should be visible by default (first 5 non-system fields)
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 10;
      
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible
      };
    });
  }, [propertyObject]);

  // Load and persist layout selection
  useEffect(() => {
    if (hasPageLayout && !selectedLayoutId) {
      (async () => {
        const savedLayoutId = await getPreference<string>('propertySelectedLayoutId');
        if (savedLayoutId && pageLayouts.find(l => l.id === savedLayoutId)) {
          setSelectedLayoutId(savedLayoutId);
        } else if (pageLayouts.length > 0) {
          setSelectedLayoutId(pageLayouts[0].id);
        }
      })();
    }
  }, [hasPageLayout, pageLayouts, selectedLayoutId]);


  // Load saved tab configuration
  useEffect(() => {
    (async () => {
      const savedTabs = await getSetting<Array<{ name: string; href: string }>>('tabConfiguration');
      if (savedTabs) {
        setTabs(savedTabs);
      } else {
        setTabs(defaultTabs);
      }

      // Load available objects from schema store
      if (schema?.objects) {
        const objectTabs = schema.objects
          .filter((obj: any) => obj.isCustom)
          .map((obj: any) => ({
            name: obj.label,
            href: `/${obj.apiName.toLowerCase()}`
          }));
        setAvailableObjects(objectTabs);
      }

      setIsLoaded(true);
    })();
  }, [schema]);

  // Fetch properties from API
  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const records = await recordsService.getRecords('Property');
      const flattenedRecords = recordsService.flattenRecords(records).map(record => ({
        ...record,
        propertyNumber: record.propertyNumber || '',
        createdBy: record.createdBy || 'System',
        createdAt: record.createdAt || new Date().toISOString(),
        lastModifiedBy: record.modifiedBy || 'System',
        lastModifiedAt: record.updatedAt || new Date().toISOString(),
      }));
      setProperties(flattenedRecords as Property[]);
    } catch (error) {
      console.error('Failed to fetch properties from API:', error);
      setFetchError('Failed to load data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, [schema]);

  useEffect(() => {
    // Load visible columns from preferences or use defaults
    (async () => {
      const storedColumns = await getPreference<string[]>('propertiesVisibleColumns');
      if (storedColumns) {
        setVisibleColumns(storedColumns);
      } else {
        const defaultColumns = AVAILABLE_COLUMNS
          .filter(col => col.defaultVisible)
          .map(col => col.id);
        setVisibleColumns(defaultColumns);
      }
    })();

    // Fetch properties from API
    fetchProperties();
  }, [fetchProperties]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const filteredProperties = properties.filter(property => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || Object.values(property).some(value => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.toLowerCase().includes(searchLower);
      if (typeof value === 'object') return formatFieldValue(value, undefined).toLowerCase().includes(searchLower);
      return String(value).toLowerCase().includes(searchLower);
    });
    
    const currentUser = 'Development User';
    let matchesSidebar = true;
    
    switch (sidebarFilter) {
      case 'recent':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        matchesSidebar = new Date(property.lastModifiedAt) >= thirtyDaysAgo;
        break;
      case 'created-by-me':
        matchesSidebar = property.createdBy === currentUser;
        break;
      case 'favorites':
        matchesSidebar = (property as any).isFavorite === true;
        break;
      case 'all':
      default:
        matchesSidebar = true;
        break;
    }
    
    return matchesSearch && matchesSidebar;
  }).sort((a, b) => {
    if (!sortColumn) return 0;
    
    const aValue = (a as any)[sortColumn];
    const bValue = (b as any)[sortColumn];
    
    // Handle arrays
    if (Array.isArray(aValue) && Array.isArray(bValue)) {
      const aStr = aValue.join(', ').toLowerCase();
      const bStr = bValue.join(', ').toLowerCase();
      return sortDirection === 'asc' 
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    }
    
    // Handle null/undefined
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
    
    // Handle dates
    if (sortColumn.includes('At') || sortColumn === 'lastActivity') {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    // Handle strings and numbers
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
    setPreference('propertiesVisibleColumns', newVisibleColumns);
  };

  const handleColumnDragStart = (index: number) => {
    setDraggedColumnIndex(index);
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
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
    setPreference('propertiesVisibleColumns', visibleColumns);
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      setPreference('propertiesVisibleColumns', newVisibleColumns);
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    setPreference('propertiesVisibleColumns', newVisibleColumns);
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    setPreference('propertiesVisibleColumns', defaultColumns);
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (property: Property, columnId: string) => {
    void isLookupLoaded; // re-render after lookup cache loads
    let value = (property as any)[columnId];

    // Formula fields: evaluate expression instead of showing raw value
    const schemaFieldForFormula = propertyObject?.fields?.find(f => f.apiName === `Property__${columnId}` || f.apiName === columnId);
    if (schemaFieldForFormula?.type === 'Formula' && schemaFieldForFormula.formulaExpr) {
      const computed = evaluateFormulaForRecord(schemaFieldForFormula.formulaExpr, property as any, propertyObject);
      if (computed !== null && computed !== undefined) return String(computed);
      return '-';
    }
    
    if (value === null || value === undefined) {
      return 'N/A';
    }
    // Auto-parse JSON strings
    if (typeof value === 'string' && value.startsWith('{')) {
      try { value = JSON.parse(value); } catch { /* not JSON */ }
    }
    
    // Check if this is a lookup field and resolve the display name
    const lookupObjectType = inferLookupObjectType(columnId);
    if (lookupObjectType && typeof value === 'string') {
      return resolveLookupDisplayName(value, lookupObjectType);
    }
    
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None';
    }
    
    // Use formatFieldValue to handle objects like Address and Geolocation
    if (typeof value === 'object') {
      const schemaField = propertyObject?.fields?.find(f => f.apiName === `Property__${columnId}` || f.apiName === columnId);
      let fieldType = schemaField?.type;
      if (!fieldType) {
        if (columnId === 'address') fieldType = 'Address';
      }
      return formatFieldValue(value, fieldType, schemaField?.lookupObject);
    }
    
    // Route remaining values through formatFieldValue for field-type-aware display
    const schemaFieldFinal = propertyObject?.fields?.find(f => f.apiName === `Property__${columnId}` || f.apiName === columnId);
    if (schemaFieldFinal?.type) return formatFieldValue(value, schemaFieldFinal.type, schemaFieldFinal.lookupObject);
    return String(value);
  };


  const handleDynamicFormSubmit = async (data: Record<string, any>, layoutId?: string) => {
    const normalizeFieldName = (fieldName: string): string => {
      return fieldName.replace('Property__', '');
    };

    const normalizedData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      const cleanKey = normalizeFieldName(key);
      normalizedData[cleanKey] = value;
    });
    
    // Derive country & state from the composite Address field or the standalone text fields.
    // The composite Address object has { street, city, state, postalCode, country }.
    // The standalone fields are Property__city, Property__state, Property__zipCode (no country).
    const addr = normalizedData.address;
    const isAddrObj = typeof addr === 'object' && addr !== null;
    const addrCountry = (isAddrObj && addr.country) || normalizedData.country || '';
    const addrState = (isAddrObj && addr.state) || normalizedData.state || '';

    const prefix = getPropertyPrefix({ country: addrCountry, state: addrState });
    const allExistingNumbers = properties.map(p => p.propertyNumber);
    const propertyNumber = generatePropertyNumber(prefix, allExistingNumbers);
    
    const today = new Date().toISOString().split('T')[0];
    const currentUserName = user?.name || user?.email || 'System';
    
    // Get default record type
    const defaultRecordType = schema?.objects.find(o => o.apiName === 'Property')?.recordTypes?.[0];

    // Prepare the record data for the API — only include fields explicitly filled in + auto-generated
    const recordData = {
      ...normalizedData,
      propertyNumber,
    };

    try {
      // Create record via API
      const createdRecord = await recordsService.createRecord('Property', { data: recordData, pageLayoutId: layoutId || selectedLayoutId || undefined });
      
      if (!createdRecord) {
        throw new Error('Failed to create record - null response');
      }
      
      // Close the form and reset state
      setShowDynamicForm(false);
      
      // Refresh the list
      await fetchProperties();
      
      // Redirect to the newly created property's detail page
      router.push(`/properties/${createdRecord.id}`);
    } catch (error) {
      console.error('Failed to create property:', error);
      throw error;
    }
  };

  const handleDeleteProperty = async (id: string) => {
    if (confirm('Are you sure you want to delete this property?')) {
      try {
        await recordsService.deleteRecord('Property', id);
        // Refresh the list after deletion
        fetchProperties();
      } catch (error) {
        console.error('Failed to delete property:', error);
        // Fallback to local deletion if API fails
        const updatedProperties = properties.filter(p => p.id !== id);
        setProperties(updatedProperties);
      }
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedProperties = properties.map(p => 
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    );
    setProperties(updatedProperties);
    setOpenDropdown(null);
  };

  // Tab management functions
  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    setSetting('tabConfiguration', newTabs);
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
        <div className="text-gray-600">Loading properties...</div>
      </div>
    );
  }

  if (!canAccess('Property', 'read')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view Properties.</p>
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <div className="space-y-6">
            {/* Page Header in Sidebar */}
            <div className="pb-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-brand-navy" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Properties</h1>
              </div>
              <p className="text-sm text-gray-600 ml-13">Manage property records and locations</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Properties</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setSidebarFilter('recent')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'recent'
                      ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Recent
                </button>
                <button
                  onClick={() => setSidebarFilter('created-by-me')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'created-by-me'
                      ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Created by Me
                </button>
                <button
                  onClick={() => setSidebarFilter('all')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'all'
                      ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <List className="w-4 h-4" />
                  All Properties
                </button>
                <button
                  onClick={() => setSidebarFilter('favorites')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'favorites'
                      ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Star className="w-4 h-4" />
                  All Favorites
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-6">
        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Property Records</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>
            {canCreateProperty && (
            <button
                onClick={() => {
                  if (!hasPageLayout) {
                    setShowNoLayoutsDialog(true);
                  } else if (pageLayouts.length === 1) {
                    setSelectedLayoutId(pageLayouts[0].id);
                    setShowDynamicForm(true);
                  } else {
                    setShowLayoutSelector(true);
                  }
                }}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Property
              </button>
              )}
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
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
            />
          </div>
        </div>

        {fetchError && (
          <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <span className="text-sm">{fetchError}</span>
            </div>
            <button onClick={() => { setFetchError(null); window.location.reload(); }} className="text-sm text-red-600 hover:text-red-800 font-medium">Retry</button>
          </div>
        )}
        {/* Properties List */}
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
                {filteredProperties.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/properties/${property.id}`)}>
                    {visibleColumns.map(columnId => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                          {column.id === 'propertyNumber' ? (
                            <Link href={`/properties/${property.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                              {property.propertyNumber}
                            </Link>
                          ) : column.id === 'address' ? (
                            <Link href={`/properties/${property.id}`} className="text-brand-navy hover:text-brand-dark hover:underline">
                              {formatColumnValue(property, column.id)}
                            </Link>
                          ) : column.id === 'status' ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              property.status === 'Active' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {property.status}
                            </span>
                          ) : (
                            formatColumnValue(property, column.id)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === property.id ? null : property.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === property.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {canEditProperty && (
                            <button
                              onClick={() => {
                                router.push(`/properties/${property.id}`);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-brand-navy hover:bg-[#f0f1fa]"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            )}
                            {canDeleteProperty && (
                            <button
                              onClick={() => {
                                handleDeleteProperty(property.id);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleFavorite(property.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${property.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
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
              <h2 className="text-xl font-bold text-gray-900">Select a Page Layout</h2>
              <p className="text-sm text-gray-600 mt-1">
                Choose which form layout to use for creating a new property
              </p>
            </div>
            <div className="p-6 space-y-3">
              {pageLayouts.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => {
                    setSelectedLayoutId(layout.id);
                    setPreference('propertySelectedLayoutId', layout.id);
                    setShowLayoutSelector(false);
                    setShowDynamicForm(true);
                  }}
                  className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-brand-navy hover:bg-[#f0f1fa] transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-brand-navy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{layout.name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      {layout.tabs?.length || 0} {(layout.tabs?.length || 0) === 1 ? 'tab' : 'tabs'} • {' '}
                      {layout.tabs?.reduce((acc: number, tab: any) => acc + (tab.sections?.length || 0), 0) || 0} sections
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
          objectApiName="Property"
          layoutType="create"
          layoutId={selectedLayoutId}
          onSubmit={handleDynamicFormSubmit}
          title="New Property"
        />
      )}

      {/* Column Configuration Dialog */}
      {showFilterSettings && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowFilterSettings(false)}>
          <div className="bg-white rounded-lg w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-gray-900">Configure Table Columns</h2>
              <p className="text-sm text-gray-600 mt-1">Customize which columns appear in your table. Drag to reorder, click to remove.</p>
            </div>
            
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-gray-700 uppercase">Visible Columns ({visibleColumns.length})</h3>
                <button 
                  onClick={() => setShowAddColumn(true)} 
                  className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                >
                  Add More Columns
                </button>
              </div>
              
              <div className="space-y-2">
                {visibleColumns.map((columnId, index) => {
                  const column = AVAILABLE_COLUMNS.find(c => c.id === columnId);
                  if (!column) return null;
                  
                  return (
                    <div
                      key={columnId}
                      draggable
                      onDragStart={() => handleColumnDragStart(index)}
                      onDragOver={(e) => handleColumnDragOver(e, index)}
                      onDragEnd={handleColumnDragEnd}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded border border-gray-200 cursor-move group"
                    >
                      <GripVertical className="w-5 h-5 text-gray-400" />
                      <span className="flex-1 text-sm font-medium text-gray-900">{column.label}</span>
                      <button
                        onClick={() => handleRemoveColumn(columnId)}
                        className="p-1 hover:bg-white rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button 
                onClick={handleResetColumns} 
                className="mt-6 text-sm text-brand-navy hover:text-brand-dark flex items-center gap-1"
              >
                Reset Columns to Default
              </button>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowFilterSettings(false)}
                className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowFilterSettings(false)}
                className="px-6 py-2 text-sm bg-brand-navy text-white rounded hover:bg-brand-navy-dark transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Column Modal */}
      {showAddColumn && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onClick={() => setShowAddColumn(false)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Columns</h3>
            </div>
            <div className="px-6 py-4">
              <input
                type="text"
                placeholder="Search fields..."
                value={columnSearchTerm}
                onChange={(e) => setColumnSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/40 mb-4"
              />
              <div className="max-h-80 overflow-y-auto">
                <div className="space-y-2">
                  {AVAILABLE_COLUMNS
                    .filter(col => !visibleColumns.includes(col.id) && col.label.toLowerCase().includes(columnSearchTerm.toLowerCase()))
                    .map((column) => (
                      <button
                        key={column.id}
                        onClick={() => {
                          handleAddColumn(column.id);
                          setColumnSearchTerm('');
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-900">{column.label}</span>
                      </button>
                    ))}
                  {AVAILABLE_COLUMNS.filter(col => !visibleColumns.includes(col.id) && col.label.toLowerCase().includes(columnSearchTerm.toLowerCase())).length === 0 && (
                    <p className="text-gray-500 text-sm py-8 text-center">
                      {columnSearchTerm ? 'No fields match your search.' : 'All available columns are already visible.'}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => {
                  setShowAddColumn(false);
                  setColumnSearchTerm('');
                }}
                className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
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
