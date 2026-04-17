'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  Users,
  Building2,
  Database,
  X,
  AlertTriangle,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

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

interface DeletedRecord {
  id: string;
  name: string;
  objectApiName: string;
  objectLabel: string;
  deletedAt: string;
  deletedBy: { id: string; name: string | null; email: string } | null;
}

interface RecycleBinData {
  users: DeletedUser[];
  departments: DeletedDepartment[];
  records: DeletedRecord[];
}

export default function RecycleBinPage() {
  const [data, setData] = useState<RecycleBinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'records' | 'users' | 'departments'>('records');
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

  const handleRestoreRecord = async (record: DeletedRecord) => {
    if (!confirm(`Restore ${record.objectLabel} "${record.name}"?`)) return;
    setRestoring(record.id);
    try {
      await apiClient.post(`/admin/recycle-bin/records/${record.id}/restore`, {});
      setSuccess(`${record.objectLabel} "${record.name}" restored`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore record');
    } finally {
      setRestoring(null);
    }
  };

  const handlePermanentDelete = async (record: DeletedRecord) => {
    if (!confirm(`Permanently delete ${record.objectLabel} "${record.name}"? This cannot be undone.`)) return;
    setRestoring(record.id);
    try {
      await apiClient.delete(`/admin/recycle-bin/records/${record.id}`);
      setSuccess(`${record.objectLabel} "${record.name}" permanently deleted`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
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
  const recordCount = data?.records.length || 0;

  return (
    <>
      <SettingsPageHeader icon={Trash2} title="Recycle Bin" subtitle="Restore deleted records" />

      {error && (
        <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-8 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <SettingsContentCard>
        <div className="px-6 pt-4">
          <div className="flex gap-1 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('records')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'records' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              <Database className="w-4 h-4" /> Deleted Records ({recordCount})
            </button>
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
          ) : activeTab === 'records' ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {recordCount === 0 ? (
                <div className="p-12 text-center text-gray-500">No deleted records</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Name</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Object</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Deleted By</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Deleted At</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data!.records.map(record => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium">{record.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.objectLabel}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.deletedBy?.name || record.deletedBy?.email || '—'}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(record.deletedAt)}</td>
                        <td className="px-4 py-3 text-right flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleRestoreRecord(record)}
                            disabled={restoring === record.id}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-brand-navy hover:bg-brand-navy/10 rounded transition-colors disabled:opacity-50"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {restoring === record.id ? 'Restoring...' : 'Restore'}
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(record)}
                            disabled={restoring === record.id}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : activeTab === 'users' ? (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {userCount === 0 ? (
                <div className="p-12 text-center text-gray-500">No deleted users</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Name</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Email</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Deleted By</th>
                      <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Deleted At</th>
                      <th className="px-4 py-3 text-right text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Action</th>
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
                  <tr className="bg-[#fafafa] border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Name</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Description</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Deleted By</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Deleted At</th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Action</th>
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
      </SettingsContentCard>
    </>
  );
}
