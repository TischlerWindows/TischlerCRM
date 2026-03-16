'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <FileText className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">Track all changes to users, roles, departments, and records</p>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Actions</option>
            {Object.keys(ACTION_BADGES).map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={filterObjectType} onChange={e => { setFilterObjectType(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">All Types</option>
            <option value="User">User</option>
            <option value="Role">Role</option>
            <option value="Department">Department</option>
          </select>
        </div>
      </div>

      <div className="px-6 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading audit log...</div>
          ) : !data || data.items.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No audit entries found</div>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="w-8"></th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Timestamp</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
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
                    Page {data.page} of {data.totalPages} ({data.total} entries)
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
                      <ChevronLeft className="w-3.5 h-3.5" /> Prev
                    </button>
                    <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page >= data.totalPages} className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1">
                      Next <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
