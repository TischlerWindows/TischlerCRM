'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

interface LoginEvent {
  id: string;
  ip: string;
  userAgent: string | null;
  accountId: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('token') ||
    localStorage.getItem('authToken') ||
    localStorage.getItem('jwt')
  );
}

export default function SecuritySettingsPage() {
  const [events, setEvents] = useState<LoginEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const token = getAuthToken();
        const res = await fetch(`${apiBase}/security/login-events`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          const msg = body?.error || `Request failed (${res.status})`;
          throw new Error(msg);
        }
        const data = (await res.json()) as LoginEvent[];
        if (!cancelled) setEvents(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load login history');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [apiBase, refreshKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Security</h1>
                <p className="text-sm text-gray-600">Login history and access monitoring</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Login History</h2>
              <p className="text-sm text-gray-500">Recent successful logins with IP and account context.</p>
            </div>
            <button
              onClick={() => setRefreshKey((k) => k + 1)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-6 text-sm text-gray-600">Loading login history…</div>
          ) : error ? (
            <div className="p-6">
              <div className="flex items-start gap-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <div>
                  <div className="font-medium">Unable to load login history</div>
                  <div className="mt-1">{error}</div>
                  {!getAuthToken() && (
                    <div className="mt-2 text-amber-800">No auth token found in local storage.</div>
                  )}
                </div>
              </div>
            </div>
          ) : events.length === 0 ? (
            <div className="p-6 text-sm text-gray-600">No login events found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="text-left font-medium px-6 py-3">Time</th>
                    <th className="text-left font-medium px-6 py-3">User</th>
                    <th className="text-left font-medium px-6 py-3">Email</th>
                    <th className="text-left font-medium px-6 py-3">Role</th>
                    <th className="text-left font-medium px-6 py-3">Account</th>
                    <th className="text-left font-medium px-6 py-3">IP</th>
                    <th className="text-left font-medium px-6 py-3">User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-t border-gray-200">
                      <td className="px-6 py-3 text-gray-700">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-gray-900 font-medium">
                        {event.user.name || '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-700">{event.user.email}</td>
                      <td className="px-6 py-3 text-gray-700">{event.user.role}</td>
                      <td className="px-6 py-3 text-gray-700">{event.accountId || '—'}</td>
                      <td className="px-6 py-3 text-gray-700">{event.ip}</td>
                      <td className="px-6 py-3 text-gray-500 max-w-sm truncate" title={event.userAgent || ''}>
                        {event.userAgent || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
