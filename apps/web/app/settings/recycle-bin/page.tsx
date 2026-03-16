'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  Users,
  Building2,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface DeletedUser {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  deletedAt: string;
  deletedBy: { id: string; name: string | null; email: string } | null;
}

interface DeletedDepartment {
  id: string;
  name: string;
  description: string | null;
  deletedAt: string;
  deletedBy: { id: string; name: string | null; email: string } | null;
}

interface RecycleBinData {
  users: DeletedUser[];
  departments: DeletedDepartment[];
}

export default function RecycleBinPage() {
  const [data, setData] = useState<RecycleBinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'departments'>('users');
  const [restoring, setRestoring] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<RecycleBinData>('/admin/recycle-bin');
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recycle bin');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRestoreUser = async (user: DeletedUser) => {
    if (!confirm(`Restore user "${user.name || user.email}"?`)) return;
    setRestoring(user.id);
    try {
      await apiClient.post(`/admin/recycle-bin/users/${user.id}/restore`, {});
      setSuccess(`User "${user.name || user.email}" restored`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore user');
    } finally {
      setRestoring(null);
    }
  };

  const handleRestoreDept = async (dept: DeletedDepartment) => {
    if (!confirm(`Restore department "${dept.name}"?`)) return;
    setRestoring(dept.id);
    try {
      await apiClient.post(`/admin/recycle-bin/departments/${dept.id}/restore`, {});
      setSuccess(`Department "${dept.name}" restored`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore department');
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const userCount = data?.users.length || 0;
  const deptCount = data?.departments.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <Trash2 className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Recycle Bin</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">Restore deleted users and departments</p>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="px-6 pt-4">
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Users className="w-4 h-4" /> Deleted Users ({userCount})
          </button>
          <button
            onClick={() => setActiveTab('departments')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'departments' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Building2 className="w-4 h-4" /> Deleted Departments ({deptCount})
          </button>
        </div>
      </div>

      <div className="px-6 py-4 pb-8">
        {loading ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center text-gray-500">Loading...</div>
        ) : activeTab === 'users' ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {userCount === 0 ? (
              <div className="p-12 text-center text-gray-500">No deleted users</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deleted By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deleted At</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data!.users.map(user => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{user.name || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.deletedBy?.name || user.deletedBy?.email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.deletedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRestoreUser(user)}
                          disabled={restoring === user.id}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-brand-navy hover:bg-brand-navy/10 rounded transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {restoring === user.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {deptCount === 0 ? (
              <div className="p-12 text-center text-gray-500">No deleted departments</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deleted By</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Deleted At</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data!.departments.map(dept => (
                    <tr key={dept.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{dept.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{dept.description || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{dept.deletedBy?.name || dept.deletedBy?.email || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatDate(dept.deletedAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRestoreDept(dept)}
                          disabled={restoring === dept.id}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-brand-navy hover:bg-brand-navy/10 rounded transition-colors disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {restoring === dept.id ? 'Restoring...' : 'Restore'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
