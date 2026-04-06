'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  X,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

interface AuditEntry {
  id: string;
  actorId: string;
  actor: { id: string; name: string | null; email: string };
  action: string;
  objectType: string;
  objectId: string;
  objectName: string | null;
  before: any;
  after: any;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditResponse {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTION_BADGES: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  RESTORE: 'bg-purple-100 text-purple-700',
  FREEZE: 'bg-orange-100 text-orange-700',
  UNFREEZE: 'bg-teal-100 text-teal-700',
  RESET_PASSWORD: 'bg-yellow-100 text-yellow-800',
};

const OBJECT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'Property', label: 'Property' },
  { value: 'Contact', label: 'Contact' },
  { value: 'Account', label: 'Account' },
  { value: 'Lead', label: 'Lead' },
  { value: 'Opportunity', label: 'Opportunity' },
  { value: 'Project', label: 'Project' },
  { value: 'Product', label: 'Product' },
  { value: 'Quote', label: 'Quote' },
  { value: 'Service', label: 'Service' },
  { value: 'Installation', label: 'Installation' },
  { value: 'WorkOrder', label: 'Work Order' },
  { value: 'User', label: 'User' },
  { value: 'Profile', label: 'Profile' },
  { value: 'Department', label: 'Department' },
  { value: 'Integration', label: 'Integration' },
];

function formatDisplayValue(val: any): string {
  if (val === null || val === undefined) return '(empty)';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') {
    const parts = Object.values(val).filter(v => v != null && v !== '' && typeof v !== 'object');
    return parts.length > 0 ? parts.join(', ') : JSON.stringify(val);
  }
  return String(val);
}

function ChangeDiff({ before, after }: { before: any; after: any }) {
  if (!before && !after) return null;

  // UPDATE: show changed fields side-by-side
  if (before && after) {
    const allKeys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    const displayKeys = allKeys.filter(k => !k.startsWith('_'));
    if (displayKeys.length === 0) return <span className="text-xs text-gray-400">No visible changes</span>;

    return (
      <div className="space-y-2">
        {displayKeys.map(key => {
          const label = key.replace(/^[A-Za-z]+__/, '');
          return (
            <div key={key} className="bg-white rounded border border-gray-200 p-2">
              <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] uppercase">Before</span>
                  <div className="mt-0.5 text-red-600 bg-red-50 rounded px-1.5 py-0.5 break-all">
                    {formatDisplayValue(before[key])}
                  </div>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] uppercase">After</span>
                  <div className="mt-0.5 text-green-600 bg-green-50 rounded px-1.5 py-0.5 break-all">
                    {formatDisplayValue(after[key])}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // CREATE or DELETE: show single snapshot
  const snapshot = after || before;
  const label = after ? 'Created with' : 'Deleted record data';
  const entries = Object.entries(snapshot).filter(([k]) => !k.startsWith('_'));
  if (entries.length === 0) return null;
  return (
    <div className="bg-white rounded border border-gray-200 p-2 overflow-auto max-h-48">
      <div className="text-xs font-semibold text-gray-500 mb-1">{label}</div>
      <div className="space-y-1">
        {entries.slice(0, 20).map(([key, val]) => (
          <div key={key} className="flex text-xs gap-2">
            <span className="text-gray-500 min-w-[120px] truncate">{key.replace(/^[A-Za-z]+__/, '')}</span>
            <span className="text-gray-800 truncate">{formatDisplayValue(val)}</span>
          </div>
        ))}
        {entries.length > 20 && <div className="text-xs text-gray-400">... +{entries.length - 20} more fields</div>}
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [filterAction, setFilterAction] = useState('');
  const [filterObjectType, setFilterObjectType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '50');
      if (filterAction) params.set('action', filterAction);
      if (filterObjectType) params.set('objectType', filterObjectType);
      if (filterDateFrom) params.set('from', new Date(filterDateFrom).toISOString());
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59, 999);
        params.set('to', to.toISOString());
      }
      const result = await apiClient.get<AuditResponse>(`/admin/audit-log?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterObjectType, filterDateFrom, filterDateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const clearFilters = () => {
    setFilterAction('');
    setFilterObjectType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setPage(1);
  };

  const hasFilters = filterAction || filterObjectType || filterDateFrom || filterDateTo;

  const startItem = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const endItem = data ? Math.min(data.page * data.pageSize, data.total) : 0;

  const getPageNumbers = () => {
    if (!data || data.totalPages <= 1) return [];
    const pages: number[] = [];
    const total = data.totalPages;
    const current = data.page;
    const delta = 2;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        pages.push(i);
      }
    }
    return pages;
  };

  const selectClass = "py-2.5 pl-3.5 pr-8 border border-gray-200 rounded-[10px] text-[13px] text-gray-600 bg-gray-50/50 outline-none cursor-pointer focus:border-brand-navy focus:bg-white appearance-none bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%239f9fa2%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M6%209l6%206%206-6%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_12px_center]";

  return (
    <>
      <SettingsPageHeader icon={FileText} title="Audit Log" subtitle="Track all system activity and changes" />

      {error && (
        <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="px-8 py-4 bg-white flex items-center gap-3 flex-wrap">
        <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(1); }} className={selectClass}>
          <option value="">All Actions</option>
          {Object.keys(ACTION_BADGES).map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select value={filterObjectType} onChange={(e) => { setFilterObjectType(e.target.value); setPage(1); }} className={selectClass}>
          {OBJECT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={filterDateFrom}
            onChange={(e) => { setFilterDateFrom(e.target.value); setPage(1); }}
            className="py-2 px-3 border border-gray-200 rounded-[10px] text-[13px] text-gray-600 bg-gray-50/50 outline-none focus:border-brand-navy focus:bg-white"
          />
          <span className="text-xs text-gray-400">to</span>
          <input
            type="date"
            value={filterDateTo}
            onChange={(e) => { setFilterDateTo(e.target.value); setPage(1); }}
            className="py-2 px-3 border border-gray-200 rounded-[10px] text-[13px] text-gray-600 bg-gray-50/50 outline-none focus:border-brand-navy focus:bg-white"
          />
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 py-2 px-3 text-xs text-gray-500 hover:text-brand-navy hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-3.5 h-3.5" /> Clear filters
          </button>
        )}

        <button onClick={loadData} className="ml-auto flex items-center gap-1.5 py-2 px-3 text-xs text-gray-500 hover:text-brand-navy hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>

        {data && (
          <span className="text-xs text-brand-gray">{data.total} {data.total === 1 ? 'entry' : 'entries'}</span>
        )}
      </div>

      <SettingsContentCard>
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading audit log...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {hasFilters ? 'No entries match your filters' : 'No audit entries found'}
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="bg-[#fafafa] border-b border-gray-200">
                  <th className="w-8"></th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Timestamp</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Actor</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Action</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Type</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Name</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(entry => {
                  const isExpanded = expandedId === entry.id;
                  const hasDetail = entry.before || entry.after;
                  return (
                    <tr key={entry.id} className="group hover:bg-gray-50/50">
                      <td className="pl-3 py-3" rowSpan={isExpanded && hasDetail ? 2 : 1}>
                        {hasDetail && (
                          <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="p-0.5 hover:bg-gray-100 rounded">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{entry.actor.name || entry.actor.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${ACTION_BADGES[entry.action] || 'bg-gray-100 text-gray-700'}`}>
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{entry.objectType}</td>
                      <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px] truncate">{entry.objectName || entry.objectId.slice(0, 8)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{entry.ipAddress || '—'}</td>
                    </tr>
                  );
                })}
                {data.items.filter(e => expandedId === e.id && (e.before || e.after)).map(entry => (
                  <tr key={`${entry.id}-detail`} className="bg-gray-50/80">
                    <td colSpan={7} className="px-8 py-4">
                      <ChangeDiff before={entry.before} after={entry.after} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Showing {startItem}–{endItem} of {data.total}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="min-w-[32px] h-8 px-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ‹
                  </button>
                  {getPageNumbers().map((p, i, arr) => {
                    const showGap = i > 0 && p - arr[i - 1] > 1;
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showGap && <span className="px-1 text-xs text-gray-400">…</span>}
                        <button
                          onClick={() => setPage(p)}
                          className={`min-w-[32px] h-8 px-2 text-sm rounded-lg ${
                            p === page
                              ? 'bg-brand-navy text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    );
                  })}
                  <button
                    onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                    disabled={page === data.totalPages}
                    className="min-w-[32px] h-8 px-2 text-sm rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </SettingsContentCard>
    </>
  );
}
