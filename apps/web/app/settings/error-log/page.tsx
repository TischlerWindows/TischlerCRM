'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle, RefreshCw, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

interface ErrorEntry {
  id: string;
  message: string;
  stack?: string;
  source: string;
  url?: string;
  userAgent?: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
  createdAt: string;
}

interface ErrorLogResponse {
  items: ErrorEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SOURCE_BADGES: Record<string, string> = {
  client: 'bg-blue-100 text-blue-700',
  server: 'bg-purple-100 text-purple-700',
};

function RelativeTime({ iso }: { iso: string }) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return <span>just now</span>;
  if (mins < 60) return <span>{mins}m ago</span>;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return <span>{hrs}h ago</span>;
  const days = Math.floor(hrs / 24);
  return <span>{days}d ago</span>;
}

function ErrorRow({ entry }: { entry: ErrorEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="mt-0.5 text-gray-400">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${SOURCE_BADGES[entry.source] || 'bg-gray-100 text-gray-600'}`}>
              {entry.source}
            </span>
            <span className="text-sm font-medium text-gray-900 truncate">{entry.message}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500">
            <RelativeTime iso={entry.createdAt} />
            {entry.userEmail && <span>{entry.userEmail}</span>}
            {entry.url && <span className="truncate max-w-[300px]">{entry.url.replace(/^https?:\/\/[^/]+/, '')}</span>}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pl-11 space-y-2">
          {entry.url && (
            <div>
              <span className="text-xs font-medium text-gray-500">URL: </span>
              <span className="text-xs text-gray-700 break-all">{entry.url}</span>
            </div>
          )}
          {entry.userAgent && (
            <div>
              <span className="text-xs font-medium text-gray-500">Browser: </span>
              <span className="text-xs text-gray-700 break-all">{entry.userAgent}</span>
            </div>
          )}
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-500">Metadata: </span>
              <pre className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-700 overflow-x-auto">{JSON.stringify(entry.metadata, null, 2)}</pre>
            </div>
          )}
          {entry.stack && (
            <div>
              <span className="text-xs font-medium text-gray-500">Stack trace:</span>
              <pre className="mt-1 rounded bg-gray-900 p-3 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap max-h-60">{entry.stack}</pre>
            </div>
          )}
          {entry.componentStack && (
            <div>
              <span className="text-xs font-medium text-gray-500">Component stack:</span>
              <pre className="mt-1 rounded bg-gray-50 p-2 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap max-h-40">{entry.componentStack}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ErrorLogPage() {
  const [data, setData] = useState<ErrorLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<string>('');

  const fetchErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50' });
      if (source) params.set('source', source);
      const res = await apiClient.get(`/admin/error-log?${params}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load error log:', err);
    } finally {
      setLoading(false);
    }
  }, [page, source]);

  useEffect(() => {
    fetchErrors();
  }, [fetchErrors]);

  const handleClear = async () => {
    if (!confirm('Clear all error logs?')) return;
    try {
      await apiClient.delete('/admin/error-log');
      fetchErrors();
    } catch (err) {
      console.error('Failed to clear error log:', err);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        icon={AlertTriangle}
        title="Error Log"
        description="Client-side errors reported by the application. Errors are stored in memory and cleared on server restart."
      />

      <SettingsContentCard>
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-3">
            <select
              value={source}
              onChange={(e) => { setSource(e.target.value); setPage(1); }}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs"
            >
              <option value="">All sources</option>
              <option value="client">Client</option>
              <option value="server">Server</option>
            </select>
            <span className="text-xs text-gray-500">
              {data ? `${data.total} error${data.total !== 1 ? 's' : ''}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchErrors}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
        ) : !data || data.items.length === 0 ? (
          <div className="p-8 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm text-gray-500">No errors recorded</p>
            <p className="text-xs text-gray-400">Errors will appear here when they occur in the application.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100">
              {data.items.map((entry) => (
                <ErrorRow key={entry.id} entry={entry} />
              ))}
            </div>

            {data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-500">
                  Page {data.page} of {data.totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage(page + 1)}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </SettingsContentCard>
    </div>
  );
}
