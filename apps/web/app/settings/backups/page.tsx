'use client';

import { useEffect, useState } from 'react';
import {
  Database,
  Download,
  Trash2,
  RotateCcw,
  Plus,
  RefreshCw,
  HardDrive,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

interface Backup {
  id: string;
  name: string;
  sizeMB: string;
  tables: Record<string, number>;
  status: string;
  createdById: string;
  createdAt: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBackups = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getBackups();
      setBackups(result.backups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load backups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleCreateBackup = async () => {
    setCreating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await apiClient.createBackup();
      setSuccessMessage(`Backup created successfully (${result.sizeMB} MB)`);
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setCreating(false);
    }
  };

  const handleDownload = async (backup: Backup) => {
    try {
      const data = await apiClient.downloadBackup(backup.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${backup.name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download backup');
    }
  };

  const handleDelete = async (backup: Backup) => {
    if (!confirm(`Are you sure you want to delete "${backup.name}"? This cannot be undone.`)) return;
    setDeleting(backup.id);
    setError(null);
    try {
      await apiClient.deleteBackup(backup.id);
      setSuccessMessage('Backup deleted');
      await loadBackups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    } finally {
      setDeleting(null);
    }
  };

  const handleRestore = async (backup: Backup) => {
    if (!confirm(`⚠️ RESTORE FROM BACKUP\n\nThis will replace ALL current data with the data from:\n"${backup.name}"\n\nThis action cannot be undone. Are you sure?`)) return;
    if (!confirm('This is your final confirmation. Proceed with restore?')) return;

    setRestoring(backup.id);
    setError(null);
    setSuccessMessage(null);
    try {
      await apiClient.restoreBackup(backup.id);
      setSuccessMessage('Database restored successfully. Reload the page to see updated data.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setRestoring(null);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  const totalRecords = (tables: Record<string, number>) => {
    return Object.values(tables).reduce((sum, count) => sum + count, 0);
  };

  return (
    <>
      <SettingsPageHeader
        icon={Database}
        title="Database Backups"
        subtitle="Create, download, and restore database snapshots"
        action={{
          label: 'Create Backup',
          icon: Plus,
          onClick: handleCreateBackup,
        }}
      />

      {/* Messages */}
      {successMessage && (
        <div className="mx-8 mt-6 flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          <span className="text-sm text-green-800">{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-auto text-green-600 hover:text-green-800 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="mx-8 mt-6 flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-600 hover:text-red-800 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Info Card */}
      <SettingsContentCard>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-brand-navy mt-0.5 flex-shrink-0" />
            <div className="text-sm text-brand-dark">
              <p className="font-medium mb-1">How backups work</p>
              <ul className="list-disc list-inside space-y-1 text-brand-navy">
                <li>Each backup is a full snapshot of your database (objects, records, fields, layouts, reports, dashboards)</li>
                <li>Backups are stored securely in your database — up to 30 are retained automatically</li>
                <li>You can download any backup as a JSON file for offline storage</li>
                <li>Restoring a backup replaces all current data with the backup&apos;s data (users are preserved)</li>
              </ul>
            </div>
          </div>
        </div>
      </SettingsContentCard>

      {/* Backups Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-navy animate-spin" />
        </div>
      ) : backups.length === 0 ? (
        <SettingsContentCard>
          <div className="p-12 text-center">
            <HardDrive className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No backups yet</h3>
            <p className="text-gray-600 mb-6">
              Create your first backup to protect your data.
            </p>
            <button
              onClick={handleCreateBackup}
              disabled={creating}
              className="inline-flex items-center px-4 py-2 bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark text-sm font-medium disabled:opacity-50"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              Create Backup
            </button>
          </div>
        </SettingsContentCard>
      ) : (
        <SettingsContentCard>
          <table className="w-full">
            <thead>
              <tr className="bg-[#fafafa] border-b border-gray-200">
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                  Backup
                </th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                  Date
                </th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                  Size
                </th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                  Records
                </th>
                <th className="text-left px-6 py-3 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                  Status
                </th>
                <th className="text-right px-6 py-3 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Database className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{backup.name}</div>
                        <div className="text-xs text-gray-500">
                          {backup.tables && typeof backup.tables === 'object'
                            ? Object.entries(backup.tables)
                                .filter(([, count]) => (count as number) > 0)
                                .map(([table, count]) => `${count} ${table}`)
                                .join(', ')
                            : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      {formatDate(backup.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700">{backup.sizeMB} MB</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-gray-700">
                      {backup.tables ? totalRecords(backup.tables).toLocaleString() : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircle2 className="w-3 h-3" />
                      {backup.status || 'Completed'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => handleDownload(backup)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50"
                        title="Download backup"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" />
                        Download
                      </button>
                      <button
                        onClick={() => handleRestore(backup)}
                        disabled={restoring === backup.id}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-amber-700 border border-amber-300 rounded-md hover:bg-amber-50 disabled:opacity-50"
                        title="Restore from this backup"
                      >
                        {restoring === backup.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        )}
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(backup)}
                        disabled={deleting === backup.id}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
                        title="Delete backup"
                      >
                        {deleting === backup.id ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SettingsContentCard>
      )}

      {/* Storage Usage */}
      {backups.length > 0 && (
        <SettingsContentCard>
          <div className="p-6">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Storage Summary</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-2xl font-bold text-gray-900">{backups.length}</p>
                <p className="text-sm text-gray-600">Total Backups</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {backups.reduce((sum, b) => sum + parseFloat(b.sizeMB || '0'), 0).toFixed(2)} MB
                </p>
                <p className="text-sm text-gray-600">Total Storage Used</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">30</p>
                <p className="text-sm text-gray-600">Max Backups Retained</p>
              </div>
            </div>
          </div>
        </SettingsContentCard>
      )}
    </>
  );
}
