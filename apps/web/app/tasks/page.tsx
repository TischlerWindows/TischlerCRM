'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckSquare,
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
  GripVertical,
  Filter,
  Upload,
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import CsvImportDialog from '@/components/csv-import-dialog';
import { LayoutErrorDialog } from '@/components/layout-error-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import { resolveLayoutForUser, type LayoutResolveResult } from '@/lib/layout-resolver';
import AdvancedFilters, { FilterCondition } from '@/components/advanced-filters';
import { applyFilters, describeCondition } from '@/lib/filter-utils';
import { cn, formatFieldValue, resolveLookupDisplayName, inferLookupObjectType, evaluateFormulaForRecord } from '@/lib/utils';
import { useLookupPreloader } from '@/lib/use-lookup-preloader';
import { recordsService } from '@/lib/records-service';
import { getPreference, setPreference } from '@/lib/preferences';

interface TaskRecord {
  id: string;
  taskNumber: string;
  subject: string;
  status: string;
  priority: string;
  dueDate: string;
  description: string;
  assignedToUserId: string;
  relatedObjectApi: string;
  relatedRecordId: string;
  createdBy: string;
  createdAt: string;
  modifiedBy: string;
  updatedAt: string;
  isFavorite?: boolean;
  [key: string]: any;
}

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
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
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'open' | 'my-tasks' | 'overdue' | 'completed'>('all');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterConditions, setFilterConditions] = useState<FilterCondition[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());

  const { schema, loadSchema } = useSchemaStore();
  const { canAccess, hasAppPermission } = usePermissions();
  const canCreateTask = canAccess('Task', 'create');
  const canEditTask = canAccess('Task', 'edit');
  const canDeleteTask = canAccess('Task', 'delete');
  const router = useRouter();

  const taskObject = schema?.objects.find(obj => obj.apiName === 'Task');
  const isLookupLoaded = useLookupPreloader(taskObject);
  const pageLayouts = taskObject?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;

  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!taskObject?.fields) {
      return [
        { id: 'taskNumber', label: 'Task #', defaultVisible: true },
        { id: 'subject', label: 'Subject', defaultVisible: true },
        { id: 'status', label: 'Status', defaultVisible: true },
        { id: 'priority', label: 'Priority', defaultVisible: true },
        { id: 'dueDate', label: 'Due Date', defaultVisible: true },
        { id: 'assignedToUserId', label: 'Assigned To', defaultVisible: true },
        { id: 'relatedObjectApi', label: 'Related Object', defaultVisible: true },
        { id: 'description', label: 'Description', defaultVisible: false },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
        { id: 'createdAt', label: 'Created Date', defaultVisible: false },
      ];
    }
    return taskObject.fields.map((field, index) => {
      const cleanApiName = field.apiName.replace('Task__', '');
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible: !isSystemField && index < 8,
      };
    });
  }, [taskObject]);

  useEffect(() => { loadSchema(); }, [loadSchema]);


  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const records = await recordsService.getRecords('Task');
      const flattened = recordsService.flattenRecords(records).map(record => ({
        ...record,
        taskNumber: record.taskNumber || '',
        createdBy: record.createdBy || 'System',
        createdAt: record.createdAt || new Date().toISOString(),
        modifiedBy: record.modifiedBy || 'System',
        updatedAt: record.updatedAt || new Date().toISOString(),
      }));
      setTasks(flattened as TaskRecord[]);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setFetchError('Failed to load tasks. Please try refreshing the page.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const savedColumns = await getPreference<string[]>('tasksVisibleColumns');
      if (savedColumns) {
        setVisibleColumns(savedColumns);
      } else {
        setVisibleColumns(AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id));
      }
    })();
    fetchTasks();
  }, [fetchTasks, AVAILABLE_COLUMNS]);

  const toggleColumnVisibility = (columnId: string) => {
    const next = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId];
    setVisibleColumns(next);
    setPreference('tasksVisibleColumns', next);
  };

  const handleColumnDragStart = (index: number) => setDraggedColumnIndex(index);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);

  const handleColumnDragOver = (index: number) => {
    if (draggedColumnIndex === null || draggedColumnIndex === index) return;
    const newCols = [...visibleColumns];
    const dragged = newCols[draggedColumnIndex];
    if (!dragged) return;
    newCols.splice(draggedColumnIndex, 1);
    newCols.splice(index, 0, dragged);
    setVisibleColumns(newCols);
    setDraggedColumnIndex(index);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnIndex(null);
    setPreference('tasksVisibleColumns', visibleColumns);
  };

  const handleResetColumns = () => {
    const defaults = AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id);
    setVisibleColumns(defaults);
    setPreference('tasksVisibleColumns', defaults);
  };

  const formatColumnValue = (task: TaskRecord, columnId: string) => {
    void isLookupLoaded;
    let value: any = task[columnId];

    const schemaField = taskObject?.fields?.find(f => f.apiName === `Task__${columnId}` || f.apiName === columnId);
    if (schemaField?.type === 'Formula' && schemaField.formulaExpr) {
      const computed = evaluateFormulaForRecord(schemaField.formulaExpr, task as any, taskObject);
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
      let fieldType = schemaField?.type;
      return formatFieldValue(value, fieldType, schemaField?.lookupObject);
    }
    if (schemaField?.type) return formatFieldValue(value, schemaField.type, schemaField.lookupObject);
    return String(value);
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const toggleSelectTask = (id: string) => {
    const next = new Set(selectedTasks);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedTasks(next);
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedTasks.size} selected tasks?`)) return;
    for (const id of selectedTasks) {
      try { await recordsService.deleteRecord('Task', id); } catch { /* continue */ }
    }
    setSelectedTasks(new Set());
    await fetchTasks();
  };

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(task => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm || Object.values(task).some(value => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.toLowerCase().includes(searchLower);
        return String(value).toLowerCase().includes(searchLower);
      });

      let matchesSidebar = true;
      switch (sidebarFilter) {
        case 'open':
          matchesSidebar = task.status === 'Open' || task.status === 'In Progress';
          break;
        case 'my-tasks':
          matchesSidebar = true; // all tasks are visible (server already filters by user access)
          break;
        case 'overdue': {
          const due = task.dueDate ? new Date(task.dueDate) : null;
          matchesSidebar = !!due && due < new Date() && task.status !== 'Completed' && task.status !== 'Cancelled';
          break;
        }
        case 'completed':
          matchesSidebar = task.status === 'Completed';
          break;
        case 'all':
        default:
          break;
      }
      return matchesSearch && matchesSidebar;
    });

    if (filterConditions.length > 0) {
      result = applyFilters(result, filterConditions);
    }

    return result.sort((a, b) => {
      if (!sortColumn) {
        // Default sort: open tasks first, then by due date
        const aOpen = a.status !== 'Completed' && a.status !== 'Cancelled' ? 0 : 1;
        const bOpen = b.status !== 'Completed' && b.status !== 'Cancelled' ? 0 : 1;
        if (aOpen !== bOpen) return aOpen - bOpen;
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return aDate - bDate;
      }
      const aVal = (a as any)[sortColumn];
      const bVal = (b as any)[sortColumn];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
      if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
      if (sortColumn.includes('Date') || sortColumn.includes('At')) {
        return sortDirection === 'asc'
          ? new Date(aVal).getTime() - new Date(bVal).getTime()
          : new Date(bVal).getTime() - new Date(aVal).getTime();
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === 'asc' ? aStr.localeCompare(bStr, undefined, { numeric: true }) : bStr.localeCompare(aStr, undefined, { numeric: true });
    });
  }, [tasks, searchTerm, sidebarFilter, filterConditions, sortColumn, sortDirection]);

  const handleDynamicFormSubmit = async (data: Record<string, any>, layoutId?: string) => {
    const normalizedData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      normalizedData[key.replace('Task__', '')] = value;
    });

    try {
      const created = await recordsService.createRecord('Task', { data: normalizedData, pageLayoutId: layoutId || selectedLayoutId || undefined });
      if (!created) throw new Error('Failed to create task');
      setShowDynamicForm(false);
      setSelectedLayoutId(null);
      await fetchTasks();
      router.push(`/tasks/${created.id}`);
    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  };

  const handleDeleteTask = async (id: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await recordsService.deleteRecord('Task', id);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'Open': return 'bg-yellow-100 text-yellow-800';
      case 'In Progress': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (task: TaskRecord) => {
    if (!task.dueDate || task.status === 'Completed' || task.status === 'Cancelled') return false;
    return new Date(task.dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading tasks...</div>
      </div>
    );
  }

  if (!canAccess('Task', 'read')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view Tasks.</p>
          <Link href="/" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark">Go to Home</Link>
        </div>
      </div>
    );
  }

  const openCount = tasks.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const overdueCount = tasks.filter(t => isOverdue(t)).length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  return (
    <div className="flex flex-1 overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto flex-shrink-0">
        <div className="space-y-6">
          <div className="pb-6 border-b border-gray-200">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-[#e8eaf6] rounded-lg flex items-center justify-center">
                <CheckSquare className="w-6 h-6 text-brand-navy" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
            </div>
            <p className="text-sm text-gray-600 ml-13">Manage tasks and activities</p>
          </div>

          {/* Summary counts */}
          <div className="grid grid-cols-3 gap-2 pb-4 border-b border-gray-200">
            <div className="text-center">
              <div className="text-lg font-bold text-brand-navy">{openCount}</div>
              <div className="text-[10px] text-gray-500 uppercase">Open</div>
            </div>
            <div className="text-center">
              <div className={cn('text-lg font-bold', overdueCount > 0 ? 'text-red-600' : 'text-gray-400')}>{overdueCount}</div>
              <div className="text-[10px] text-gray-500 uppercase">Overdue</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">{completedCount}</div>
              <div className="text-[10px] text-gray-500 uppercase">Done</div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Views</h3>
            <nav className="space-y-1">
              {([
                { key: 'all' as const, label: 'All Tasks', icon: List },
                { key: 'open' as const, label: 'Open Tasks', icon: Clock },
                { key: 'my-tasks' as const, label: 'My Tasks', icon: User },
                { key: 'overdue' as const, label: 'Overdue', icon: AlertCircle },
                { key: 'completed' as const, label: 'Completed', icon: CheckSquare },
              ]).map(item => (
                <button
                  key={item.key}
                  onClick={() => setSidebarFilter(item.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                    sidebarFilter === item.key
                      ? 'bg-[#f0f1fa] text-brand-navy font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {item.key === 'overdue' && overdueCount > 0 && (
                    <span className="ml-auto text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">{overdueCount}</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6">
          <div className="mb-6 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Task Records</h3>
            <div className="flex gap-3">
              {selectedTasks.size > 0 && canDeleteTask && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedTasks.size} selected</span>
                  <button
                    onClick={handleBulkDelete}
                    className="inline-flex items-center px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </button>
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
              {canCreateTask && (
                <button
                  onClick={() => {
                    if (!taskObject) {
                      setShowNoLayoutsDialog(true);
                      return;
                    }
                    const result = resolveLayoutForUser(
                      taskObject,
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
                  New Task
                </button>
              )}
            </div>
          </div>

          <div className="mb-6 flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input type="text" placeholder="Search tasks..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent" />
            </div>
            <AdvancedFilters
              fields={AVAILABLE_COLUMNS.map(col => ({
                id: col.id,
                label: col.label,
                type: col.id.includes('Date') || col.id.includes('At') ? 'date' : 'text'
              }))}
              onApplyFilters={(c) => setFilterConditions(c)}
              onClearFilters={() => setFilterConditions([])}
              storageKey="tasks"
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
                  <button onClick={() => setFilterConditions(filterConditions.filter(c => c.id !== condition.id))} className="text-brand-navy hover:text-brand-dark">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button onClick={() => setFilterConditions([])} className="text-sm text-gray-600 hover:text-gray-800 underline">Clear all</button>
            </div>
          )}

          {fetchError && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{fetchError}</span>
              </div>
              <button onClick={() => { setFetchError(null); fetchTasks(); }} className="text-sm text-red-600 hover:text-red-800 font-medium">Retry</button>
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
                        checked={selectedTasks.size === filteredTasks.length && filteredTasks.length > 0}
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
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTasks.map(task => (
                    <tr
                      key={task.id}
                      className={cn(
                        'hover:bg-gray-50 cursor-pointer',
                        isOverdue(task) && 'bg-red-50/40'
                      )}
                      onClick={() => router.push(`/tasks/${task.id}`)}
                    >
                      <td className="px-6 py-4 w-12" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedTasks.has(task.id)}
                          onChange={() => toggleSelectTask(task.id)}
                          className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                        />
                      </td>
                      {visibleColumns.map(columnId => {
                        const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                        if (!column) return null;
                        return (
                          <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                            {column.id === 'taskNumber' ? (
                              <Link href={`/tasks/${task.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                                {task.taskNumber}
                              </Link>
                            ) : column.id === 'subject' ? (
                              <Link href={`/tasks/${task.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                                {task.subject || '-'}
                              </Link>
                            ) : column.id === 'status' ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(task.status)}`}>
                                {task.status}
                              </span>
                            ) : column.id === 'priority' ? (
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${priorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                            ) : column.id === 'dueDate' ? (
                              <span className={cn(isOverdue(task) && 'text-red-600 font-medium')}>
                                {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                              </span>
                            ) : (
                              formatColumnValue(task, column.id)
                            )}
                          </td>
                        );
                      })}
                      <td className="px-6 py-4 text-sm relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenDropdown(openDropdown === task.id ? null : task.id)}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </button>
                        {openDropdown === task.id && (
                          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                            <div className="py-1">
                              {canEditTask && (
                                <button
                                  onClick={() => { router.push(`/tasks/${task.id}`); setOpenDropdown(null); }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-brand-navy hover:bg-[#f0f1fa]"
                                >
                                  <Edit className="w-4 h-4" />
                                  Edit
                                </button>
                              )}
                              {canDeleteTask && (
                                <button
                                  onClick={() => { handleDeleteTask(task.id); setOpenDropdown(null); }}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {filteredTasks.length === 0 && (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tasks found</h3>
              <p className="text-gray-600">{searchTerm ? 'Try adjusting your search.' : 'Get started by creating your first task.'}</p>
            </div>
          )}
        </div>

        {/* No layouts dialog */}
        {showNoLayoutsDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900">No Page Layouts Created</h2>
              </div>
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-gray-700">To create new tasks, you need to configure a page layout in the Object Manager first.</p>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                <button onClick={() => setShowNoLayoutsDialog(false)} className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <Link href="/object-manager/Task" className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark" onClick={() => setShowNoLayoutsDialog(false)}>
                  <Layout className="w-4 h-4 mr-2" />Go to Object Manager
                </Link>
              </div>
            </div>
          </div>
        )}

        <LayoutErrorDialog
          open={layoutError !== null}
          onOpenChange={(v) => { if (!v) setLayoutError(null); }}
          result={layoutError}
          objectLabel="Task"
        />

        {/* Dynamic form dialog */}
        {hasPageLayout && selectedLayoutId && (
          <DynamicFormDialog open={showDynamicForm} onOpenChange={(open) => { setShowDynamicForm(open); if (!open) setSelectedLayoutId(null); }} objectApiName="Task" layoutType="create" layoutId={selectedLayoutId} onSubmit={handleDynamicFormSubmit} title="New Task" />
        )}

        {/* Column config dialog */}
        {showFilterSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={() => setShowFilterSettings(false)}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
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
                <div className="space-y-1 mb-4">
                  {visibleColumns.map((columnId, index) => {
                    const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                    if (!column) return null;
                    return (
                      <div
                        key={column.id}
                        draggable
                        onDragStart={() => handleColumnDragStart(index)}
                        onDragOver={() => handleColumnDragOver(index)}
                        onDragEnd={handleColumnDragEnd}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg cursor-grab"
                      >
                        <GripVertical className="w-4 h-4 text-gray-400" />
                        <span className="flex-1 text-sm text-gray-700">{column.label}</span>
                        <button onClick={() => toggleColumnVisibility(column.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Available Columns</h3>
                  <div className="space-y-1">
                    {AVAILABLE_COLUMNS.filter(col => !visibleColumns.includes(col.id)).map(column => (
                      <button
                        key={column.id}
                        onClick={() => toggleColumnVisibility(column.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        {column.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-gray-200 px-6 py-4 flex justify-between">
                <button onClick={handleResetColumns} className="text-sm text-gray-600 hover:text-gray-800">Reset to Default</button>
                <button onClick={() => setShowFilterSettings(false)} className="px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark text-sm">Done</button>
              </div>
            </div>
          </div>
        )}
      {/* CSV Import */}
      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        objectApiName="Task"
        objectLabel="Task"
        onImportComplete={() => fetchTasks()}
      />
      </div>
    </div>
  );
}

