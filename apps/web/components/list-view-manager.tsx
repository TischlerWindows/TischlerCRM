'use client';

import { useEffect, useState } from 'react';
import { Plus, Save, Trash2, X } from 'lucide-react';
import { getPreference, setPreference } from '@/lib/preferences';
import { useAuth } from '@/lib/auth-context';

export type ListViewOperator =
  | 'contains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'isEmpty'
  | 'isNotEmpty';

export interface ListViewField {
  id: string;
  label: string;
}

export interface ListViewCondition {
  field: string;
  operator: ListViewOperator;
  value: string;
}

export interface ListViewDefinition {
  id: string;
  name: string;
  filters: ListViewCondition[];
  sortField: string | null;
  sortDirection: 'asc' | 'desc';
}

interface StoredListViews {
  version?: number;
  views: ListViewDefinition[];
  selectedViewId: string;
}

interface UseListViewsOptions {
  objectApiName: string;
  onViewChange?: (view: ListViewDefinition) => void;
}

const ALL_RECORDS_VIEW: ListViewDefinition = {
  id: 'all-records',
  name: 'All Records',
  filters: [],
  sortField: null,
  sortDirection: 'asc',
};

const RECENTLY_VIEWED_VIEW: ListViewDefinition = {
  id: 'recently-viewed',
  name: 'Recently Viewed',
  filters: [],
  sortField: null,
  sortDirection: 'desc',
};

const RECENTLY_VIEWED_LIMIT = 500;

function preferenceKey(objectApiName: string): string {
  return `listViews_${objectApiName.toLowerCase()}`;
}

function recentlyViewedPreferenceKey(objectApiName: string): string {
  return `recentlyViewed_${objectApiName.toLowerCase()}`;
}

export async function markRecordRecentlyViewed(objectApiName: string, recordId: string): Promise<void> {
  if (!recordId) return;
  const key = recentlyViewedPreferenceKey(objectApiName);
  const recentRecords = await getPreference<Record<string, number>>(key, {});
  const updated = { ...recentRecords, [recordId]: Date.now() };
  const bounded = Object.fromEntries(
    Object.entries(updated)
      .sort(([, left], [, right]) => right - left)
      .slice(0, RECENTLY_VIEWED_LIMIT),
  );
  await setPreference(key, bounded);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm:recent-record-viewed', {
      detail: { objectApiName: objectApiName.toLowerCase(), recordId, viewedAt: updated[recordId] },
    }));
  }
}

export function useListViews({ objectApiName, onViewChange }: UseListViewsOptions) {
  const { user } = useAuth();
  const [views, setViews] = useState<ListViewDefinition[]>([RECENTLY_VIEWED_VIEW, ALL_RECORDS_VIEW]);
  const [selectedViewId, setSelectedViewId] = useState(RECENTLY_VIEWED_VIEW.id);
  const [recentlyViewedAt, setRecentlyViewedAt] = useState<Record<string, number>>({});
  const [loaded, setLoaded] = useState(false);
  const activeView = views.find(view => view.id === selectedViewId) ?? ALL_RECORDS_VIEW;
  const key = preferenceKey(objectApiName);
  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setViews([RECENTLY_VIEWED_VIEW, ALL_RECORDS_VIEW]);
    setSelectedViewId(RECENTLY_VIEWED_VIEW.id);
    Promise.all([
      getPreference<StoredListViews>(key),
      getPreference<Record<string, number>>(recentlyViewedPreferenceKey(objectApiName), {}),
    ]).then(([saved, recentRecords]) => {
      if (cancelled) return;
      const storedViews = Array.isArray(saved?.views)
        ? saved.views.filter(view => view && typeof view.id === 'string' && typeof view.name === 'string')
        : [];
      const savedAllRecordsView = storedViews.find(view => view.id === ALL_RECORDS_VIEW.id);
      const allRecordsView = savedAllRecordsView
        ? {
            ...ALL_RECORDS_VIEW,
            filters: Array.isArray(savedAllRecordsView.filters) ? savedAllRecordsView.filters : [],
            sortField: typeof savedAllRecordsView.sortField === 'string' ? savedAllRecordsView.sortField : null,
            sortDirection: savedAllRecordsView.sortDirection === 'desc' ? 'desc' as const : 'asc' as const,
          }
        : ALL_RECORDS_VIEW;
      const nextViews = [
        RECENTLY_VIEWED_VIEW,
        allRecordsView,
        ...storedViews.filter(view => view.id !== ALL_RECORDS_VIEW.id && view.id !== RECENTLY_VIEWED_VIEW.id),
      ];
      const previousSelection = saved?.version === 2
        ? saved.selectedViewId
        : saved?.selectedViewId === ALL_RECORDS_VIEW.id
          ? RECENTLY_VIEWED_VIEW.id
          : saved?.selectedViewId;
      const nextSelectedId = nextViews.some(view => view.id === previousSelection)
        ? previousSelection!
        : RECENTLY_VIEWED_VIEW.id;
      setViews(nextViews);
      setSelectedViewId(nextSelectedId);
      setRecentlyViewedAt(recentRecords ?? {});
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [key, objectApiName, userId]);

  useEffect(() => {
    const handleRecentlyViewed = (event: Event) => {
      const detail = (event as CustomEvent<{ objectApiName: string; recordId: string; viewedAt: number }>).detail;
      if (detail?.objectApiName === objectApiName.toLowerCase()) {
        setRecentlyViewedAt(current => ({ ...current, [detail.recordId]: detail.viewedAt }));
      }
    };
    window.addEventListener('crm:recent-record-viewed', handleRecentlyViewed);
    return () => window.removeEventListener('crm:recent-record-viewed', handleRecentlyViewed);
  }, [objectApiName]);

  useEffect(() => {
    if (loaded) onViewChange?.(activeView);
  }, [activeView, loaded, onViewChange]);

  const persist = (nextViews: ListViewDefinition[], nextSelectedId: string) => {
    setViews(nextViews);
    setSelectedViewId(nextSelectedId);
    setPreference(key, { version: 2, views: nextViews, selectedViewId: nextSelectedId });
  };

  const selectView = (id: string) => {
    if (!views.some(view => view.id === id)) return;
    persist(views, id);
  };

  const saveView = (view: ListViewDefinition) => {
    if (view.id === RECENTLY_VIEWED_VIEW.id) return;
    const existingIndex = views.findIndex(item => item.id === view.id);
    const nextViews = [...views];
    if (existingIndex >= 0) nextViews[existingIndex] = view;
    else nextViews.push(view);
    persist(nextViews, view.id);
  };

  const deleteView = (id: string) => {
    if (id === ALL_RECORDS_VIEW.id || id === RECENTLY_VIEWED_VIEW.id) return;
    const nextViews = views.filter(view => view.id !== id);
    persist(nextViews, ALL_RECORDS_VIEW.id);
  };

  const sortFromColumn = (field: string): 'asc' | 'desc' => {
    if (activeView.id === RECENTLY_VIEWED_VIEW.id) return 'desc';
    const direction = activeView.sortField === field && activeView.sortDirection === 'asc'
      ? 'desc'
      : 'asc';
    saveView({ ...activeView, sortField: field, sortDirection: direction });
    return direction;
  };

  return { views, activeView, loaded, recentlyViewedAt, selectView, saveView, deleteView, sortFromColumn };
}

function comparableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.map(comparableValue).join(', ').toLowerCase();
  if (typeof value === 'object') return JSON.stringify(value).toLowerCase();
  return String(value).trim().toLowerCase();
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (String(left).trim() !== '' && String(right).trim() !== '' && Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return comparableValue(left).localeCompare(comparableValue(right), undefined, { numeric: true });
}

function matchesCondition(record: Record<string, unknown>, condition: ListViewCondition): boolean {
  const rawValue = record[condition.field];
  const value = comparableValue(rawValue);
  const expected = condition.value.trim().toLowerCase();
  switch (condition.operator) {
    case 'contains': return value.includes(expected);
    case 'equals': return value === expected;
    case 'notEquals': return value !== expected;
    case 'startsWith': return value.startsWith(expected);
    case 'greaterThan': return compareValues(rawValue, condition.value) > 0;
    case 'lessThan': return compareValues(rawValue, condition.value) < 0;
    case 'isEmpty': return value === '';
    case 'isNotEmpty': return value !== '';
  }
}

export function applyListView<T extends object>(
  records: T[],
  view: ListViewDefinition | null,
  recentlyViewedAt: Record<string, number> = {},
): T[] {
  if (!view) return records;
  if (view.id === RECENTLY_VIEWED_VIEW.id) {
    const recordKey = (record: T): string => {
      const value = record as Record<string, unknown>;
      if (typeof value.id === 'string') return value.id;
      if (typeof value.category === 'string' && typeof value.productType === 'string') {
        return `${value.category}::${value.productType}`;
      }
      return '';
    };
    return records
      .filter(record => recentlyViewedAt[recordKey(record)] !== undefined)
      .sort((left, right) => recentlyViewedAt[recordKey(right)] - recentlyViewedAt[recordKey(left)]);
  }
  const filtered = records.filter(record => view.filters.every(condition =>
    matchesCondition(record as Record<string, unknown>, condition),
  ));
  if (!view.sortField) return filtered;
  return filtered.sort((left, right) => {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const comparison = compareValues(leftRecord[view.sortField!], rightRecord[view.sortField!]);
    return view.sortDirection === 'asc' ? comparison : -comparison;
  });
}

interface ListViewManagerProps {
  fields: ListViewField[];
  views: ListViewDefinition[];
  activeView: ListViewDefinition;
  canManage: boolean;
  onSelect: (id: string) => void;
  onSave: (view: ListViewDefinition) => void;
  onDelete: (id: string) => void;
}

const OPERATORS: { value: ListViewOperator; label: string }[] = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'notEquals', label: 'does not equal' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'greaterThan', label: 'greater than' },
  { value: 'lessThan', label: 'less than' },
  { value: 'isEmpty', label: 'is blank' },
  { value: 'isNotEmpty', label: 'is not blank' },
];

const inputClass = 'rounded border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-800';

export function ListViewManager({
  fields,
  views,
  activeView,
  canManage,
  onSelect,
  onSave,
  onDelete,
}: ListViewManagerProps) {
  const [editingMode, setEditingMode] = useState<'new' | 'filter' | 'sort' | null>(null);
  const [draft, setDraft] = useState<ListViewDefinition>(activeView);
  const [error, setError] = useState('');

  const openNew = () => {
    setDraft({ id: '', name: '', filters: [], sortField: null, sortDirection: 'asc' });
    setError('');
    setEditingMode('new');
  };

  const openEdit = (mode: 'filter' | 'sort') => {
    setDraft({ ...activeView, filters: activeView.filters.map(filter => ({ ...filter })) });
    setError('');
    setEditingMode(mode);
  };

  const saveDraft = () => {
    const name = draft.id === ALL_RECORDS_VIEW.id ? ALL_RECORDS_VIEW.name : draft.name.trim();
    if (!name) {
      setError('Enter a name for this list view.');
      return;
    }
    const id = draft.id || globalThis.crypto?.randomUUID?.() || `view-${Date.now()}`;
    onSave({ ...draft, id, name });
    setEditingMode(null);
  };

  const closeEditor = () => setEditingMode(null);

  const updateFilter = (index: number, changes: Partial<ListViewCondition>) => {
    setDraft(current => ({
      ...current,
      filters: current.filters.map((filter, filterIndex) =>
        filterIndex === index ? { ...filter, ...changes } : filter,
      ),
    }));
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <label className="text-sm font-medium text-gray-700" htmlFor={`list-view-${activeView.id}`}>List View</label>
          <select
            id={`list-view-${activeView.id}`}
            className={`${inputClass} min-w-48 max-w-full`}
            value={activeView.id}
            onChange={event => onSelect(event.target.value)}
          >
            {views.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
          </select>
        </div>
        {canManage && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={openNew} className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              <Plus className="h-4 w-4" /> New List View
            </button>
            {activeView.id !== RECENTLY_VIEWED_VIEW.id && <button type="button" onClick={() => openEdit('filter')} className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Filter</button>}
            {activeView.id !== RECENTLY_VIEWED_VIEW.id && <button type="button" onClick={() => openEdit('sort')} className="rounded border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Column Sort</button>}
            {activeView.id !== ALL_RECORDS_VIEW.id && activeView.id !== RECENTLY_VIEWED_VIEW.id && (
              <button type="button" onClick={() => onDelete(activeView.id)} className="inline-flex items-center gap-1 rounded border border-gray-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> Delete View
              </button>
            )}
          </div>
        )}
      </div>

      {editingMode && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={closeEditor}>
          <div role="dialog" aria-modal="true" aria-labelledby="list-view-title" className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 id="list-view-title" className="text-lg font-semibold text-gray-900">
                {editingMode === 'new' ? 'New List View' : editingMode === 'filter' ? 'Edit Filters' : 'Column Sort'}
              </h2>
              <button type="button" aria-label="Close" onClick={closeEditor} className="rounded p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-5 overflow-y-auto px-5 py-4">
              {editingMode !== 'sort' && (
                <label className="block text-sm font-medium text-gray-700">
                  View name
                  {draft.id === ALL_RECORDS_VIEW.id ? (
                    <span className={`${inputClass} mt-1 block w-full bg-gray-50`}>{ALL_RECORDS_VIEW.name}</span>
                  ) : (
                    <input className={`${inputClass} mt-1 block w-full`} value={draft.name} onChange={event => setDraft(current => ({ ...current, name: event.target.value }))} maxLength={80} />
                  )}
                </label>
              )}
              {(editingMode === 'new' || editingMode === 'filter') && <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">Filters</h3>
                  <button type="button" onClick={() => setDraft(current => ({ ...current, filters: [...current.filters, { field: fields[0]?.id ?? '', operator: 'contains', value: '' }] }))} disabled={fields.length === 0} className="inline-flex items-center gap-1 text-sm font-medium text-brand-navy disabled:opacity-50"><Plus className="h-4 w-4" /> Add Filter</button>
                </div>
                <div className="space-y-2">
                  {draft.filters.map((filter, index) => (
                    <div key={`${index}-${filter.field}`} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                      <select aria-label="Filter field" className={inputClass} value={filter.field} onChange={event => updateFilter(index, { field: event.target.value })}>
                        {fields.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}
                      </select>
                      <select aria-label="Filter operator" className={inputClass} value={filter.operator} onChange={event => updateFilter(index, { operator: event.target.value as ListViewOperator })}>
                        {OPERATORS.map(operator => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                      </select>
                      {filter.operator !== 'isEmpty' && filter.operator !== 'isNotEmpty' ? (
                        <input aria-label="Filter value" className={inputClass} value={filter.value} onChange={event => updateFilter(index, { value: event.target.value })} />
                      ) : <span />}
                      <button type="button" aria-label="Remove filter" onClick={() => setDraft(current => ({ ...current, filters: current.filters.filter((_, filterIndex) => filterIndex !== index) }))} className="rounded border border-gray-300 p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
                    </div>
                  ))}
                  {draft.filters.length === 0 && <p className="text-sm text-gray-500">No filters. This view shows all matching records.</p>}
                </div>
              </section>}
              {(editingMode === 'new' || editingMode === 'sort') && <section className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
                <label className="text-sm font-medium text-gray-700">
                  Sort by
                  <select className={`${inputClass} mt-1 block w-full`} value={draft.sortField ?? ''} onChange={event => setDraft(current => ({ ...current, sortField: event.target.value || null }))}>
                    <option value="">No list-view sort</option>
                    {fields.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}
                  </select>
                </label>
                <label className="text-sm font-medium text-gray-700">
                  Direction
                  <select className={`${inputClass} mt-1 block w-full`} value={draft.sortDirection} onChange={event => setDraft(current => ({ ...current, sortDirection: event.target.value as 'asc' | 'desc' }))}>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
              </section>}
              {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
              <button type="button" onClick={closeEditor} className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-dark"><Save className="h-4 w-4" /> Save View</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}