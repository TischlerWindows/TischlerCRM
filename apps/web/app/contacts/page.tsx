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
  GripVertical
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import AdvancedFilters, { FilterCondition } from '@/components/advanced-filters';
import { applyFilters, describeCondition } from '@/lib/filter-utils';
import { cn, formatFieldValue, resolveLookupDisplayName, inferLookupObjectType } from '@/lib/utils';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { recordsService } from '@/lib/records-service';

interface Contact {
  id: string;
  contactNumber: string;
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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const { schema, loadSchema } = useSchemaStore();
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

  // Load and persist layout selection
  useEffect(() => {
    if (hasPageLayout && !selectedLayoutId) {
      const savedLayoutId = localStorage.getItem('contactSelectedLayoutId');
      if (savedLayoutId && pageLayouts.find(l => l.id === savedLayoutId)) {
        setSelectedLayoutId(savedLayoutId);
      } else if (pageLayouts.length > 0) {
        setSelectedLayoutId(pageLayouts[0].id);
      }
    }
  }, [hasPageLayout, pageLayouts, selectedLayoutId]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

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

  // Fetch contacts from API
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      const records = await recordsService.getRecords('Contact');
      const flattenedRecords = recordsService.flattenRecords(records).map(record => ({
        id: record.id,
        contactNumber: record.contactNumber || '',
        firstName: record.firstName || '',
        lastName: record.lastName || '',
        email: record.email || '',
        phone: record.phone || '',
        company: record.company || '',
        title: record.title || '',
        status: record.status || 'Active',
        lastActivity: record.updatedAt || new Date().toISOString(),
        createdBy: record.createdBy || 'System',
        createdAt: record.createdAt || new Date().toISOString(),
        lastModifiedBy: record.modifiedBy || 'System',
        lastModifiedAt: record.updatedAt || new Date().toISOString(),
        isFavorite: record.isFavorite || false,
      }));
      setContacts(flattenedRecords as Contact[]);
    } catch (error) {
      console.error('Failed to fetch contacts from API, falling back to localStorage:', error);
      const storedContacts = localStorage.getItem('contacts');
      if (storedContacts) {
        setContacts(JSON.parse(storedContacts));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedColumns = localStorage.getItem('contactsVisibleColumns');
    if (savedColumns) {
      setVisibleColumns(JSON.parse(savedColumns));
    } else {
      setVisibleColumns(AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id));
    }

    // Fetch contacts from API
    fetchContacts();
  }, [fetchContacts]);

  const toggleColumnVisibility = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('contactsVisibleColumns', JSON.stringify(newVisibleColumns));
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
    localStorage.setItem('contactsVisibleColumns', JSON.stringify(visibleColumns));
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      localStorage.setItem('contactsVisibleColumns', JSON.stringify(newVisibleColumns));
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('contactsVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    localStorage.setItem('contactsVisibleColumns', JSON.stringify(defaultColumns));
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (contact: Contact, columnId: string) => {
    const value = contact[columnId];
    console.log(`[Table] formatColumnValue for ${columnId}:`, value, 'typeof:', typeof value);
    if (value === null || value === undefined) return '-';
    
    // Check if this is a lookup field and resolve the display name
    const lookupObjectType = inferLookupObjectType(columnId);
    if (lookupObjectType && typeof value === 'string') {
      return resolveLookupDisplayName(value, lookupObjectType);
    }
    
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
    if (typeof value === 'object') {
      let fieldType = undefined;
      if (columnId === 'address') fieldType = 'Address';
      if (columnId === 'name') fieldType = 'CompositeText';
      const formatted = formatFieldValue(value, fieldType);
      console.log(`[Table] formatFieldValue returned:`, formatted);
      return formatted;
    }
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
      localStorage.setItem('contacts', JSON.stringify(updatedContacts));
      setSelectedContacts(new Set());
    }
  };

  const handleBulkFavorite = () => {
    const updatedContacts = contacts.map(c => 
      selectedContacts.has(c.id) ? { ...c, isFavorite: true } : c
    );
    setContacts(updatedContacts);
    localStorage.setItem('contacts', JSON.stringify(updatedContacts));
    setSelectedContacts(new Set());
  };

  const filteredContacts = useMemo(() => {
    // First apply search filter
    let result = contacts.filter(contact => {
      const matchesSearch = contact.contactNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        contact.company?.toLowerCase().includes(searchTerm.toLowerCase());
      
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

  const handleDynamicFormSubmit = async (data: Record<string, any>) => {
    const existingNumbers = contacts.map(c => c.contactNumber).filter(num => num?.startsWith('C-')).map(num => parseInt(num.replace('C-', ''), 10)).filter(num => !isNaN(num));
    const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
    const contactNumber = `C-${String(maxNumber + 1).padStart(3, '0')}`;

    const recordData = {
      contactNumber,
      firstName: data['Contact__firstName'] || data.firstName || '',
      lastName: data['Contact__lastName'] || data.lastName || '',
      email: data['Contact__email'] || data.email || '',
      phone: data['Contact__phone'] || data.phone || '',
      company: data['Contact__company'] || data.company || '',
      title: data['Contact__title'] || data.title || '',
      status: data.status || 'Active',
      ...data,
    };

    try {
      const createdRecord = await recordsService.createRecord('Contact', { data: recordData });
      
      if (!createdRecord) {
        throw new Error('Failed to create record - null response');
      }

      setShowDynamicForm(false);
      setSelectedLayoutId(null);
      await fetchContacts();
      router.push(`/contacts/${createdRecord.id}`);
    } catch (error) {
      console.error('Failed to create record via API, falling back to localStorage:', error);
      const today = new Date().toISOString().split('T')[0] || new Date().toLocaleDateString('en-CA');
      const newContactId = String(Date.now());
      
      const newContact: Contact = {
        id: newContactId,
        contactNumber,
        pageLayoutId: selectedLayoutId || undefined,
        lastActivity: today,
        createdBy: 'Development User',
        createdAt: today,
        lastModifiedBy: 'Development User',
        lastModifiedAt: today,
        ...data,
        firstName: data['Contact__firstName'] || data.firstName || '',
        lastName: data['Contact__lastName'] || data.lastName || '',
        email: data['Contact__email'] || data.email || '',
        phone: data['Contact__phone'] || data.phone || '',
        company: data['Contact__company'] || data.company || '',
        title: data['Contact__title'] || data.title || '',
        status: data.status || 'Active'
      };

      const updatedContacts = [newContact, ...contacts];
      setContacts(updatedContacts);
      localStorage.setItem('contacts', JSON.stringify(updatedContacts));
      setShowDynamicForm(false);
      setSelectedLayoutId(null);
      router.push(`/contacts/${newContactId}`);
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
        localStorage.setItem('contacts', JSON.stringify(updatedContacts));
      }
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedContacts = contacts.map(c => 
      c.id === id ? { ...c, isFavorite: !c.isFavorite } : c
    );
    setContacts(updatedContacts);
    localStorage.setItem('contacts', JSON.stringify(updatedContacts));
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
        <div className="text-gray-600">Loading contacts...</div>
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
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-indigo-600" />
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
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
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
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
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
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
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
                      ? 'bg-indigo-50 text-indigo-600 font-medium'
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
                <button
                  onClick={handleBulkDelete}
                  className="inline-flex items-center px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Delete selected"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            )}
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
              New Contact
            </button>
          </div>
        </div>
        <div className="mb-6 flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input type="text" placeholder="Search contacts..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
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
              <div key={condition.id} className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                {index > 0 && condition.logicOperator && (
                  <span className="font-semibold">{condition.logicOperator}</span>
                )}
                <span>{describeCondition(condition, AVAILABLE_COLUMNS)}</span>
                <button
                  onClick={() => setFilterConditions(filterConditions.filter(c => c.id !== condition.id))}
                  className="text-indigo-600 hover:text-indigo-800"
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
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
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
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                    {visibleColumns.map(columnId => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                          {column.id === 'contactNumber' ? (
                            <Link href={`/contacts/${contact.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                              {contact.contactNumber}
                            </Link>
                          ) : column.id === 'name' ? (
                            <Link href={`/contacts/${contact.id}`} className="font-medium text-indigo-600 hover:text-indigo-800">
                              {formatColumnValue(contact, column.id)}
                            </Link>
                          ) : column.id === 'firstName' || column.id === 'lastName' ? (
                            column.id === 'firstName' && isColumnVisible('lastName') ? (
                              `${contact.firstName} ${contact.lastName}`
                            ) : column.id === 'lastName' && !isColumnVisible('firstName') ? (
                              contact.lastName
                            ) : column.id === 'firstName' ? (
                              contact.firstName
                            ) : null
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
                            <button
                              onClick={() => {
                                router.push(`/contacts/${contact.id}`);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
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
              <Link href="/object-manager/Contact" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700" onClick={() => setShowNoLayoutsDialog(false)}>
                <Layout className="w-4 h-4 mr-2" />Go to Page Editor
              </Link>
            </div>
          </div>
        </div>
      )}
      {showLayoutSelector && pageLayouts.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Select a Layout</h2>
            </div>
            <div className="p-6 space-y-3">
              {pageLayouts.map((layout) => (
                <button key={layout.id} onClick={() => { setSelectedLayoutId(layout.id); localStorage.setItem('contactSelectedLayoutId', layout.id); setShowLayoutSelector(false); setShowDynamicForm(true); }} className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900">{layout.name}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button onClick={() => setShowLayoutSelector(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
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
                      className={`group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-move hover:border-indigo-300 hover:bg-indigo-50 transition-all ${
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
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add More Columns
              </button>
              
              <button 
                onClick={handleResetColumns} 
                className="mt-6 text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
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
                className="px-6 py-2 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4"
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
