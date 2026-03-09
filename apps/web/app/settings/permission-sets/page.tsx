'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Key,
  Plus,
  Trash2,
  Users,
  X,
  UserPlus,
  UserMinus,
  Search,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';

interface PermissionSetRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: any;
  _count: { assignments: number };
}

interface PermSetDetail extends PermissionSetRow {
  assignments: {
    id: string;
    userId: string;
    user: { id: string; name: string | null; email: string; isActive: boolean };
  }[];
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
}

const BUILTIN_OBJECTS = ['Property', 'Contact', 'Account', 'Product', 'Lead', 'Deal', 'Project', 'Service', 'Quote', 'Installation'];
const CRUD_ACTIONS = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];

export default function PermissionSetsPage() {
  const { schema, loadSchema } = useSchemaStore();
  const OBJECTS = schema
    ? schema.objects.map(o => o.apiName)
    : BUILTIN_OBJECTS;

  const [sets, setSets] = useState<PermissionSetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  const [showEditor, setShowEditor] = useState<string | null>(null);
  const [editorData, setEditorData] = useState<PermSetDetail | null>(null);
  const [editPerms, setEditPerms] = useState<any>({});
  const [editorTab, setEditorTab] = useState<'perms' | 'users'>('perms');
  const [saving, setSaving] = useState(false);

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [assignSearch, setAssignSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!schema) loadSchema();
      const data = await apiClient.get<PermissionSetRow[]>('/permission-sets');
      setSets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permission sets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!createName) return;
    try {
      await apiClient.post('/permission-sets', { name: createName, description: createDesc || null });
      setSuccess(`Permission set "${createName}" created`);
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this permission set?')) return;
    try {
      await apiClient.delete(`/permission-sets/${id}`);
      setSuccess('Permission set deleted');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const openEditor = async (id: string) => {
    try {
      const [detail, users] = await Promise.all([
        apiClient.get<PermSetDetail>(`/permission-sets/${id}`),
        apiClient.get<UserOption[]>('/admin/users'),
      ]);
      setEditorData(detail);
      setEditPerms(detail.permissions || { objectPermissions: {} });
      setAllUsers(users);
      setEditorTab('perms');
      setShowEditor(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
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

  const savePerms = async () => {
    if (!showEditor) return;
    setSaving(true);
    try {
      await apiClient.put(`/permission-sets/${showEditor}`, { permissions: editPerms });
      setSuccess('Permission set saved');
      setShowEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const assignUser = async (userId: string) => {
    if (!showEditor) return;
    try {
      await apiClient.post(`/permission-sets/${showEditor}/assign`, { userIds: [userId] });
      // Refresh detail
      const detail = await apiClient.get<PermSetDetail>(`/permission-sets/${showEditor}`);
      setEditorData(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign user');
    }
  };

  const unassignUser = async (userId: string) => {
    if (!showEditor) return;
    try {
      await apiClient.delete(`/permission-sets/${showEditor}/assign/${userId}`);
      const detail = await apiClient.get<PermSetDetail>(`/permission-sets/${showEditor}`);
      setEditorData(detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    }
  };

  const assignedUserIds = new Set(editorData?.assignments?.map((a) => a.userId) || []);
  const unassignedUsers = allUsers.filter((u) => {
    if (assignedUserIds.has(u.id)) return false;
    if (assignSearch) {
      const q = assignSearch.toLowerCase();
      return u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
            <Key className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Permission Sets</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">Grant additional permissions beyond profiles</p>
        </div>
      </div>

      {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}
      {success && <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">{success}<button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button></div>}

      <div className="px-6 py-4 flex justify-end">
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Permission Set
        </button>
      </div>

      <div className="px-6 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : sets.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No permission sets yet</div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assigned Users</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sets.map((ps) => (
                  <tr key={ps.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <button onClick={() => openEditor(ps.id)} className="text-sm font-medium text-brand-navy hover:underline">{ps.name}</button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{ps.description || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 flex items-center gap-1"><Users className="w-3.5 h-3.5 text-gray-400" />{ps._count.assignments}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditor(ps.id)} className="px-3 py-1 text-xs text-brand-navy hover:bg-brand-navy/10 rounded">Edit</button>
                        <button onClick={() => handleDelete(ps.id)} className="px-3 py-1 text-xs text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Editor Modal */}
      {showEditor && editorData && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowEditor(null)}>
          <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{editorData.name}</h2>
                <p className="text-xs text-gray-500">{editorData.description}</p>
              </div>
              <button onClick={() => setShowEditor(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="border-b px-6 flex gap-4">
              <button onClick={() => setEditorTab('perms')} className={`py-3 text-sm font-medium border-b-2 ${editorTab === 'perms' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500'}`}>
                Object Permissions
              </button>
              <button onClick={() => setEditorTab('users')} className={`py-3 text-sm font-medium border-b-2 ${editorTab === 'users' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500'}`}>
                Assigned Users ({editorData.assignments?.length || 0})
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {editorTab === 'perms' && (
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
                              <input type="checkbox" checked={editPerms.objectPermissions?.[obj]?.[action] || false} onChange={() => toggleObjectPerm(obj, action)} className="w-4 h-4 text-brand-navy rounded border-gray-300 cursor-pointer" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {editorTab === 'users' && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Assigned Users</h3>
                  {editorData.assignments.length === 0 ? (
                    <p className="text-sm text-gray-500 mb-4">No users assigned yet</p>
                  ) : (
                    <div className="space-y-1 mb-6">
                      {editorData.assignments.map((a) => (
                        <div key={a.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{a.user.name || a.user.email}</span>
                            <span className="text-xs text-gray-500 ml-2">{a.user.email}</span>
                          </div>
                          <button onClick={() => unassignUser(a.userId)} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Remove">
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Add Users</h3>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {unassignedUsers.slice(0, 20).map((u) => (
                      <div key={u.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg">
                        <div>
                          <span className="text-sm text-gray-900">{u.name || u.email}</span>
                          <span className="text-xs text-gray-500 ml-2">{u.email}</span>
                        </div>
                        <button onClick={() => assignUser(u.id)} className="p-1 text-brand-navy hover:bg-brand-navy/10 rounded" title="Assign">
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setShowEditor(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              {editorTab === 'perms' && (
                <button onClick={savePerms} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4"><h2 className="text-lg font-semibold">New Permission Set</h2></div>
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
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={!createName} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
