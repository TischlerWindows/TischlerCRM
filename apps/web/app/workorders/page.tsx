'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  ClipboardList, 
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
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import PageHeader from '@/components/page-header';
import UniversalSearch from '@/components/universal-search';
import { cn, formatFieldValue, resolveLookupDisplayName, inferLookupObjectType, evaluateFormulaForRecord } from '@/lib/utils';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { recordsService } from '@/lib/records-service';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';

interface WorkOrder {
  id: string;
  workOrderNumber: string;
  name: string;
  title: string;
  workOrderType: string;
  workStatus: string;
  leadTech: string;
  scheduledStartDate: string;
  scheduledEndDate: string;
  estimateCost: string;
  primaryContact: string;
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

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
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
  const router = useRouter();
  const pathname = usePathname();
  const { schema } = useSchemaStore();
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const canCreate = canAccess('WorkOrder', 'create');
  const canEdit = canAccess('WorkOrder', 'edit');
  const canDelete = canAccess('WorkOrder', 'delete');
  
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  
  const objectDef = schema?.objects.find(obj => obj.apiName === 'WorkOrder');
  const lookupTick = useLookupPreloader(objectDef);
  const pageLayouts = objectDef?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!objectDef?.fields) {
      return [
        { id: 'workOrderNumber', label: 'WO #', defaultVisible: true },
        { id: 'name', label: 'Work Order', defaultVisible: true },
        { id: 'workOrderType', label: 'Type', defaultVisible: true },
        { id: 'workStatus', label: 'Status', defaultVisible: true },
        { id: 'leadTech', label: 'Lead Tech', defaultVisible: true },
        { id: 'scheduledStartDate', label: 'Start Date', defaultVisible: true },
        { id: 'scheduledEndDate', label: 'End Date', defaultVisible: false },
        { id: 'estimateCost', label: 'Estimate Cost', defaultVisible: true },
        { id: 'primaryContact', label: 'Primary Contact', defaultVisible: true },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created Date', defaultVisible: false },
        { id: 'lastModifiedBy', label: 'Last Modified By', defaultVisible: false },
        { id: 'lastModifiedAt', label: 'Modified Date', defaultVisible: false }
      ];
    }
    return objectDef.fields.map((field, index) => {
      const cleanApiName = field.apiName.replace('WorkOrder__', '');
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 10;
      return { id: cleanApiName, label: field.label, defaultVisible };
    });
  }, [objectDef]);

  useEffect(() => {
    if (hasPageLayout && !selectedLayoutId) {
      (async () => {
        const savedLayoutId = await getPreference<string>('workOrderSelectedLayoutId');
        if (savedLayoutId && pageLayouts.find(l => l.id === savedLayoutId)) {
          setSelectedLayoutId(savedLayoutId);
        } else if (pageLayouts.length > 0) {
          setSelectedLayoutId(pageLayouts[0].id);
        }
      })();
    }
  }, [hasPageLayout, pageLayouts, selectedLayoutId]);

  useEffect(() => {
    (async () => {
      const savedTabs = await getSetting<Array<{ name: string; href: string }>>('tabConfiguration');
      if (savedTabs) {
        setTabs(savedTabs);
      } else {
        setTabs(defaultTabs);
      }
      if (schema?.objects) {
        setAvailableObjects(schema.objects.map((obj: any) => ({
          name: obj.label,
          href: `/${obj.apiName.toLowerCase()}`
        })));
      }
      setIsLoaded(true);
    })();
  }, [schema]);

  const fetchWorkOrders = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const records = await recordsService.getRecords('WorkOrder');
      const flattenedRecords = recordsService.flattenRecords(records).map(record => ({
        ...record,
        workOrderNumber: record.workOrderNumber || '',
        createdBy: record.createdBy || 'System',
        createdAt: record.createdAt || new Date().toISOString(),
        lastModifiedBy: record.modifiedBy || 'System',
        lastModifiedAt: record.updatedAt || new Date().toISOString(),
      }));
      setWorkOrders(flattenedRecords as WorkOrder[]);
    } catch (error) {
      console.error('Failed to fetch work orders from API:', error);
      setFetchError('Failed to load data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const storedColumns = await getPreference<string[]>('workOrdersVisibleColumns');
      if (storedColumns) {
        setVisibleColumns(storedColumns);
      } else {
        const defaultColumns = AVAILABLE_COLUMNS
          .filter(col => col.defaultVisible)
          .map(col => col.id);
        setVisibleColumns(defaultColumns);
      }
      fetchWorkOrders();
    })();
  }, [fetchWorkOrders]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || Object.values(wo).some(value => {
      if (value === null || value === undefined) return false;
      if (typeof value === 'string') return value.toLowerCase().includes(searchLower);
      if (typeof value === 'object') return formatFieldValue(value, undefined).toLowerCase().includes(searchLower);
      return String(value).toLowerCase().includes(searchLower);
    });

    let matchesSidebar = true;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    switch (sidebarFilter) {
      case 'recent':
        matchesSidebar = new Date(wo.lastModifiedAt) >= thirtyDaysAgo;
        break;
      case 'created-by-me':
        matchesSidebar = wo.createdBy === 'Development User';
        break;
      case 'favorites':
        matchesSidebar = (wo as any).isFavorite === true;
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
      return sortDirection === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    }
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortDirection === 'asc' ? 1 : -1;
    if (bValue == null) return sortDirection === 'asc' ? -1 : 1;
    if (sortColumn.includes('Date') || sortColumn.includes('At')) {
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

  const handleColumnDragStart = (index: number) => { setDraggedColumnIndex(index); };

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
    setPreference('workOrdersVisibleColumns', visibleColumns);
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      setPreference('workOrdersVisibleColumns', newVisibleColumns);
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    setPreference('workOrdersVisibleColumns', newVisibleColumns);
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    setPreference('workOrdersVisibleColumns', defaultColumns);
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (wo: WorkOrder, columnId: string) => {
    void lookupTick;
    let value = (wo as any)[columnId];

    const schemaFieldForFormula = objectDef?.fields?.find(f => f.apiName === `WorkOrder__${columnId}` || f.apiName === columnId);
    if (schemaFieldForFormula?.type === 'Formula' && schemaFieldForFormula.formulaExpr) {
      const computed = evaluateFormulaForRecord(schemaFieldForFormula.formulaExpr, wo as any, objectDef);
      if (computed !== null && computed !== undefined) return String(computed);
      return '-';
    }

    if (value === null || value === undefined) return '-';
    if (typeof value === 'string' && value.startsWith('{')) {
      try { value = JSON.parse(value); } catch { /* not JSON */ }
    }
    const lookupObjectType = inferLookupObjectType(columnId);
    if (lookupObjectType && typeof value === 'string') {
      return resolveLookupDisplayName(value, lookupObjectType);
    }
    if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '-';
    if (typeof value === 'object') {
      const schemaField = objectDef?.fields?.find(f => f.apiName === `WorkOrder__${columnId}` || f.apiName === columnId);
      return formatFieldValue(value, schemaField?.type, schemaField?.lookupObject);
    }
    const schemaFieldFinal = objectDef?.fields?.find(f => f.apiName === `WorkOrder__${columnId}` || f.apiName === columnId);
    if (schemaFieldFinal?.type) return formatFieldValue(value, schemaFieldFinal.type, schemaFieldFinal.lookupObject);
    return String(value);
  };

  const handleDynamicFormSubmit = async (data: Record<string, any>, layoutId?: string) => {
    try {
      const normalizeFieldName = (fieldName: string): string => fieldName.replace('WorkOrder__', '');
      const normalizedData: Record<string, any> = {};
      Object.entries(data).forEach(([key, value]) => {
        normalizedData[normalizeFieldName(key)] = value;
      });

      // Generate unique work order number
      const existingNumbers = workOrders
        .map(w => w.workOrderNumber)
        .filter(num => num.startsWith('WO'))
        .map(num => parseInt(num.replace(/^WO-?/, ''), 10))
        .filter(num => !isNaN(num));
      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const nextNumber = maxNumber + 1;
      const workOrderNumber = `WO${String(nextNumber).padStart(4, '0')}`;
      
      const currentUserName = user?.name || user?.email || 'Development User';
      const today = new Date().toISOString().split('T')[0];
      
      const recordData = { ...normalizedData, workOrderNumber };
      const result = await recordsService.createRecord('WorkOrder', { data: recordData, pageLayoutId: layoutId || selectedLayoutId || undefined });
      
      const newWorkOrder: WorkOrder = {
        id: result.id,
        workOrderNumber,
        ...normalizedData,
        createdBy: currentUserName,
        createdAt: today,
        lastModifiedBy: currentUserName,
        lastModifiedAt: today
      } as WorkOrder;

      setWorkOrders([newWorkOrder, ...workOrders]);
      setShowDynamicForm(false);
      setSelectedLayoutId(null);
      router.push(`/workorders/${result.id}`);
    } catch (error) {
      console.error('Failed to create work order:', error);
      throw error;
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this work order?')) {
      try {
        await recordsService.deleteRecord('WorkOrder', id);
        setWorkOrders(workOrders.filter(w => w.id !== id));
      } catch (error) {
        console.error('Failed to delete work order:', error);
        setWorkOrders(workOrders.filter(w => w.id !== id));
      }
    }
  };

  const handleToggleFavorite = (id: string) => {
    setWorkOrders(workOrders.map(w => w.id === id ? { ...w, isFavorite: !w.isFavorite } : w));
    setOpenDropdown(null);
  };

  const saveTabConfiguration = (newTabs: Array<{ name: string; href: string }>) => {
    setSetting('tabConfiguration', newTabs);
  };

  const handleResetToDefault = () => { setTabs(defaultTabs); saveTabConfiguration(defaultTabs); };

  const handleDragStart = (index: number) => { setDraggedIndex(index); };

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

  const handleDragEnd = () => { setDraggedIndex(null); saveTabConfiguration(tabs); };

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
        <div className="text-gray-600">Loading work orders...</div>
      </div>
    );
  }

  if (!canAccess('WorkOrder', 'read')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view Work Order records.</p>
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
                  <ClipboardList className="w-6 h-6 text-brand-navy" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Work Orders</h1>
              </div>
              <p className="text-sm text-gray-600 ml-13">Manage service and maintenance work orders</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Work Orders</h3>
              <nav className="space-y-1">
                <button
                  onClick={() => setSidebarFilter('recent')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'recent' ? 'bg-[#f0f1fa] text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Recent
                </button>
                <button
                  onClick={() => setSidebarFilter('created-by-me')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'created-by-me' ? 'bg-[#f0f1fa] text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <User className="w-4 h-4" />
                  Created by Me
                </button>
                <button
                  onClick={() => setSidebarFilter('all')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'all' ? 'bg-[#f0f1fa] text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <List className="w-4 h-4" />
                  All Work Orders
                </button>
                <button
                  onClick={() => setSidebarFilter('favorites')}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === 'favorites' ? 'bg-[#f0f1fa] text-brand-navy font-medium' : 'text-gray-700 hover:bg-gray-100'
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
          <h3 className="text-lg font-medium text-gray-900">Work Order Records</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>
            {canCreate && (
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
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New Work Order
              </button>
            )}
          </div>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search work orders by number, title, type, or status..."
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

        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {AVAILABLE_COLUMNS.filter(col => isColumnVisible(col.id)).map(column => (
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
                  ))}
                  <th className="px-6 py-3"></th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkOrders.map((wo) => (
                  <tr key={wo.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/workorders/${wo.id}`)}>
                    {AVAILABLE_COLUMNS.filter(col => isColumnVisible(col.id)).map(column => (
                      <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                        {column.id === 'workOrderNumber' ? (
                          <Link href={`/workorders/${wo.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                            {wo.workOrderNumber}
                          </Link>
                        ) : column.id === 'name' ? (
                          <Link href={`/workorders/${wo.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                            {wo.name}
                          </Link>
                        ) : column.id === 'workStatus' ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            wo.workStatus === 'Completed' ? 'bg-green-100 text-green-800' :
                            wo.workStatus === 'In Progress' ? 'bg-blue-100 text-blue-800' :
                            wo.workStatus === 'Cancelled' ? 'bg-red-100 text-red-800' :
                            wo.workStatus === 'On Hold' ? 'bg-orange-100 text-orange-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {wo.workStatus}
                          </span>
                        ) : (
                          formatColumnValue(wo, column.id)
                        )}
                      </td>
                    ))}
                    <td className="px-6 py-4 text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === wo.id ? null : wo.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === wo.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {canEdit && (
                              <button
                                onClick={() => { router.push(`/workorders/${wo.id}`); setOpenDropdown(null); }}
                                className="w-full flex items-center gap-2 px-4 py-2 text-sm text-brand-navy hover:bg-[#f0f1fa]"
                              >
                                <Edit className="w-4 h-4" />
                                Edit
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => { handleDelete(wo.id); setOpenDropdown(null); }}
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
                        onClick={() => handleToggleFavorite(wo.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${wo.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredWorkOrders.length === 0 && (
          <div className="text-center py-12">
            <ClipboardList className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No work orders found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first work order.'}
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
                  <p className="mb-3">To create new work orders, you need to configure a page layout in the Page Editor first.</p>
                  <p className="font-medium text-gray-900">This allows you to:</p>
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
              <button onClick={() => setShowNoLayoutsDialog(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <Link href="/object-manager/WorkOrder" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark" onClick={() => setShowNoLayoutsDialog(false)}>
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
              <p className="text-sm text-gray-600 mt-1">Choose which form layout to use for creating a new work order</p>
            </div>
            <div className="p-6 space-y-3">
              {pageLayouts.map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => {
                    setSelectedLayoutId(layout.id);
                    setPreference('workOrderSelectedLayoutId', layout.id);
                    setShowLayoutSelector(false);
                    setShowDynamicForm(true);
                  }}
                  className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-brand-navy hover:bg-[#f0f1fa] transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center flex-shrink-0">
                    <ClipboardList className="w-5 h-5 text-brand-navy" />
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
              <button onClick={() => setShowLayoutSelector(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Form Dialog */}
      {hasPageLayout && selectedLayoutId && (
        <DynamicFormDialog
          open={showDynamicForm}
          onOpenChange={(open) => { setShowDynamicForm(open); if (!open) setSelectedLayoutId(null); }}
          objectApiName="WorkOrder"
          layoutType="create"
          layoutId={selectedLayoutId}
          onSubmit={handleDynamicFormSubmit}
          title="New Work Order"
        />
      )}

      {/* Column Filter Settings Dialog */}
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
                <button onClick={() => setShowAddColumn(true)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Add More Columns</button>
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
                      <button onClick={() => handleRemoveColumn(columnId)} className="p-1 hover:bg-white rounded transition-colors opacity-0 group-hover:opacity-100" title="Remove">
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  );
                })}
              </div>
              <button onClick={handleResetColumns} className="mt-6 text-sm text-brand-navy hover:text-brand-dark flex items-center gap-1">Reset Columns to Default</button>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowFilterSettings(false)} className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => setShowFilterSettings(false)} className="px-6 py-2 text-sm bg-brand-navy text-white rounded hover:bg-brand-navy-dark transition-colors">Save</button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
