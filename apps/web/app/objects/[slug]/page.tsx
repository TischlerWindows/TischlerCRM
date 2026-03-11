'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit, 
  Trash2,
  AlertCircle,
  Settings,
  Clock,
  User,
  Star,
  List,
  ChevronUp,
  ChevronDown,
  Database,
  GripVertical,
  X
} from 'lucide-react';
import DynamicFormDialog from '@/components/dynamic-form-dialog';
import { useSchemaStore } from '@/lib/schema-store';
import { useAuth } from '@/lib/auth-context';
import { usePermissions } from '@/lib/permissions-context';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { formatFieldValue, resolveLookupDisplayName, inferLookupObjectType } from '@/lib/utils';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';

interface CustomRecord {
  id: string;
  recordTypeId?: string;
  pageLayoutId?: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  isFavorite?: boolean;
  [key: string]: any;
}

export default function CustomObjectRecordsPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { canAccess } = usePermissions();
  const router = useRouter();
  
  const [records, setRecords] = useState<CustomRecord[]>([]);
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
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [columnSearchTerm, setColumnSearchTerm] = useState('');
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  
  const { schema, loadSchema } = useSchemaStore();
  
  // Find the object definition from schema
  const objectDef = useMemo(() => {
    if (!schema) return null;
    return schema.objects.find(obj => 
      obj.apiName.toLowerCase() === slug.toLowerCase() ||
      obj.label.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
    );
  }, [schema, slug]);
  
  const pageLayouts = objectDef?.pageLayouts || [];
  const hasPageLayout = pageLayouts.length > 0;
  const storageKey = `custom_records_${slug}`;
  const canCreate = objectDef ? canAccess(objectDef.apiName, 'create') : false;
  const canEdit = objectDef ? canAccess(objectDef.apiName, 'edit') : false;
  const canDelete = objectDef ? canAccess(objectDef.apiName, 'delete') : false;
  
  // Dynamically generate available columns from schema
  const AVAILABLE_COLUMNS = useMemo(() => {
    if (!objectDef?.fields) {
      return [
        { id: 'id', label: 'ID', defaultVisible: true },
        { id: 'createdAt', label: 'Created At', defaultVisible: true },
        { id: 'createdBy', label: 'Created By', defaultVisible: false },
      ];
    }

    return objectDef.fields.map((field, index) => {
      // Strip the object prefix for display (e.g., MyObject__fieldName -> fieldName)
      const prefix = `${objectDef.apiName}__`;
      const cleanApiName = field.apiName.startsWith(prefix) 
        ? field.apiName.replace(prefix, '') 
        : field.apiName;
      
      const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
      const defaultVisible = !isSystemField && index < 8;
      
      return {
        id: cleanApiName,
        label: field.label,
        defaultVisible
      };
    });
  }, [objectDef]);

  // Load schema on mount
  useEffect(() => {
    if (!schema) {
      loadSchema();
    }
  }, [schema, loadSchema]);

  // Load saved layout selection
  useEffect(() => {
    if (hasPageLayout && !selectedLayoutId) {
      (async () => {
        const savedLayoutId = await getPreference<string>(`${slug}SelectedLayoutId`);
        if (savedLayoutId && pageLayouts.find(l => l.id === savedLayoutId)) {
          setSelectedLayoutId(savedLayoutId);
        } else {
          // 1. Use the layout assigned to the default record type (set by Page Editor)
          const defaultRt = objectDef?.defaultRecordTypeId
            ? objectDef.recordTypes?.find(r => r.id === objectDef.defaultRecordTypeId)
            : objectDef?.recordTypes?.[0];
          if (defaultRt?.pageLayoutId) {
            const rtLayout = pageLayouts.find(l => l.id === defaultRt.pageLayoutId);
            if (rtLayout) {
              setSelectedLayoutId(rtLayout.id);
              return;
            }
          }
          // 2. Fallback: prefer a layout that has fields over an empty default
          const withFields = pageLayouts.find(l =>
            l.tabs?.some(t => t.sections?.some(s => (s.fields?.length || 0) > 0))
          );
          const best = withFields || pageLayouts[0];
          if (best) {
            setSelectedLayoutId(best.id);
          }
        }
      })();
    }
  }, [hasPageLayout, pageLayouts, selectedLayoutId, slug, objectDef]);

  // Load records from API
  useEffect(() => {
    const loadRecords = async () => {
      try {
        const apiName = objectDef?.apiName || slug;
        const apiRecords = await recordsService.getRecords(apiName);
        if (apiRecords && apiRecords.length > 0) {
          const flatRecords = apiRecords.map(r => recordsService.flattenRecord(r) as CustomRecord);
          setRecords(flatRecords);
        }
      } catch (error) {
        console.error('Failed to load records from API:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRecords();
  }, [storageKey, slug, objectDef]);

  // Load visible columns from preferences
  useEffect(() => {
    (async () => {
      const savedColumns = await getPreference<string[]>(`${slug}VisibleColumns`);
      if (savedColumns && Array.isArray(savedColumns)) {
        setVisibleColumns(savedColumns);
      } else {
        setVisibleColumns(AVAILABLE_COLUMNS.filter(c => c.defaultVisible).map(c => c.id));
      }
    })();
  }, [AVAILABLE_COLUMNS, slug]);

  // Save visible columns to preferences
  useEffect(() => {
    if (visibleColumns.length > 0) {
      setPreference(`${slug}VisibleColumns`, visibleColumns);
    }
  }, [visibleColumns, slug]);

  const handleNewRecord = () => {
    if (!hasPageLayout) {
      setShowNoLayoutsDialog(true);
      return;
    }

    // Prefer the layout assigned to the default record type (set by Page Editor)
    const defaultRt = objectDef?.defaultRecordTypeId
      ? objectDef.recordTypes?.find(r => r.id === objectDef.defaultRecordTypeId)
      : objectDef?.recordTypes?.[0];
    const rtLayout = defaultRt?.pageLayoutId
      ? pageLayouts.find(l => l.id === defaultRt.pageLayoutId)
      : null;

    // Filter to layouts that actually have fields
    const layoutsWithFields = pageLayouts.filter(l =>
      l.tabs?.some(t => t.sections?.some(s => (s.fields?.length || 0) > 0))
    );
    const effectiveLayouts = layoutsWithFields.length > 0 ? layoutsWithFields : pageLayouts;
    
    if (effectiveLayouts.length > 1) {
      // Pre-select the recordType-assigned layout if it has fields
      if (rtLayout && layoutsWithFields.some(l => l.id === rtLayout.id)) {
        setSelectedLayoutId(rtLayout.id);
      }
      setShowLayoutSelector(true);
    } else if (rtLayout) {
      setSelectedLayoutId(rtLayout.id);
      setShowDynamicForm(true);
    } else if (effectiveLayouts[0]) {
      setSelectedLayoutId(effectiveLayouts[0].id);
      setShowDynamicForm(true);
    }
  };

  const handleLayoutSelect = (layoutId: string) => {
    setSelectedLayoutId(layoutId);
    setPreference(`${slug}SelectedLayoutId`, layoutId);
    setShowLayoutSelector(false);
    setShowDynamicForm(true);
  };

  const getFieldValue = (record: CustomRecord, columnId: string): string => {
    const value = record[columnId];
    
    if (value === null || value === undefined) {
      return 'N/A';
    }

    // Check if the field definition indicates a LookupUser type
    const fieldDef = objectDef?.fields?.find(f => {
      const stripped = columnId.replace(/^[A-Za-z]+__/, '');
      return f.apiName === columnId || f.apiName.endsWith('__' + stripped);
    });
    if (fieldDef && (fieldDef.type === 'LookupUser' || (fieldDef.type === 'Lookup' && fieldDef.lookupObject === 'User'))) {
      return resolveLookupDisplayName(value, 'User');
    }
    
    // Check if this is a lookup field and resolve the display name
    const lookupObjectType = inferLookupObjectType(columnId);
    if (lookupObjectType && typeof value === 'string') {
      return resolveLookupDisplayName(value, lookupObjectType);
    }
    
    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'None';
    }
    
    if (typeof value === 'object') {
      return formatFieldValue(value);
    }
    
    return String(value);
  };

  const handleDynamicFormSubmit = async (data: Record<string, any>, layoutId?: string) => {
    const prefix = objectDef ? `${objectDef.apiName}__` : '';
    
    // Normalize field names by removing object prefix
    const normalizedData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      const cleanKey = key.startsWith(prefix) ? key.replace(prefix, '') : key;
      normalizedData[cleanKey] = value;
    });
    
    try {
      const apiName = objectDef?.apiName || slug;

      // Ensure the custom object exists in the database before creating records
      if (objectDef) {
        try {
          await apiClient.createObject({
            apiName: objectDef.apiName,
            label: objectDef.label,
            pluralLabel: objectDef.pluralLabel || objectDef.label,
          });
        } catch {
          // Object may already exist — that's fine
        }

        // Also ensure fields exist in the DB for this object
        try {
          for (const field of objectDef.fields) {
            const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
            if (!isSystemField && field.type !== 'Lookup' && field.type !== 'ExternalLookup') {
              await apiClient.createField(objectDef.apiName, {
                apiName: field.apiName,
                label: field.label,
                type: field.type || 'Text',
                required: field.required || false,
                unique: field.unique || false,
                readOnly: field.readOnly || false,
                picklistValues: field.picklistValues,
                defaultValue: field.defaultValue,
              }).catch(() => {}); // field may already exist
            }
          }
        } catch {
          // Non-fatal — fields best effort sync
        }
      }

      const result = await recordsService.createRecord(apiName, { data: normalizedData, pageLayoutId: layoutId || undefined });
      if (result) {
        const flatRecord = recordsService.flattenRecord(result) as CustomRecord;
        const updatedRecords = [flatRecord, ...records];
        setRecords(updatedRecords);
        setShowDynamicForm(false);
        setTimeout(() => {
          router.push(`/objects/${slug}/${result.id}`);
        }, 200);
      }
    } catch (error) {
      console.error('Failed to create record via API, falling back to localStorage:', error);
      const today = new Date().toISOString().split('T')[0];
      const newRecordId = String(Date.now());
      const currentUserName = user?.name || user?.email || 'System';
      const defaultRecordType = objectDef?.recordTypes?.[0];
      const newRecord: CustomRecord = {
        id: newRecordId,
        recordTypeId: defaultRecordType?.id,
        pageLayoutId: layoutId,
        createdBy: currentUserName,
        createdAt: today || '',
        lastModifiedBy: currentUserName,
        lastModifiedAt: today || '',
        ...normalizedData,
      };
      const updatedRecords = [newRecord, ...records];
      setRecords(updatedRecords);
      setShowDynamicForm(false);
      setTimeout(() => {
        router.push(`/objects/${slug}/${newRecordId}`);
      }, 200);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      try {
        const apiName = objectDef?.apiName || slug;
        await recordsService.deleteRecord(apiName, id);
      } catch (error) {
        console.error('Failed to delete via API:', error);
      }
      const updatedRecords = records.filter(r => r.id !== id);
      setRecords(updatedRecords);
    }
  };

  const handleToggleFavorite = (id: string) => {
    const updatedRecords = records.map(r => 
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    );
    setRecords(updatedRecords);
    setOpenDropdown(null);
  };

  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Filter and sort records
  const filteredRecords = useMemo(() => {
    let result = [...records];
    
    // Apply search filter
    if (searchTerm) {
      result = result.filter(record => 
        Object.values(record).some(value => 
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    // Apply sidebar filter
    const currentUserName = user?.name || user?.email || 'System';
    switch (sidebarFilter) {
      case 'recent':
        result = result.sort((a, b) => 
          new Date(b.lastModifiedAt || b.createdAt).getTime() - 
          new Date(a.lastModifiedAt || a.createdAt).getTime()
        ).slice(0, 10);
        break;
      case 'created-by-me':
        result = result.filter(r => r.createdBy === currentUserName);
        break;
      case 'favorites':
        result = result.filter(r => r.isFavorite);
        break;
    }
    
    // Apply sorting
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = String(a[sortColumn] || '');
        const bVal = String(b[sortColumn] || '');
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }
    
    return result;
  }, [records, searchTerm, sidebarFilter, sortColumn, sortDirection, user]);

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
    setPreference(`${slug}VisibleColumns`, visibleColumns);
  };

  const handleAddColumn = (columnId: string) => {
    if (!visibleColumns.includes(columnId)) {
      const newVisibleColumns = [...visibleColumns, columnId];
      setVisibleColumns(newVisibleColumns);
      setPreference(`${slug}VisibleColumns`, newVisibleColumns);
    }
    setShowAddColumn(false);
  };

  const handleRemoveColumn = (columnId: string) => {
    const newVisibleColumns = visibleColumns.filter(id => id !== columnId);
    setVisibleColumns(newVisibleColumns);
    setPreference(`${slug}VisibleColumns`, newVisibleColumns);
  };

  const handleResetColumns = () => {
    const defaultColumns = AVAILABLE_COLUMNS
      .filter(col => col.defaultVisible)
      .map(col => col.id);
    setVisibleColumns(defaultColumns);
    setPreference(`${slug}VisibleColumns`, defaultColumns);
  };

  // Show loading state
  if (loading || !schema) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading {slug}...</div>
      </div>
    );
  }

  // Show 404 if object not found
  if (!objectDef) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Object Not Found</h2>
          <p className="text-gray-600 mb-6">The object &quot;{slug}&quot; does not exist.</p>
          <Link
            href="/object-manager"
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
          >
            Go to Object Manager
          </Link>
        </div>
      </div>
    );
  }

  // Block access if the user doesn't have read permission on this object
  if (!canAccess(objectDef.apiName, 'read')) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">You don&apos;t have permission to view {objectDef.pluralLabel || objectDef.label}.</p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
          >
            Go to Home
          </Link>
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
                  <Database className="w-6 h-6 text-brand-navy" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">{objectDef.pluralLabel || objectDef.label}</h1>
              </div>
              <p className="text-sm text-gray-600 ml-13">Manage {objectDef.label.toLowerCase()} records</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{objectDef.pluralLabel || objectDef.label}</h3>
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
                  All {objectDef.pluralLabel || objectDef.label}
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
          <h3 className="text-lg font-medium text-gray-900">{objectDef.label} Records</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>
            {canCreate && <button
                onClick={handleNewRecord}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                New {objectDef.label}
              </button>}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder={`Search ${objectDef.label.toLowerCase()} records...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
            />
          </div>
        </div>

        {/* Records List */}
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
                {filteredRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/objects/${slug}/${record.id}`)}>
                    {visibleColumns.map((columnId, index) => {
                      const column = AVAILABLE_COLUMNS.find(col => col.id === columnId);
                      if (!column) return null;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm text-gray-900">
                          {index === 0 ? (
                            <Link href={`/objects/${slug}/${record.id}`} className="font-medium text-brand-navy hover:text-brand-dark">
                              {getFieldValue(record, column.id)}
                            </Link>
                          ) : (
                            getFieldValue(record, column.id)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-6 py-4 text-sm relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === record.id ? null : record.id)}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-5 h-5 text-gray-600" />
                      </button>
                      {openDropdown === record.id && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                          <div className="py-1">
                            {canEdit && <button
                              onClick={() => {
                                router.push(`/objects/${slug}/${record.id}`);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-brand-navy hover:bg-[#f0f1fa]"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>}
                            {canDelete && <button
                              onClick={() => {
                                handleDeleteRecord(record.id);
                                setOpenDropdown(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                              Delete
                            </button>}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleFavorite(record.id)}
                        className="p-1 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Star className={`w-5 h-5 ${record.isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredRecords.length === 0 && (
          <div className="text-center py-12">
            <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No {objectDef.label.toLowerCase()} found</h3>
            <p className="text-gray-600">
              {searchTerm ? 'Try adjusting your search.' : `Get started by creating your first ${objectDef.label.toLowerCase()}.`}
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
                    To create new {objectDef.label.toLowerCase()} records, you need to configure a page layout in the Page Editor first.
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
                href={`/object-manager/${objectDef.apiName}`}
                className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
                onClick={() => setShowNoLayoutsDialog(false)}
              >
                Go to Page Editor
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Layout Selector Dialog */}
      {showLayoutSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Select Page Layout</h2>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Choose a layout for the new {objectDef.label.toLowerCase()} record:
              </p>
              <div className="space-y-2">
                {pageLayouts.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => handleLayoutSelect(layout.id)}
                    className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-[#b8bfe8] transition-colors"
                  >
                    <div className="font-medium text-gray-900">{layout.name}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200">
              <button
                onClick={() => setShowLayoutSelector(false)}
                className="w-full px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
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

      {/* Dynamic Form Dialog */}
      {showDynamicForm && selectedLayoutId && (
        <DynamicFormDialog
          open={showDynamicForm}
          onOpenChange={setShowDynamicForm}
          objectApiName={objectDef.apiName}
          layoutType="create"
          layoutId={selectedLayoutId}
          onSubmit={handleDynamicFormSubmit}
        />
      )}
    </div>
    </div>
  );
}
