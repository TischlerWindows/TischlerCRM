'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Plus,
  Copy,
  Trash2,
  Users,
  ChevronRight,
  X,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';

interface ProfileRow {
  id: string;
  name: string;
  description: string | null;
  isSystemProfile: boolean;
  isActive: boolean;
  permissions: any;
  _count: { users: number };
}

const BUILTIN_OBJECTS = ['Property', 'Contact', 'Account', 'Product', 'Lead', 'Deal', 'Project', 'Service', 'Quote', 'Installation'];
const CRUD_ACTIONS = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];
const APP_PERMISSIONS = [
  { key: 'manageUsers', label: 'Manage Users' },
  { key: 'manageProfiles', label: 'Manage Profiles' },
  { key: 'manageRoles', label: 'Manage Roles' },
  { key: 'exportData', label: 'Export Data' },
  { key: 'importData', label: 'Import Data' },
  { key: 'manageReports', label: 'Manage Reports' },
  { key: 'manageDashboards', label: 'Manage Dashboards' },
  { key: 'viewSummary', label: 'View Summary' },
  { key: 'viewSetup', label: 'View Setup' },
  { key: 'customizeApplication', label: 'Customize Application' },
  { key: 'manageSharing', label: 'Manage Sharing' },
  { key: 'viewAllData', label: 'View All Data' },
  { key: 'modifyAllData', label: 'Modify All Data' },
];

export default function ProfilesPage() {
  const { schema, loadSchema } = useSchemaStore();
  const OBJECTS = schema
    ? schema.objects.map(o => o.apiName)
    : BUILTIN_OBJECTS;

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState<string | null>(null);
  const [editorProfile, setEditorProfile] = useState<ProfileRow | null>(null);
  const [editorTab, setEditorTab] = useState<'objects' | 'app'>('objects');
  const [editPerms, setEditPerms] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      if (!schema) loadSchema();
      const data = await apiClient.get<ProfileRow[]>('/profiles');
      setProfiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  const openEditor = async (profileId: string) => {
    try {
      const data = await apiClient.get<ProfileRow>(`/profiles/${profileId}`);
      setEditorProfile(data);
      setEditPerms(data.permissions || { objectPermissions: {}, appPermissions: {} });
      setEditorTab('objects');
      setShowEditor(profileId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    }
  };

  const toggleObjectPerm = (obj: string, action: string) => {
    setEditPerms((prev: any) => {
      const op = { ...(prev.objectPermissions || {}) };
      if (!op[obj]) op[obj] = {};
      op[obj] = { ...op[obj], [action]: !op[obj][action] };
      return { ...prev, objectPermissions: op };
    });
  };

  const toggleAppPerm = (key: string) => {
    setEditPerms((prev: any) => {
      const ap = { ...(prev.appPermissions || {}) };
      ap[key] = !ap[key];
      return { ...prev, appPermissions: ap };
    });
  };

  const savePermissions = async () => {
    if (!editorProfile) return;
    setSaving(true);
    try {
      await apiClient.put(`/profiles/${editorProfile.id}`, { permissions: editPerms });
      setSuccess('Profile permissions saved');
      setShowEditor(null);
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async () => {
    if (!showCloneModal || !cloneName) return;
    try {
      await apiClient.post(`/profiles/${showCloneModal}/clone`, { name: cloneName });
      setSuccess(`Profile cloned as "${cloneName}"`);
      setShowCloneModal(null);
      setCloneName('');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clone profile');
    }
  };

  const handleCreate = async () => {
    if (!createName) return;
    try {
      await apiClient.post('/profiles', { name: createName, description: createDesc || null });
      setSuccess(`Profile "${createName}" created`);
      setShowCreateModal(false);
      setCreateName('');
      setCreateDesc('');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create profile');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;
    try {
      await apiClient.delete(`/profiles/${id}`);
      setSuccess('Profile deleted');
      await loadProfiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete profile');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
            <Shield className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Profiles</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">Manage user profiles and their permissions</p>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error} <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">
          {success} <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="px-6 py-4 flex justify-end">
        <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Profile
        </button>
      </div>

      {/* Profiles List */}
      <div className="px-6 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading profiles...</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Profile Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Users</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profiles.map((profile) => (
                  <tr key={profile.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => openEditor(profile.id)} className="text-sm font-medium text-brand-navy hover:underline flex items-center gap-1">
                        {profile.isSystemProfile && <Lock className="w-3 h-3" />}
                        {profile.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{profile.description || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${profile.isSystemProfile ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                        {profile.isSystemProfile ? 'System' : 'Custom'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" />{profile._count.users}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditor(profile.id)} className="px-3 py-1 text-xs text-brand-navy hover:bg-brand-navy/10 rounded">Edit</button>
                        <button onClick={() => { setShowCloneModal(profile.id); setCloneName(''); }} className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1">
                          <Copy className="w-3 h-3" /> Clone
                        </button>
                        {!profile.isSystemProfile && (
                          <button onClick={() => handleDelete(profile.id)} className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Permission Editor Modal */}
      {showEditor && editorProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowEditor(null)}>
          <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{editorProfile.name}</h2>
                <p className="text-xs text-gray-500">{editorProfile.description}</p>
              </div>
              <button onClick={() => setShowEditor(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            {/* Tabs */}
            <div className="border-b px-6 flex gap-4">
              <button onClick={() => setEditorTab('objects')} className={`py-3 text-sm font-medium border-b-2 ${editorTab === 'objects' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                Object Permissions
              </button>
              <button onClick={() => setEditorTab('app')} className={`py-3 text-sm font-medium border-b-2 ${editorTab === 'app' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                App Permissions
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {editorTab === 'objects' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="py-2 text-left font-medium text-gray-700">Object</th>
                        {CRUD_ACTIONS.map((a) => (
                          <th key={a} className="py-2 text-center font-medium text-gray-700 capitalize">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {OBJECTS.map((obj) => (
                        <tr key={obj} className="border-b hover:bg-gray-50">
                          <td className="py-2 font-medium text-gray-900">{obj}</td>
                          {CRUD_ACTIONS.map((action) => (
                            <td key={action} className="py-2 text-center">
                              <input
                                type="checkbox"
                                checked={editPerms.objectPermissions?.[obj]?.[action] || false}
                                onChange={() => toggleObjectPerm(obj, action)}
                                className="w-4 h-4 text-brand-navy rounded border-gray-300 focus:ring-brand-navy cursor-pointer"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editorTab === 'app' && (
                <div className="space-y-3">
                  {APP_PERMISSIONS.map((perm) => (
                    <label key={perm.key} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editPerms.appPermissions?.[perm.key] || false}
                        onChange={() => toggleAppPerm(perm.key)}
                        className="w-4 h-4 text-brand-navy rounded border-gray-300 focus:ring-brand-navy"
                      />
                      <span className="text-sm font-medium text-gray-900">{perm.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setShowEditor(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={savePermissions} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCloneModal(null)}>
          <div className="bg-white rounded-lg w-full max-w-sm mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">Clone Profile</h2>
            </div>
            <div className="px-6 py-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">New Profile Name</label>
              <input value={cloneName} onChange={(e) => setCloneName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="My Custom Profile" />
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCloneModal(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleClone} disabled={!cloneName} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">Clone</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">New Profile</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={createName} onChange={(e) => setCreateName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={!createName} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
