'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Building2, Search, Plus, Settings, X, Clock, User, List, Star, MoreVertical, Edit, Trash2, ChevronUp, ChevronDown, HelpCircle, Cog, Edit3, GripVertical } from 'lucide-react';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { cn, formatFieldValue } from '@/lib/utils';
import { useSchemaStore } from '@/lib/schema-store';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';

interface Account {
  id: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  status: 'Active' | 'Inactive';
  website: string;
  primaryEmail: string;
  secondaryEmail: string;
  primaryPhone: string;
  secondaryPhone: string;
  accountNotes: string;
  shippingAddress: string;
  billingAddress: string;
  accountOwner: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
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

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const pathname = usePathname();
  const { schema } = useSchemaStore();
  
  const accountObject = schema?.objects.find(obj => obj.apiName === 'Account');

  // Dynamically generate available columns from schema
  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!accountObject?.fields) {
      // Fallback to hard-coded columns if schema not loaded
      return [
        { id: 'accountNumber', label: 'Account #', defaultVisible: true },
        { id: 'accountName', label: 'Account Name', defaultVisible: true },
        { id: 'accountType', label: 'Type', defaultVisible: true },
        { id: 'primaryEmail', label: 'Primary Email', defaultVisible: true },
        { id: 'secondaryEmail', label: 'Secondary Email', defaultVisible: false },
        { id: 'primaryPhone', label: 'Primary Phone', defaultVisible: true },
        { id: 'secondaryPhone', label: 'Secondary Phone', defaultVisible: false },
        { id: 'status', label: 'Status', defaultVisible: true },
        { id: 'website', label: 'Website', defaultVisible: false },
        { id: 'accountOwner', label: 'Account Owner', defaultVisible: false },
        { id: 'shippingAddress', label: 'Shipping Address', defaultVisible: false },
        { id: 'billingAddress', label: 'Billing Address', defaultVisible: false },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created Date', defaultVisible: false },
        { id: 'lastModifiedBy', label: 'Last Modified By', defaultVisible: false },
        { id: 'lastModifiedAt', label: 'Modified Date', defaultVisible: false }
      ];
    }

    // Generate columns from schema fields
    return accountObject.fields.map((field, index) => {
      // Strip the Account__ prefix for display
      const cleanApiName = field.apiName.replace('Account__', '');
      
      // Determine if field should be visible by default (first 10 non-system fields)
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 10;
      
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible
      };
    });
  }, [accountObject]);
  
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const [formData, setFormData] = useState({
    accountName: '',
    accountType: '',
    status: 'Active' as 'Active' | 'Inactive',
    website: '',
    primaryEmail: '',
    secondaryEmail: '',
    primaryPhone: '',
    secondaryPhone: '',
    accountNotes: '',
    shippingAddress: '',
    billingAddress: '',
    accountOwner: ''
  });

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
    // Mock data - replace with actual API call
    setAccounts([
      {
        id: '1',
        accountNumber: '00001',
        accountName: 'Architect Associates Inc.',
        accountType: 'Architect Firm',
        status: 'Active',
        website: 'https://architectassociates.com',
        primaryEmail: 'info@architectassociates.com',
        secondaryEmail: 'contact@architectassociates.com',
        primaryPhone: '(416) 555-0100',
        secondaryPhone: '(416) 555-0101',
        accountNotes: 'Long-standing partner. Prefers modern design projects.',
        shippingAddress: '123 Design Avenue, Toronto, ON M5V 3A3',
        billingAddress: '123 Design Avenue, Toronto, ON M5V 3A3',
        accountOwner: 'Development User',
        createdBy: 'Development User',
        createdAt: '2024-01-15',
        lastModifiedBy: 'Development User',
        lastModifiedAt: '2024-11-10'
      },
      {
        id: '2',
        accountNumber: '00002',
        accountName: 'Smith Residence',
        accountType: 'Client/Homeowner',
        status: 'Active',
        website: '',
        primaryEmail: 'john.smith@email.com',
        secondaryEmail: '',
        primaryPhone: '(416) 555-0200',
        secondaryPhone: '',
        accountNotes: 'Interested in energy-efficient windows.',
        shippingAddress: '456 Oak Street, Mississauga, ON L5B 2K5',
        billingAddress: '456 Oak Street, Mississauga, ON L5B 2K5',
        accountOwner: 'Development User',
        createdBy: 'Development User',
        createdAt: '2024-02-20',
        lastModifiedBy: 'Development User',
        lastModifiedAt: '2024-11-12'
      }
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    const savedColumns = localStorage.getItem('accountsVisibleColumns');
    if (savedColumns) {
      setVisibleColumns(JSON.parse(savedColumns));
    } else {
      setVisibleColumns(AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id));
    }
  }, []);

  const toggleColumnVisibility = (columnId: string) => {
    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('accountsVisibleColumns', JSON.stringify(newVisibleColumns));
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
    localStorage.setItem('accountsVisibleColumns', JSON.stringify(visibleColumns));
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      localStorage.setItem('accountsVisibleColumns', JSON.stringify(newVisibleColumns));
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    localStorage.setItem('accountsVisibleColumns', JSON.stringify(newVisibleColumns));
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    localStorage.setItem('accountsVisibleColumns', JSON.stringify(defaultColumns));
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (account: Account, columnId: string) => {
    const value = account[columnId as keyof Account];
    if (value === null || value === undefined || value === '') return '-';
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
    if (typeof value === 'object') {
      let fieldType = undefined;
      if (columnId === 'shippingAddress' || columnId === 'billingAddress') fieldType = 'Address';
      return formatFieldValue(value, fieldType);
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

  const filteredAccounts = accounts.filter(account => {
    const matchesSearch = account.accountName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.accountType.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesSidebar = true;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    switch (sidebarFilter) {
      case 'recent':
        matchesSidebar = new Date(account.lastModifiedAt) >= thirtyDaysAgo;
        break;
      case 'created-by-me':
        matchesSidebar = account.createdBy === 'Development User';
        break;
      case 'favorites':
        matchesSidebar = (account as any).isFavorite === true;
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
    
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    
    return sortDirection === 'asc' 
      ? aStr.localeCompare(bStr, undefined, { numeric: true })
      : bStr.localeCompare(aStr, undefined, { numeric: true });
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const today = new Date().toISOString().split('T')[0];
    
    if (editingAccount) {
      // Update existing account
      const updatedAccount: Account = {
        ...editingAccount,
        accountName: formData.accountName,
        accountType: formData.accountType,
        status: formData.status,
        website: formData.website,
        primaryEmail: formData.primaryEmail,
        secondaryEmail: formData.secondaryEmail,
        primaryPhone: formData.primaryPhone,
        secondaryPhone: formData.secondaryPhone,
        accountNotes: formData.accountNotes,
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.billingAddress,
        accountOwner: formData.accountOwner,
        lastModifiedBy: 'Development User',
        lastModifiedAt: today || ''
      };
      
      setAccounts(accounts.map(acc => 
        acc.id === editingAccount.id ? updatedAccount : acc
      ));
      setEditingAccount(null);
    } else {
      // Create new account
      const nextNumber = String(accounts.length + 1).padStart(5, '0');
      
      const newAccount: Account = {
        id: Date.now().toString(),
        accountNumber: nextNumber,
        accountName: formData.accountName,
        accountType: formData.accountType,
        status: formData.status,
        website: formData.website,
        primaryEmail: formData.primaryEmail,
        secondaryEmail: formData.secondaryEmail,
        primaryPhone: formData.primaryPhone,
        secondaryPhone: formData.secondaryPhone,
        accountNotes: formData.accountNotes,
        shippingAddress: formData.shippingAddress,
        billingAddress: formData.billingAddress,
        accountOwner: formData.accountOwner,
        createdBy: 'Development User',
        createdAt: today || '',
        lastModifiedBy: 'Development User',
        lastModifiedAt: today || ''
      };
      
      setAccounts([newAccount, ...accounts]);
    }
    
    resetForm();
    setShowForm(false);
  };

  const handleDynamicFormSubmit = (data: Record<string, any>, layoutId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const nextNumber = String(accounts.length + 1).padStart(5, '0');
    const newAccountId = Date.now().toString();
    
    const newAccount: Account = {
      id: newAccountId,
      pageLayoutId: layoutId,
      accountNumber: nextNumber,
      accountName: data.accountName || '',
      accountType: data.accountType || '',
      status: data.status || 'Active',
      website: data.website || '',
      primaryEmail: data.primaryEmail || '',
      secondaryEmail: data.secondaryEmail || '',
      primaryPhone: data.primaryPhone || '',
      secondaryPhone: data.secondaryPhone || '',
      accountNotes: data.accountNotes || '',
      shippingAddress: data.shippingAddress || '',
      billingAddress: data.billingAddress || '',
      accountOwner: data.accountOwner || '',
      createdBy: 'Development User',
      createdAt: today,
      lastModifiedBy: 'Development User',
      lastModifiedAt: today
    };
    
    setAccounts([...accounts, newAccount]);
    
    // Save the layout association for this record
    const layoutAssociations = JSON.parse(localStorage.getItem('accountLayoutAssociations') || '{}');
    if (selectedLayoutId) {
      layoutAssociations[newAccountId] = selectedLayoutId;
      localStorage.setItem('accountLayoutAssociations', JSON.stringify(layoutAssociations));
    }
    
    setShowDynamicForm(false);
    setSelectedLayoutId(null);
    
    // Redirect to the newly created account's detail page
    router.push(`/accounts/${newAccountId}`);
  };

  const handleEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      accountName: account.accountName,
      accountType: account.accountType,
      status: account.status,
      website: account.website,
      primaryEmail: account.primaryEmail,
      secondaryEmail: account.secondaryEmail,
      primaryPhone: account.primaryPhone,
      secondaryPhone: account.secondaryPhone,
      accountNotes: account.accountNotes,
      shippingAddress: account.shippingAddress,
      billingAddress: account.billingAddress,
      accountOwner: account.accountOwner
    });
    setShowForm(true);
  };

  const handleDelete = (accountId: string) => {
    if (window.confirm('Are you sure you want to delete this account?')) {
      setAccounts(accounts.filter(acc => acc.id !== accountId));
    }
  };

  const handleToggleFavorite = (id: string) => {
    setAccounts(accounts.map(acc => 
      acc.id === id ? { ...acc, isFavorite: !acc.isFavorite } : acc
    ));
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

  const resetForm = () => {
    setEditingAccount(null);
    setFormData({
      accountName: '',
      accountType: '',
      status: 'Active',
      website: '',
      primaryEmail: '',
      secondaryEmail: '',
      primaryPhone: '',
      secondaryPhone: '',
      accountNotes: '',
      shippingAddress: '',
      billingAddress: '',
      accountOwner: ''
    });
  };

  const handleCancel = () => {
    resetForm();
    setShowForm(false);
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <div className="pb-6 border-b border-gray-200 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Manage company and account information</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Accounts</h3>
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
                All Accounts
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
        {/* Title and Actions */}
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">Account Records</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>
            <button
              onClick={() => { if (!accountObject?.pageLayouts || accountObject.pageLayouts.length === 0) { setShowNoLayoutsDialog(true); } else if (accountObject.pageLayouts.length === 1 && accountObject.pageLayouts[0]) { setSelectedLayoutId(accountObject.pageLayouts[0].id); setShowDynamicForm(true); } else { setShowLayoutSelector(true); } }}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New Account
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search accounts by name, number, or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Add/Edit Account Form */}
        {showForm && (
          <div className="bg-white p-6 rounded-lg shadow mb-6">
            <h3 className="text-lg font-medium mb-4">
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Account Information Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Account Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Name</em></strong>
                    </label>
                    <input
                      type="text"
                      value={formData.accountName}
                      onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                      placeholder="Companies' official, registered name"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Type</em></strong>
                    </label>
                    <select
                      value={formData.accountType}
                      onChange={(e) => setFormData({...formData, accountType: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    >
                      <option value="">Select type</option>
                      <option value="Architect Firm">Architect Firm</option>
                      <option value="Owner Rep Firm">Owner Rep Firm</option>
                      <option value="Design Firm">Design Firm</option>
                      <option value="Builder/Contractor Firm">Builder/Contractor Firm</option>
                      <option value="Engineering Firm">Engineering Firm</option>
                      <option value="Manufacturer">Manufacturer</option>
                      <option value="Competitor">Competitor</option>
                      <option value="Client/Homeowner">Client/Homeowner</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Status</em></strong>
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as 'Active' | 'Inactive'})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                  {editingAccount && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-500">
                        <strong><em>Account Number</em></strong>
                      </label>
                      <input
                        type="text"
                        value={editingAccount.accountNumber}
                        disabled
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Website</em></strong>
                    </label>
                    <input
                      type="url"
                      value={formData.website}
                      onChange={(e) => setFormData({...formData, website: e.target.value})}
                      placeholder="https://example.com"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Primary Email</em></strong>
                    </label>
                    <input
                      type="email"
                      value={formData.primaryEmail}
                      onChange={(e) => setFormData({...formData, primaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Secondary Email</em></strong>
                    </label>
                    <input
                      type="email"
                      value={formData.secondaryEmail}
                      onChange={(e) => setFormData({...formData, secondaryEmail: e.target.value})}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Primary Phone</em></strong>
                    </label>
                    <input
                      type="tel"
                      value={formData.primaryPhone}
                      onChange={(e) => setFormData({...formData, primaryPhone: e.target.value})}
                      placeholder="(416) 555-0100"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Secondary Phone</em></strong>
                    </label>
                    <input
                      type="tel"
                      value={formData.secondaryPhone}
                      onChange={(e) => setFormData({...formData, secondaryPhone: e.target.value})}
                      placeholder="(416) 555-0101"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Notes</em></strong>
                    </label>
                    <textarea
                      value={formData.accountNotes}
                      onChange={(e) => setFormData({...formData, accountNotes: e.target.value})}
                      placeholder="Records any pertinent information regarding account"
                      rows={4}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Address Information Section */}
              <div className="border-b border-gray-200 pb-6">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Address Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Shipping Address</em></strong>
                    </label>
                    <textarea
                      value={formData.shippingAddress}
                      onChange={(e) => setFormData({...formData, shippingAddress: e.target.value})}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Billing Address</em></strong>
                    </label>
                    <textarea
                      value={formData.billingAddress}
                      onChange={(e) => setFormData({...formData, billingAddress: e.target.value})}
                      placeholder="Street, City, Province, Postal Code"
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* System Information Section */}
              <div>
                <h4 className="text-md font-semibold text-gray-900 mb-4">System Information</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {editingAccount && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          <strong><em>Created By</em></strong>
                        </label>
                        <input
                          type="text"
                          value={editingAccount.createdBy}
                          disabled
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">{editingAccount.createdAt}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500">
                          <strong><em>Last Modified By</em></strong>
                        </label>
                        <input
                          type="text"
                          value={editingAccount.lastModifiedBy}
                          disabled
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                        />
                        <p className="text-xs text-gray-400 mt-1">{editingAccount.lastModifiedAt}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      <strong><em>Account Owner</em></strong>
                    </label>
                    <input
                      type="text"
                      value={formData.accountOwner}
                      onChange={(e) => setFormData({...formData, accountOwner: e.target.value})}
                      placeholder="Search users..."
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                  {editingAccount ? 'Update Account' : 'Add Account'}
                </button>
                <button 
                  type="button" 
                  onClick={handleCancel}
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Accounts List */}
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
                {filteredAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    {visibleColumns.map(columnId => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                        {column.id === 'accountNumber' ? (
                          <span className="font-medium text-indigo-600">
                            {account.accountNumber}
                          </span>
                        ) : column.id === 'status' ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            account.status === 'Active' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {account.status}
                          </span>
                        ) : (
                          formatColumnValue(account, column.id)
                        )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm relative">
                      <button
                        onClick={() => setOpenDropdown(openDropdown === account.id ? null : account.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === account.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            <button
                              onClick={() => {
                                handleEdit(account);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => {
                                handleDelete(account.id);
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
                        onClick={() => handleToggleFavorite(account.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${account.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredAccounts.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-6">
            <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first account.'}
            </p>
          </div>
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
                        onDragOver={() => handleColumnDragOver(index)}
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
              <div className="px-6 py-4 max-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {AVAILABLE_COLUMNS
                    .filter(col => !visibleColumns.includes(col.id))
                    .map((column) => (
                      <button
                        key={column.id}
                        onClick={() => handleAddColumn(column.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left"
                      >
                        <span className="text-sm font-medium text-gray-900">{column.label}</span>
                      </button>
                    ))}
                  {AVAILABLE_COLUMNS.filter(col => !visibleColumns.includes(col.id)).length === 0 && (
                    <p className="text-gray-500 text-sm py-8 text-center">All available columns are already visible.</p>
                  )}
                </div>
              </div>
              <div className="border-t border-gray-200 px-6 py-4">
                <button
                  onClick={() => setShowAddColumn(false)}
                  className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Layout Selector Modal */}
        {showLayoutSelector && accountObject?.pageLayouts && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl">
              <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-lg font-semibold">Select Page Layout</h3>
                <button
                  onClick={() => setShowLayoutSelector(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                {accountObject.pageLayouts
                  .filter((layout) => layout.layoutType === 'edit' || layout.layoutType === 'create')
                  .map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => {
                        setSelectedLayoutId(layout.id);
                        setShowLayoutSelector(false);
                        setShowDynamicForm(true);
                      }}
                      className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
                    >
                      <div>
                        <h4 className="font-medium text-gray-900">{layout.name}</h4>
                        <p className="text-sm text-gray-500">{layout.tabs.length} tabs</p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* No Layouts Dialog */}
        {showNoLayoutsDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">No Page Layout Configured</h3>
              </div>
              <div className="p-6">
                <p className="text-gray-600 mb-4">
                  Please create a page layout for Account records before creating new records.
                </p>
                <Link href="/object-manager/Account/page-editor">
                  <button className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                    Go to Page Editor
                  </button>
                </Link>
              </div>
              <div className="border-t border-gray-200 px-6 py-3">
                <button
                  onClick={() => setShowNoLayoutsDialog(false)}
                  className="w-full px-4 py-2 text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <DynamicFormDialog 
          open={showDynamicForm} 
          onOpenChange={(open) => { 
            setShowDynamicForm(open); 
            if (!open) setSelectedLayoutId(null); 
          }} 
          objectApiName="Account" 
          layoutType="create" 
          layoutId={selectedLayoutId || undefined} 
          onSubmit={handleDynamicFormSubmit} 
          title="New Account" 
        />
        </div>
      </div>
    </div>
  );
}
