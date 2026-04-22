'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Users, 
  Plus, 
  Search, 
  AlertCircle,
  Layout,
  Settings,
  X,
  Clock,
  User,
  Star,
  List,
  MoreVertical,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  HelpCircle,
  Cog,
  Edit3,
  GripVertical,
  Upload,
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import CsvImportDialog from '@/components/csv-import-dialog';
import { LayoutErrorDialog } from '@/components/layout-error-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import { resolveLayoutForUser, type LayoutResolveResult } from '@/lib/layout-resolver';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import AdvancedFilters, { FilterCondition } from '@/components/advanced-filters';
import { applyFilters, describeCondition } from '@/lib/filter-utils';
import { cn, formatFieldValue, resolveLookupDisplayName, inferLookupObjectType, evaluateFormulaForRecord } from '@/lib/utils';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { recordsService } from '@/lib/records-service';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';

interface Contact {
  id: string;
  contactNumber: string;
  name: Record<string, any> | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  status: 'Active' | 'Inactive';
  lastActivity: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  isFavorite?: boolean;
  [key: string]: any;
}



const informationModules = [
  { name: 'Properties', href: '/properties' },
  { name: 'Contacts', href: '/contacts' },
  { name: 'Accounts', href: '/accounts' },
  { name: 'Products', href: '/products' },
];

const pipelineModules = [
  { name: 'Leads', href: '/leads' },
  { name: 'Opportunities', href: '/opportunities' },
  { name: 'Projects', href: '/projects' },
  { name: 'Service', href: '/service' },
  { name: 'Work Orders', href: '/workorders' },
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

export default function ContactsPage() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<
    Extract<LayoutResolveResult, { kind: 'error' }> | null
  >(null);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const { schema, loadSchema } = useSchemaStore();
  const { canAccess, hasAppPermission } = usePermissions();
  const canCreateContact = canAccess('Contact', 'create');
  const canEditContact = canAccess('Contact', 'edit');
  const canDeleteContact = canAccess('Contact', 'delete');
  const pathname = usePathname();
  const router = useRouter();
  
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  
  const contactObject = schema?.objects.find(obj => obj.apiName === 'Contact');
  const isLookupLoaded = useLookupPreloader(contactObject);
  const pageLayouts = contactObject?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  // Dynamically generate available columns from schema
  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!contactObject?.fields) {
      // Fallback to hard-coded columns if schema not loaded
      return [
        { id: 'contactNumber', label: 'Contact #', defaultVisible: true },
        { id: 'firstName', label: 'First Name', defaultVisible: true },
        { id: 'lastName', label: 'Last Name', defaultVisible: true },
        { id: 'email', label: 'Email', defaultVisible: true },
        { id: 'phone', label: 'Phone', defaultVisible: true },
        { id: 'company', label: 'Company', defaultVisible: true },
        { id: 'title', label: 'Title', defaultVisible: true },
        { id: 'status', label: 'Status', defaultVisible: true },
        { id: 'lastActivity', label: 'Last Activity', defaultVisible: false },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created Date', defaultVisible: false },
        { id: 'lastModifiedBy', label: 'Last Modified By', defaultVisible: false },
        { id: 'lastModifiedAt', label: 'Modified Date', defaultVisible: false }
      ];
    }

    // Generate columns from schema fields
    const columns = contactObject.fields.map((field, index) => {
      // Strip the Contact__ prefix for display
      const cleanApiName = field.apiName.replace('Contact__', '');
      
      // Determine if field should be visible by default (first 10 non-system fields)
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 10;
      
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible
      };
    });
    
    return columns;
  }, [contactObject]);


  useEffect(() => {
    if (user) loadSchema();
  }, [loadSchema, user]);

  useEffect(() => {
    (async () => {
      const savedTabs = await getSetting<Array<{ name: string; href: string }>>('tabConfiguration');
      if (savedTabs) {
        setTabs(savedTabs);
      } else {
        setTabs(defaultTabs);
      }

      if (schema?.objects) {
        const objectTabs = schema.objects
          .filter((obj: any) => !['Account', 'Contact', 'Lead', 'Opportunity', 'Project', 'Product', 'Property', 'Service', 'Installation'].includes(obj.apiName))
          .map((obj: any) => ({
            name: obj.label,
            href: `/${obj.apiName.toLowerCase()}`
          }));
        setAvailableObjects(objectTabs);
      }

      setIsLoaded(true);
    })();
  }, [schema]);

  // Fetch contacts from API
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const records = await recordsService.getRecords('Contact');
      const flattenedRecords = recordsService.flattenRecords(records).map(record => ({
        ...record,
        contactNumber: record.contactNumber || '',
        createdBy: record.createdBy || 'System',
        createdAt: record.createdAt || new Date().toISOString(),
        lastModifiedBy: record.modifiedBy || 'System',
        lastModifiedAt: record.updatedAt || new Date().toISOString(),
      }));
      setContacts(flattenedRecords as Contact[]);
    } catch (error) {
      console.error('Failed to fetch contacts from API:', error);
      setFetchError('Failed to load data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const savedColumns = await getPreference<string[]>('contactsVisibleColumns');
      if (savedColumns) {
        setVisibleColumns(savedColumns);
      } else {
        setVisibleColumns(AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id));
      }
    })();

    // Fetch contacts from API
    fetchContacts();
  }, [fetchContacts]);

  const toggleColumnVisibility = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    setVisibleColumns(newVisibleColumns);
    setPreference('contactsVisibleColumns', newVisibleColumns);
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
    setPreference('contactsVisibleColumns', visibleColumns);
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      setPreference('contactsVisibleColumns', newVisibleColumns);
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    setPreference('contactsVisibleColumns', newVisibleColumns);
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    setPreference('contactsVisibleColumns', defaultColumns);
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (contact: Contact, columnId: string) => {
    void isLookupLoaded; // re-render after lookup cache loads
    let value: any = contact[columnId];

    // Formula fields: evaluate expression instead of showing raw value
    const schemaFieldForFormula = contactObject?.fields?.find(f => f.apiName === `Contact__${columnId}` || f.apiName === columnId);
    if (schemaFieldForFormula?.type === 'Formula' && schemaFieldForFormula.formulaExpr) {
      const computed = evaluateFormulaForRecord(schemaFieldForFormula.formulaExpr, contact as any, contactObject);
      if (computed !== null && computed !== undefined) return String(computed);
      return '-';
    }

    if (value === null || value === undefined) return '-';
    // Auto-parse JSON strings
    if (typeof value === 'string' && value.startsWith('{')) {
      try { value = JSON.parse(value); } catch { /* not JSON */ }
    }
    
    // Check if this is a lookup field and resolve the display name
    const lookupObjectType = inferLookupObjectType(columnId);
    if (lookupObjectType && typeof value === 'string') {
      return resolveLookupDisplayName(value, lookupObjectType);
    }
    
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
    if (typeof value === 'object') {
      const schemaField = contactObject?.fields?.find(f => f.apiName === `Contact__${columnId}` || f.apiName === columnId);
      let fieldType = schemaField?.type;
      if (!fieldType) {
        if (columnId === 'address') fieldType = 'Address';
        if (columnId === 'name') fieldType = 'CompositeText';
      }
      return formatFieldValue(value, fieldType, schemaField?.lookupObject);
    }
    // Route remaining values through formatFieldValue for field-type-aware display
    const schemaFieldFinal = contactObject?.fields?.find(f => f.apiName === `Contact__${columnId}` || f.apiName === columnId);
    if (schemaFieldFinal?.type) return formatFieldValue(value, schemaFieldFinal.type, schemaFieldFinal.lookupObject);
    return String(value);
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const handleApplyFilters = (conditions: FilterCondition[]) => {
    setFilterConditions(conditions);
  };

  const handleClearFilters = () => {
    setFilterConditions([]);
  };

  const toggleSelectContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedContacts.size === filteredContacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedContacts.size} selected contacts?`)) {
      const updatedContacts = contacts.filter(c => !selectedContacts.has(c.id));
      setContacts(updatedContacts);
      setSelectedContacts(new Set());
    }
  };

  const handleBulkFavorite = () => {
    const updatedContacts = contacts.map(c => 
      selectedContacts.has(c.id) ? { ...c, isFavorite: true } : c
    );
    setContacts(updatedContacts);
    setSelectedContacts(new Set());
  };

  const filteredContacts = useMemo(() => {
    // First apply search filter
    let result = contacts.filter(contact => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || Object.values(contact).some(value => {
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
          matchesSidebar = new Date(contact.lastModifiedAt) >= thirtyDaysAgo;
          break;
        case 'created-by-me':
          matchesSidebar = contact.createdBy === currentUser;
          break;
        case 'favorites':
          matchesSidebar = (contact as any).isFavorite === true;
          break;
        case 'all':
        default:
          matchesSidebar = true;
          break;
      }
      
      return matchesSearch && matchesSidebar;
    });

    // Apply advanced filters
    if (filterConditions.length > 0) {
      result = applyFilters(result, filterConditions);
    }

    // Apply sorting
    return result.sort((a, b) => {
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
    
    if (sortColumn.includes('At') || sortColumn === 'lastActivity') {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr, undefined, { numeric: true })
      : bStr.localeCompare(aStr, undefined, { numeric: true });
    });
  }, [contacts, searchTerm, sidebarFilter, filterConditions, sortColumn, sortDirection]);

  const handleDynamicFormSubmit = async (data: Record<string, any>, layoutId?: string) => {
    const existingNumbers = contacts.map(c => c.contactNumber).filter(num => num?.startsWith('C')).map(num => parseInt(num.replace(/^C-?/, ''), 10)).filter(num => !isNaN(num));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const contactNumber = `C${String(maxNumber + 1).padStart(3, '0')}`;

    // Normalize: strip object prefix from keys
    const normalizedData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      normalizedData[key.replace('Contact__', '')] = value;
    });

    const recordData = {
      ...normalizedData,
      contactNumber,
    };

    try {
      const createdRecord = await recordsService.createRecord('Contact', { data: recordData, pageLayoutId: layoutId || selectedLayoutId || undefined });
      
      if (!createdRecord) {
        throw new Error('Failed to create record - null response');
      }

      setShowDynamicForm(false);
      setSelectedLayoutId(null);
      await fetchContacts();
      router.push(`/contacts/${createdRecord.id}`);
    } catch (error) {
      console.error('Failed to create contact:', error);
      throw error;
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      try {
        await recordsService.deleteRecord('Contact', id);
        await fetchContacts();
      } catch (error) {
        console.error('Failed to delete contact:', error);
        const updatedContacts = contacts.filter(c => c.id !== id);
        setContacts(updatedContacts);
      }
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedContacts = contacts.map(c => 
      c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
    );
    setContacts(updatedContacts);
    setOpenDropdown(null);
  };

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
        <div className="text-gray-600">Loading contacts...</div>
      </div>
    );
  }

  if (!canAccess('Contact', 'read')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view Contacts.</p>
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
            <div className="pb-6 border-b border-gray-200">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-brand-navy" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
              </div>
              <p className="text-sm text-gray-600 ml-13">Manage contact information and relationships</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Contacts</h3>
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
                  All Contacts
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
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Contact Records</h3>
          <div className="flex gap-3">
            {selectedContacts.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedContacts.size} selected
                </span>
                <button
                  onClick={handleBulkFavorite}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Add to favorites"
                >
                  <Star className="w-4 h-4 mr-2" />
                  Favorite
                </button>
                {canDeleteContact && (
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete selected"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
                )}
              </div>
            )}
            {hasAppPermission('importData') && (
              <button
                onClick={() => setShowImportDialog(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-5 h-5 mr-2" />
                Import
              </button>
            )}
            <button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>
            {canCreateContact && (
            <button
              onClick={() => {
                if (!contactObject) {
                  setShowNoLayoutsDialog(true);
                  return;
                }
                const result = resolveLayoutForUser(
                  contactObject,
                  { profileId: user?.profileId ?? null },
                );
                if (result.kind === 'resolved') {
                  setSelectedLayoutId(result.layout.id);
                  setShowDynamicForm(true);
                } else if (result.reason === 'no-layouts') {
                  setShowNoLayoutsDialog(true);
                } else {
                  setLayoutError(result);
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Contact
            </button>
            )}
          </div>
        </div>
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent" />
          </div>
          <AdvancedFilters
            fields={AVAILABLE_COLUMNS.map(col => ({ 
              id: col.id, 
              label: col.label,
              type: col.id.includes('At') || col.id.includes('Date') || col.id.includes('Activity') ? 'date' : 'text'
            }))}
            onApplyFilters={handleApplyFilters}
            onClearFilters={handleClearFilters}
            storageKey="contacts"
          />
        </div>
        {filterConditions.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="text-sm text-gray-600">Active Filters:</span>
            {filterConditions.map((condition, index) => (
              <div key={condition.id} className="inline-flex items-center gap-2 px-3 py-1 bg-[#e8eaf6] text-brand-navy rounded-full text-sm">
                {index > 0 && condition.logicOperator && (
                  <span className="font-semibold">{condition.logicOperator}</span>
                )}
                <span>{describeCondition(condition, AVAILABLE_COLUMNS)}</span>
                <button
                  onClick={() => setFilterConditions(filterConditions.filter(c => c.id !== condition.id))}
                  className="text-brand-navy hover:text-brand-dark"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={handleClearFilters}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Clear all
            </button>
          </div>
        )}
        {fetchError && (
          <div className="mx-6 mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              <span className="text-sm">{fetchError}</span>
            </div>
            <button onClick={() => { setFetchError(null); window.location.reload(); }} className="text-sm text-red-600 hover:text-red-800 font-medium">Retry</button>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selectedContacts.size === filteredContacts.length && filteredContacts.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                    />
                  </th>
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
                {filteredContacts.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/contacts/${contact.id}`)}>
                    <td className="px-6 py-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedContacts.has(contact.id)}
                        onChange={() => toggleSelectContact(contact.id)}
                        className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                      />
                    </td>
                    {visibleColumns.map(columnId => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                          {column.id === 'contactNumber' ? (
                            <Link href={`/contacts/${contact.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                              {contact.contactNumber}
                            </Link>
                          ) : column.id === 'name' ? (
                            (() => {
                              const nameVal = contact.name;
                              if (!nameVal || typeof nameVal !== 'object') return <span className="text-gray-400">-</span>;
                              const obj = nameVal as Record<string, any>;
                              const keys = Object.keys(obj);
                              const findVal = (pattern: string) => {
                                const k = keys.find(k => k.toLowerCase().includes(pattern));
                                return k ? obj[k] : undefined;
                              };
                              const salutation = obj.salutation || findVal('salutation');
                              const firstName = obj.firstName || findVal('firstname');
                              const lastName = obj.lastName || findVal('lastname');
                              const named = [salutation, firstName, lastName].filter(Boolean);
                              if (named.length === 0) return <span className="text-gray-400">-</span>;
                              return (
                                <Link href={`/contacts/${contact.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                                  {named.join(' ')}
                                </Link>
                              );
                            })()
                          ) : column.id === 'firstName' ? (
                            contact.firstName
                          ) : column.id === 'lastName' ? (
                            contact.lastName
                          ) : column.id === 'status' ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              contact.status === 'Active' 
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {contact.status}
                            </span>
                          ) : (
                            formatColumnValue(contact, column.id)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === contact.id ? null : contact.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === contact.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {canEditContact && (
                            <button
                              onClick={() => {
                                router.push(`/contacts/${contact.id}`);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-brand-navy hover:bg-[#f0f1fa]"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            )}
                            {canDeleteContact && (
                            <button
                              onClick={() => {
                                handleDeleteContact(contact.id);
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
                        onClick={() => handleToggleFavorite(contact.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${contact.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        {filteredContacts.length === 0 && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
            <p className="text-gray-600">{searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first contact.'}</p>
          </div>
        )}
      </div>
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
                  <p className="mb-3">To create new contacts, you need to configure a page layout in the Page Editor first.</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowNoLayoutsDialog(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <Link href="/object-manager/Contact" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark" onClick={() => setShowNoLayoutsDialog(false)}>
                <Layout className="w-4 h-4 mr-2" />Go to Page Editor
              </Link>
            </div>
          </div>
        </div>
      )}
      <LayoutErrorDialog
        open={layoutError !== null}
        onOpenChange={(v) => { if (!v) setLayoutError(null); }}
        result={layoutError}
        objectLabel="Contact"
      />
      {hasPageLayout && selectedLayoutId && (
        <DynamicFormDialog open={showDynamicForm} onOpenChange={(open) => { setShowDynamicForm(open); if (!open) setSelectedLayoutId(null); }} objectApiName="Contact" layoutType="create" layoutId={selectedLayoutId} onSubmit={handleDynamicFormSubmit} title="New Contact" />
      )}

      {/* Column Filter Settings Dialog */}
      {showFilterSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowFilterSettings(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Configure Columns</h2>
                <button
                  onClick={() => setShowFilterSettings(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Drag to reorder, click X to remove columns
              </p>
            </div>
            
            <div className="px-6 py-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {visibleColumns.map((columnId, index) => {
                  const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                  if (!column) return null;
                  return (
                    <div
                      key={column.id}
                      draggable
                      onDragStart={() => handleColumnDragStart(index)}
                      onDragOver={(e) => { e.preventDefault(); handleColumnDragOver(index); }}
                      onDragEnd={handleColumnDragEnd}
                      className={`group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-move hover:border-[#b8bfe8] hover:bg-[#f0f1fa] transition-all ${
                        draggedColumnIndex === index ? 'opacity-50' : ''
                      }`}
                    >
                      <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 flex-1">{column.label}</span>
                      <button
                        onClick={() => handleRemoveColumn(column.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                        title="Remove column"
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button 
                onClick={() => setShowAddColumn(true)}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-brand-navy hover:text-brand-navy transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add More Columns
              </button>
              
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
      {/* CSV Import */}
      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        objectApiName="Contact"
        objectLabel="Contact"
        onImportComplete={() => fetchContacts()}
      />
      </div>
    </div>
  );
}

