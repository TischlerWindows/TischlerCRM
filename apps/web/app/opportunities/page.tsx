'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Target, 
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
import { cn, formatFieldValue, resolveLookupDisplayName, inferLookupObjectType, evaluateFormulaForRecord } from '@/lib/utils';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { DEFAULT_TAB_ORDER } from '@/lib/default-tabs';
import { recordsService } from '@/lib/records-service';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';

interface Opportunity {
  id: string;
  opportunityNumber: string;
  opportunityName: string;
  accountName: string;
  stage: string;
  value: number;
  closeDate: string;
  assignedTo: string;
  probability: number;
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

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sidebarFilter, setSidebarFilter] = useState<'recent' | 'created-by-me' | 'all' | 'favorites'>('all');
  const [showNoLayoutsDialog, setShowNoLayoutsDialog] = useState(false);
  const [showDynamicForm, setShowDynamicForm] = useState(false);
  const [prefillData, setPrefillData] = useState<Record<string, any>>({});
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [layoutError, setLayoutError] = useState<
    Extract<LayoutResolveResult, { kind: 'error' }> | null
  >(null);
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { schema } = useSchemaStore();
  const { user } = useAuth();
  const { canAccess, hasAppPermission } = usePermissions();
  const canCreate = canAccess('Opportunity', 'create');
  const canEdit = canAccess('Opportunity', 'edit');
  const canDelete = canAccess('Opportunity', 'delete');
  
  const [editMode, setEditMode] = useState(false);
  const [tabs, setTabs] = useState<Array<{ name: string; href: string }>>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showAddTab, setShowAddTab] = useState(false);
  const [availableObjects, setAvailableObjects] = useState<Array<{ name: string; href: string }>>([]);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  
  // Check if Opportunity object exists with page layouts
  const oppObject = schema?.objects.find(obj => obj.apiName === 'Opportunity');
  const lookupTick = useLookupPreloader(oppObject);
  const objectLabel = oppObject?.label || 'Opportunity';
  const objectPluralLabel = oppObject?.pluralLabel || objectLabel + 's';
  const pageLayouts = oppObject?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  // Dynamically generate available columns from schema
  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!oppObject?.fields) {
      return [
        { id: 'opportunityNumber', label: 'Opp #', defaultVisible: true },
        { id: 'opportunityName', label: 'Opportunity Name', defaultVisible: true },
        { id: 'accountName', label: 'Account', defaultVisible: true },
        { id: 'stage', label: 'Stage', defaultVisible: true },
        { id: 'value', label: 'Value', defaultVisible: true },
        { id: 'probability', label: 'Probability', defaultVisible: true },
        { id: 'closeDate', label: 'Close Date', defaultVisible: true },
        { id: 'assignedTo', label: 'Assigned To', defaultVisible: true },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created Date', defaultVisible: false },
        { id: 'lastModifiedBy', label: 'Last Modified By', defaultVisible: false },
        { id: 'lastModifiedAt', label: 'Modified Date', defaultVisible: false }
      ];
    }

    return oppObject.fields.map((field, index) => {
      const cleanApiName = field.apiName.replace('Opportunity__', '');
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 10;
      
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible
      };
    });
  }, [oppObject]);


  // Auto-open new record form when navigated from a related list with ?new=true
  useEffect(() => {
    if (searchParams.get('new') !== 'true' || !oppObject) return;
    const result = resolveLayoutForUser(
      oppObject,
      { profileId: user?.profileId ?? null },
    );
    if (result.kind !== 'resolved') return;
    // Extract prefill fields from URL (e.g., PropertyId=001EcZ28vn7mm0E)
    const prefill: Record<string, any> = {}
    searchParams.forEach((value, key) => {
      if (key !== 'new') prefill[key] = value
    })
    setPrefillData(prefill)
    setSelectedLayoutId(result.layout.id);
    setShowDynamicForm(true)
    router.replace(pathname, { scroll: false })
  }, [searchParams, oppObject, user?.profileId, pathname, router])

  useEffect(() => {
    (async () => {
      const savedTabs = await getSetting<Array<{ name: string; href: string }>>('tabConfiguration');
      if (savedTabs) {
        setTabs(savedTabs);
      } else {
        setTabs(defaultTabs);
      }

      if (schema?.objects) {
        const objects = schema.objects;
        setAvailableObjects(objects.map((obj: any) => ({
          name: obj.label,
          href: `/${obj.apiName.toLowerCase()}`
        })));
      }

      setIsLoaded(true);
    })();
  }, [schema]);

  const fetchOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const records = await recordsService.getRecords('Opportunity');
      const flattenedRecords = recordsService.flattenRecords(records).map(record => ({
        ...record,
        opportunityNumber: record.opportunityNumber || '',
        createdBy: record.createdBy || 'System',
        createdAt: record.createdAt || new Date().toISOString(),
        lastModifiedBy: record.modifiedBy || 'System',
        lastModifiedAt: record.updatedAt || new Date().toISOString(),
      }));
      setOpportunities(flattenedRecords as Opportunity[]);
    } catch (error) {
      console.error('Failed to fetch opportunities from API:', error);
      setFetchError('Failed to load data. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const storedColumns = await getPreference<string[]>('opportunitiesVisibleColumns');
      if (storedColumns) {
        setVisibleColumns(storedColumns);
      } else {
        const defaultColumns = AVAILABLE_COLUMNS
          .filter(col => col.defaultVisible)
          .map(col => col.id);
        setVisibleColumns(defaultColumns);
      }
      fetchOpportunities();
    })();
  }, [fetchOpportunities]);

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const filteredOpportunities = opportunities.filter(opp => {
    // Hide requote records from the main list
    if ((opp as any)._isRequote) return false;

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || Object.values(opp).some(value => {
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
        matchesSidebar = new Date(opp.lastModifiedAt) >= thirtyDaysAgo;
        break;
      case 'created-by-me':
        matchesSidebar = opp.createdBy === 'Development User';
        break;
      case 'favorites':
        matchesSidebar = (opp as any).isFavorite === true;
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
    
    if (sortColumn.includes('At') || sortColumn === 'closeDate') {
      const aDate = new Date(aValue).getTime();
      const bDate = new Date(bValue).getTime();
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    }
    
    if (sortColumn === 'value' || sortColumn === 'probability') {
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
    setPreference('opportunitiesVisibleColumns', newVisibleColumns);
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
    setPreference('opportunitiesVisibleColumns', visibleColumns);
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      setPreference('opportunitiesVisibleColumns', newVisibleColumns);
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    setPreference('opportunitiesVisibleColumns', newVisibleColumns);
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    setPreference('opportunitiesVisibleColumns', defaultColumns);
  };

  const isColumnVisible = (columnId: string) => visibleColumns.includes(columnId);

  const formatColumnValue = (opp: Opportunity, columnId: string) => {
    void lookupTick; // re-render after lookup cache loads
    let value = (opp as any)[columnId];

    // Formula fields: evaluate expression instead of showing raw value
    const schemaFieldForFormula = oppObject?.fields?.find(f => f.apiName === `Opportunity__${columnId}` || f.apiName === columnId);
    if (schemaFieldForFormula?.type === 'Formula' && schemaFieldForFormula.formulaExpr) {
      const computed = evaluateFormulaForRecord(schemaFieldForFormula.formulaExpr, opp as any, oppObject);
      if (computed !== null && computed !== undefined) return String(computed);
      return '-';
    }
    
    if (value === null || value === undefined) {
      return '-';
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
      return value.length > 0 ? value.join(', ') : '-';
    }

    if (typeof value === 'object') {
      const schemaField = oppObject?.fields?.find(f => f.apiName === `Opportunity__${columnId}` || f.apiName === columnId);
      const fieldType = schemaField?.type;
      return formatFieldValue(value, fieldType, schemaField?.lookupObject);
    }
    
    if (typeof value === 'number' && columnId === 'value') {
      return `$${value.toLocaleString()}`;
    }
    
    if (typeof value === 'number' && columnId === 'probability') {
      return `${value}%`;
    }
    
    // Route remaining values through formatFieldValue for field-type-aware display
    const schemaFieldFinal = oppObject?.fields?.find(f => f.apiName === `Opportunity__${columnId}` || f.apiName === columnId);
    if (schemaFieldFinal?.type) return formatFieldValue(value, schemaFieldFinal.type, schemaFieldFinal.lookupObject);
    return String(value);
  };

  const handleDynamicFormSubmit = async (data: Record<string, any>, layoutId?: string) => {
    try {
      // Map schema field names (e.g., Opportunity__opportunityName) to simple field names
      const normalizeFieldName = (fieldName: string): string => {
        return fieldName.replace('Opportunity__', '');
      };

      // Create normalized data object with simple field names
      const normalizedData: Record<string, any> = {};
      Object.entries(data).forEach(([key, value]) => {
        const cleanKey = normalizeFieldName(key);
        normalizedData[cleanKey] = value;
      });

      // Generate unique opportunity number
      const existingNumbers = opportunities
        .map(d => d.opportunityNumber)
        .filter(num => num && num.startsWith('OPP'))
        .map(num => parseInt(num.replace(/^OPP-?/, ''), 10))
        .filter(num => !isNaN(num));

      const maxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) : 0;
      const nextNumber = maxNumber + 1;
      const opportunityNumber = `OPP${String(nextNumber).padStart(4, '0')}`;


      const today = new Date().toISOString().split('T')[0];
      const currentUserName = user?.name || user?.email || 'Development User';

      const recordData = {
        ...normalizedData,
        opportunityNumber,
      };

      const result = await recordsService.createRecord('Opportunity', { data: recordData, pageLayoutId: layoutId || selectedLayoutId || undefined });

      const newOpp: Opportunity = {
        id: result.id,
        opportunityNumber,
        ...normalizedData,
        createdBy: currentUserName,
        createdAt: today,
        lastModifiedBy: currentUserName,
        lastModifiedAt: today
      };

      const updatedOpps = [newOpp, ...opportunities];
      setOpportunities(updatedOpps);

      // Return the new record ID so DynamicForm can save pending widget
      // data (e.g. team members) before navigating away.
      return result.id;
    } catch (error) {
      console.error('Failed to create opportunity:', error);
      throw error;
    }
  };

  /** Called by DynamicForm after record + pending widgets are saved */
  const handleOpportunityCreated = (recordId: string) => {
    setShowDynamicForm(false);
    setSelectedLayoutId(null);
    router.push(`/opportunities/${recordId}`);
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Are you sure you want to delete this ${objectLabel.toLowerCase()}?`)) {
      try {
        await recordsService.deleteRecord('Opportunity', id);
        const updatedOpps = opportunities.filter(d => d.id !== id);
        setOpportunities(updatedOpps);
      } catch (error) {
        console.error('Failed to Delete Opportunity from API, trying locally:', error);
        const updatedOpps = opportunities.filter(d => d.id !== id);
        setOpportunities(updatedOpps);
      }
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedOpps = opportunities.map(d => 
      d.id === id ? { ...d, isFavorite: !d.isFavorite } : d
    );
    setOpportunities(updatedOpps);
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
        <div className="text-gray-600">Loading {objectPluralLabel.toLowerCase()}...</div>
      </div>
    );
  }

  if (!canAccess('Opportunity', 'read')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view {objectPluralLabel}.</p>
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark">Go to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">
        {/* Sidebar */}
        <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
          <div className="pb-6 border-b border-gray-200 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center"><Target className="w-6 h-6 text-brand-navy" /></div>
              <h1 className="text-2xl font-bold text-gray-900">{objectPluralLabel}</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Manage sales opportunities and pipeline</p>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{objectPluralLabel}</h3>
            <nav className="space-y-1">
              <button
                onClick={() => setSidebarFilter('recent')}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'recent'
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <List className="w-4 h-4 mr-3" />
                All {objectPluralLabel}
              </button>
              <button
                onClick={() => setSidebarFilter('favorites')}
                className={`w-full flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  sidebarFilter === 'favorites'
                    ? 'bg-[#f0f1fa] text-brand-navy font-medium'
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
          <h3 className="text-lg font-medium text-gray-900">{objectLabel} Records</h3>
          <div className="flex gap-3">
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
            {canCreate && (
            <button
              onClick={() => {
                if (!oppObject) {
                  setShowNoLayoutsDialog(true);
                  return;
                }
                const result = resolveLayoutForUser(
                  oppObject,
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
              New {objectLabel}
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
              placeholder={`Search ${objectPluralLabel.toLowerCase()} by number, name, account, or stage...`}
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
        {/* opportunities List */}
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
                {filteredOpportunities.map((opp) => (
                  <tr key={opp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/opportunities/${opp.id}`)}>
                    {visibleColumns.map(columnId => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                          {column.id === 'opportunityNumber' ? (
                            <Link href={`/opportunities/${opp.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                              {opp.opportunityNumber}
                            </Link>
                          ) : column.id === 'opportunityName' ? (
                            <Link href={`/opportunities/${opp.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                              {opp.opportunityName}
                            </Link>
                          ) : column.id === 'stage' ? (
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              opp.stage === 'Closed Won' ? 'bg-green-100 text-green-800' :
                              opp.stage === 'Closed Lost' ? 'bg-red-100 text-red-800' :
                              opp.stage === 'Negotiation' ? 'bg-blue-100 text-blue-800' :
                              opp.stage === 'Contract Review' ? 'bg-[#e8eaf6] text-brand-dark' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {opp.stage}
                            </span>
                          ) : (
                            formatColumnValue(opp, column.id)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === opp.id ? null : opp.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === opp.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {canEdit && (
                            <button
                              onClick={() => {
                                router.push(`/opportunities/${opp.id}`);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-brand-navy hover:bg-[#f0f1fa]"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            )}
                            {canDelete && (
                            <button
                              onClick={() => {
                                handleDelete(opp.id);
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
                        onClick={() => handleToggleFavorite(opp.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${opp.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredOpportunities.length === 0 && (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No {objectPluralLabel.toLowerCase()} found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : `Get started by creating your first ${objectLabel.toLowerCase()}.`}
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
                    To create new opportunities, you need to configure a page layout in the Page Editor first.
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
                href="/object-manager/Opportunity"
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

      <LayoutErrorDialog
        open={layoutError !== null}
        onOpenChange={(v) => { if (!v) setLayoutError(null); }}
        result={layoutError}
        objectLabel="Opportunity"
      />

      {/* Dynamic Form Dialog */}
      {hasPageLayout && selectedLayoutId && (
        <DynamicFormDialog
          open={showDynamicForm}
          onOpenChange={(open) => {
            setShowDynamicForm(open);
            if (!open) {
              setSelectedLayoutId(null);
              setPrefillData({});
            }
          }}
          objectApiName="Opportunity"
          layoutType="create"
          layoutId={selectedLayoutId}
          recordData={prefillData}
          onSubmit={handleDynamicFormSubmit}
          onCreated={handleOpportunityCreated}
          title="New Opportunity"
        />
      )}

      {/* Column Filter Settings Dialog */}
      {showFilterSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowFilterSettings(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Configure Columns</h2>
                <button onClick={() => setShowFilterSettings(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">Drag to reorder, click X to remove columns</p>
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
                      onDragOver={(e) => handleColumnDragOver(e, index)}
                      onDragEnd={handleColumnDragEnd}
                      className={`group flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg cursor-move hover:border-[#b8bfe8] hover:bg-[#f0f1fa] transition-all ${
                        draggedColumnIndex === index ? 'opacity-50' : ''
                      }`}
                    >
                      <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 flex-1">{column.label}</span>
                      <button onClick={() => handleRemoveColumn(column.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all" title="Remove column">
                        <X className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  );
                })}
              </div>
              
              <button onClick={() => setShowAddColumn(true)} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-brand-navy hover:text-brand-navy transition-colors">
                <Plus className="w-4 h-4" />
                Add More Columns
              </button>
              
              <button onClick={handleResetColumns} className="mt-6 text-sm text-brand-navy hover:text-brand-dark flex items-center gap-1">
                Reset Columns to Default
              </button>
            </div>
            
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowFilterSettings(false)} className="px-6 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => setShowFilterSettings(false)} className="px-6 py-2 text-sm bg-brand-navy text-white rounded hover:bg-brand-navy-dark transition-colors">Save</button>
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
                  {AVAILABLE_COLUMNS.filter(col => !visibleColumns.includes(col.id) && col.label.toLowerCase().includes(columnSearchTerm.toLowerCase())).map((column) => (
                    <button key={column.id} onClick={() => { handleAddColumn(column.id); setColumnSearchTerm(''); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded border border-gray-200 transition-colors text-left">
                      <span className="text-sm font-medium text-gray-900">{column.label}</span>
                    </button>
                  ))}
                  {AVAILABLE_COLUMNS.filter(col => !visibleColumns.includes(col.id) && col.label.toLowerCase().includes(columnSearchTerm.toLowerCase())).length === 0 && (
                    <p className="text-gray-500 text-sm py-8 text-center">{columnSearchTerm ? 'No fields match your search.' : 'All available columns are already visible.'}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 px-6 py-4">
              <button onClick={() => { setShowAddColumn(false); setColumnSearchTerm(''); }} className="w-full px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
      {/* CSV Import */}
      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        objectApiName="Opportunity"
        objectLabel="Opportunity"
        onImportComplete={() => fetchOpportunities()}
      />

      </div>
    </div>
  );
}

