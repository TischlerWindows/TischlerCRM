'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsFilterBar } from '@/components/settings/settings-filter-bar';
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

export default function AuditLogPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [filterAction, setFilterAction] = useState('');
  const [filterObjectType, setFilterObjectType] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '50');
      if (filterAction) params.set('action', filterAction);
      if (filterObjectType) params.set('objectType', filterObjectType);
      const result = await apiClient.get<AuditResponse>(`/admin/audit-log?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterObjectType]);

  useEffect(() => { loadData(); }, [loadData]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

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

  return (
    <>
      <SettingsPageHeader icon={FileText} title="Audit Log" subtitle="Track all system activity and changes" />

      {error && (
        <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <SettingsFilterBar
        filters={[
          {
            value: filterAction,
            onChange: (v) => { setFilterAction(v); setPage(1); },
            options: [
              { value: '', label: 'All Actions' },
              ...Object.keys(ACTION_BADGES).map(a => ({ value: a, label: a })),
            ],
          },
          {
            value: filterObjectType,
            onChange: (v) => { setFilterObjectType(v); setPage(1); },
            options: [
              { value: '', label: 'All Types' },
              { value: 'User', label: 'User' },
              { value: 'Role', label: 'Role' },
              { value: 'Department', label: 'Department' },
            ],
          },
        ]}
      />

      <SettingsContentCard>
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading audit log...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No audit entries found</div>
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map(entry => (
                  <tr key={entry.id} className="group">
                    <td className="pl-3 py-3">
                      {(entry.before || entry.after) && (
                        <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="p-0.5 hover:bg-gray-100 rounded">
                          {expandedId === entry.id ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
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
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.objectName || entry.objectId.slice(0, 8)}</td>
                  </tr>
                ))}
                {data.items.map(entry => expandedId === entry.id && (entry.before || entry.after) && (
                  <tr key={`${entry.id}-detail`} className="bg-gray-50">
                    <td colSpan={6} className="px-8 py-3">
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        {entry.before && (
                          <div>
                            <div className="font-semibold text-gray-600 mb-1">Before</div>
                            <pre className="bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40">{JSON.stringify(entry.before, null, 2)}</pre>
                          </div>
                        )}
                        {entry.after && (
                          <div>
                            <div className="font-semibold text-gray-600 mb-1">After</div>
                            <pre className="bg-white p-2 rounded border border-gray-200 overflow-auto max-h-40">{JSON.stringify(entry.after, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  Showing {startItem}-{endItem} of {data.total}
                </div>
                <div className="flex gap-1">
                  {getPageNumbers().map((p, i, arr) => {
                    const showGap = i > 0 && p - arr[i - 1] > 1;
                    return (
                      <span key={p} className="flex items-center gap-1">
                        {showGap && <span className="px-1 text-xs text-gray-400">...</span>}
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
                </div>
              </div>
            )}
          </>
        )}
      </SettingsContentCard>
    </>
  );
}
