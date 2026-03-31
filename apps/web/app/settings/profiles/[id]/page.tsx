'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Lock, Users, Check, X, ChevronLeft,
  Copy, Trash2, Save, AlertCircle, UserPlus, UserMinus,
} from 'lucide-react';
import { apiClient, type Profile } from '@/lib/api-client';

const OBJECT_MAP: { key: string; label: string }[] = [
  { key: 'properties',    label: 'Property' },
  { key: 'contacts',      label: 'Contact' },
  { key: 'companies',     label: 'Account' },
  { key: 'products',      label: 'Product' },
  { key: 'leads',         label: 'Lead' },
  { key: 'opportunities', label: 'Opportunity' },
  { key: 'projects',      label: 'Project' },
  { key: 'service',       label: 'Service' },
  { key: 'quotes',        label: 'Quote' },
  { key: 'installations', label: 'Installation' },
];

const OBJ_PERM_COLS: { key: string; label: string; width: string }[] = [
  { key: 'read',      label: 'Read',       width: 'w-16' },
  { key: 'create',    label: 'Create',     width: 'w-16' },
  { key: 'edit',      label: 'Edit',       width: 'w-16' },
  { key: 'delete',    label: 'Delete',     width: 'w-16' },
  { key: 'viewAll',   label: 'View All',   width: 'w-20' },
  { key: 'modifyAll', label: 'Modify All', width: 'w-24' },
];

const APP_PERMS: { key: string; label: string; desc: string }[] = [
  { key: 'manageUsers',           label: 'Manage Users',            desc: 'Create, edit, and deactivate user accounts' },
  { key: 'manageProfiles',        label: 'Manage Profiles',         desc: 'Create and edit profiles and permissions' },
  { key: 'manageDepartments',     label: 'Manage Departments',      desc: 'Create and manage department hierarchy' },
  { key: 'manageIntegrations',    label: 'Manage Integrations',     desc: 'Configure third-party integrations and API keys' },
  { key: 'manageCompanySettings', label: 'Manage Company Settings', desc: 'Edit company-wide settings and preferences' },
  { key: 'exportData',            label: 'Export Data',             desc: 'Export records and reports to CSV/Excel' },
  { key: 'importData',            label: 'Import Data',             desc: 'Bulk import records from file' },
  { key: 'viewReports',           label: 'View Reports',            desc: 'View report data and dashboards' },
  { key: 'manageReports',         label: 'Manage Reports',          desc: 'Create, edit, and share reports' },
  { key: 'manageDashboards',      label: 'Manage Dashboards',       desc: 'Create and configure dashboards' },
  { key: 'viewSummary',           label: 'View Summary',            desc: 'View pipeline and business summary' },
  { key: 'viewSetup',             label: 'View Setup',              desc: 'Access settings and configuration pages' },
  { key: 'viewAuditLog',          label: 'View Audit Log',          desc: 'View system audit trail and user actions' },
  { key: 'customizeApplication',  label: 'Customize Application',   desc: 'Modify object layouts and custom fields' },
  { key: 'viewAllData',           label: 'View All Data',           desc: 'Override record sharing — see everything' },
  { key: 'modifyAllData',         label: 'Modify All Data',         desc: 'Override record sharing — edit everything' },
];

type Tab = 'objects' | 'app' | 'members';

interface ProfileMember {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
}

type ObjPerms = { read: boolean; create: boolean; edit: boolean; delete: boolean; viewAll: boolean; modifyAll: boolean };
type PermsState = { objects: Record<string, ObjPerms>; app: Record<string, boolean> };

function emptyObjPerm(): ObjPerms {
  return { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false };
}

function emptyPerms(): PermsState {
  return {
    objects: Object.fromEntries(OBJECT_MAP.map(o => [o.key, emptyObjPerm()])),
    app: Object.fromEntries(APP_PERMS.map(p => [p.key, false])),
  };
}

function parsePerms(raw: any): PermsState {
  if (!raw || typeof raw !== 'object') return emptyPerms();
  const objects: Record<string, ObjPerms> = {};
  for (const obj of OBJECT_MAP) {
    const src = raw.objects?.[obj.key] ?? {};
    objects[obj.key] = {
      read:      !!src.read,
      create:    !!src.create,
      edit:      !!src.edit,
      delete:    !!src.delete,
      viewAll:   !!src.viewAll,
      modifyAll: !!src.modifyAll,
    };
  }
  const app: Record<string, boolean> = {};
  for (const p of APP_PERMS) {
    app[p.key] = !!(raw.app?.[p.key]);
  }
  return { objects, app };
}

export default function ProfileRecordPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<Tab>('objects');
  const [members, setMembers] = useState<ProfileMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGrantsAdmin, setFormGrantsAdmin] = useState(false);
  const [perms, setPerms] = useState<PermsState>(emptyPerms());

  const [allUsers, setAllUsers] = useState<{ id: string; name: string | null; email: string; profileId: string | null }[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [assigningUser, setAssigningUser] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await apiClient.getProfile(id);
      setProfile(p);
      setFormLabel(p.label);
      setFormDescription(p.description ?? '');
      setFormGrantsAdmin(p.grantsAdminAccess);
      setPerms(parsePerms(p.permissions));
      setDirty(false);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadMembers = useCallback(async () => {
    setMembersLoading(true);
    try {
      const data = await apiClient.getProfileMembers(id);
      setMembers(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab === 'members') {
      loadMembers();
      apiClient.getUsers().then(users => setAllUsers(users as any[])).catch(() => {});
    }
  }, [tab, loadMembers]);

  const availableUsers = allUsers.filter(u => u.profileId !== id && !members.some(m => m.id === u.id));

  const handleAssignUser = async (userId: string) => {
    setAssigningUser(true);
    try {
      await apiClient.updateUser(userId, { profileId: id } as any);
      setShowAddUser(false);
      await loadMembers();
      const refreshed = await apiClient.getUsers();
      setAllUsers(refreshed as any[]);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to assign user');
    } finally {
      setAssigningUser(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      await apiClient.updateUser(userId, { profileId: null } as any);
      await loadMembers();
      const refreshed = await apiClient.getUsers();
      setAllUsers(refreshed as any[]);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to remove user');
    }
  };

  const markDirty = () => setDirty(true);

  const toggleObjPerm = (obj: string, key: keyof ObjPerms) => {
    setPerms(prev => {
      const current = { ...prev.objects[obj] };
      current[key] = !current[key];
      if (key === 'modifyAll' && current.modifyAll) { current.viewAll = true; current.edit = true; current.read = true; }
      if (key === 'viewAll' && current.viewAll) { current.read = true; }
      if (key === 'modifyAll' && !current.modifyAll) { /* allow unchecking freely */ }
      if (key === 'viewAll' && !current.viewAll) { current.modifyAll = false; }
      if (key === 'read' && !current.read) { current.viewAll = false; current.modifyAll = false; current.create = false; }
      if ((key === 'create' || key === 'edit') && current[key]) { current.read = true; }
      return { ...prev, objects: { ...prev.objects, [obj]: current } };
    });
    markDirty();
  };

  const toggleAppPerm = (key: string) => {
    setPerms(prev => ({ ...prev, app: { ...prev.app, [key]: !prev.app[key] } }));
    markDirty();
  };

  const setAllObj = (value: boolean) => {
    setPerms(prev => ({
      ...prev,
      objects: Object.fromEntries(
        OBJECT_MAP.map(o => [o.key, { read: value, create: value, edit: value, delete: value, viewAll: value, modifyAll: value }])
      ),
    }));
    markDirty();
  };

  const setAllApp = (value: boolean) => {
    setPerms(prev => ({
      ...prev,
      app: Object.fromEntries(APP_PERMS.map(p => [p.key, value])),
    }));
    markDirty();
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateProfile(id, {
        label: formLabel,
        description: formDescription || null,
        grantsAdminAccess: formGrantsAdmin,
      });
      await apiClient.updateProfilePermissions(id, { objects: perms.objects, app: perms.app });
      setSuccess('Profile saved');
      setDirty(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleClone = async () => {
    if (!profile) return;
    try {
      const cloned = await apiClient.cloneProfile(id);
      router.push(`/settings/profiles/${cloned.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to clone profile');
    }
  };

  const handleDelete = async () => {
    if (!profile || profile.isSystem) return;
    if (!confirm(`Delete profile "${profile.label}"? Users assigned to this profile will be unassigned.`)) return;
    try {
      await apiClient.deleteProfile(id);
      router.replace('/settings/profiles');
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete profile');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading profile…
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="w-8 h-8 text-red-400" />
        <p className="text-gray-500 text-sm">Profile not found</p>
        <Link href="/settings/profiles" className="text-[#151f6d] text-sm font-semibold hover:underline">
          Back to Profiles
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* ── Left sidebar ─────────────────────────────────────────────── */}
      <aside className="w-[220px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        <div className="p-4 border-b border-gray-100">
          <Link
            href="/settings/profiles"
            className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-[#151f6d] mb-3 transition-colors"
          >
            <ChevronLeft className="w-3 h-3" /> All Profiles
          </Link>
          <div className="w-12 h-12 rounded-xl bg-[#151f6d]/10 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-[#151f6d]" />
          </div>
          <h2 className="text-sm font-bold text-gray-900 leading-tight">{profile.label}</h2>
          <p className="text-[11px] text-gray-400 mt-0.5 font-mono">{profile.name}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {profile.isSystem && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#151f6d]/10 text-[#151f6d]">
                <Lock className="w-2.5 h-2.5" /> System
              </span>
            )}
            {profile.grantsAdminAccess && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                Admin
              </span>
            )}
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Details</div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Label</div>
              {profile.isSystem ? (
                <div className="text-sm text-gray-700">{formLabel}</div>
              ) : (
                <input
                  value={formLabel}
                  onChange={e => { setFormLabel(e.target.value); markDirty(); }}
                  className="w-full text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#151f6d]/30"
                />
              )}
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Description</div>
              <textarea
                value={formDescription}
                onChange={e => { setFormDescription(e.target.value); markDirty(); }}
                rows={3}
                disabled={profile.isSystem}
                className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#151f6d]/30 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                placeholder="Description…"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase tracking-wider">Admin Access</span>
              <button
                type="button"
                onClick={() => { setFormGrantsAdmin(!formGrantsAdmin); markDirty(); }}
                disabled={profile.isSystem}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                  formGrantsAdmin ? 'bg-amber-500' : 'bg-gray-200'
                } disabled:opacity-50`}
              >
                <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  formGrantsAdmin ? 'translate-x-4' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{profile._count?.users ?? 0} member{(profile._count?.users ?? 0) !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div className="p-4 space-y-1.5">
          <button
            onClick={handleClone}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Copy className="w-3.5 h-3.5" /> Clone Profile
          </button>
          {!profile.isSystem && (
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Profile
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-[#f8f8fc]">
        {/* Sticky header with save bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">{profile.label}</h1>
            <p className="text-[11px] text-gray-400">
              {profile.grantsAdminAccess
                ? 'System administrator — full access'
                : profile.isSystem
                  ? 'System profile — name is locked, permissions can be edited'
                  : 'Profile · Permissions'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99] disabled:opacity-40 transition-colors font-medium"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        {/* Alerts */}
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

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex gap-0 border-b border-gray-200">
            {(['objects', 'app', 'members'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  tab === t
                    ? 'border-[#151f6d] text-[#151f6d]'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'objects' ? 'Object Permissions' : t === 'app' ? 'App Permissions' : 'Members'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4">
          {/* ── Object Permissions ── */}
          {tab === 'objects' && (
            <div>
              {profile.grantsAdminAccess && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 font-medium">
                    This profile grants full administrator access. All permissions are automatically enabled and cannot be modified.
                  </p>
                </div>
              )}
              {profile.isSystem && !profile.grantsAdminAccess && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    This is a system profile. Its name is locked, but permissions can be edited.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">
                  Set CRUD and data visibility for each CRM module.
                </p>
                {!profile.grantsAdminAccess && (
                  <div className="flex gap-2">
                    <button onClick={() => setAllObj(true)} className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">Grant All</button>
                    <button onClick={() => setAllObj(false)} className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium">Revoke All</button>
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#fafafa] border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 w-36">Object</th>
                      {OBJ_PERM_COLS.map(col => (
                        <th key={col.key} className={`text-center px-2 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 ${col.width}`}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {OBJECT_MAP.map(obj => (
                      <tr key={obj.key} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-2.5 text-sm font-medium text-gray-800">{obj.label}</td>
                        {OBJ_PERM_COLS.map(col => {
                          const checked = profile.grantsAdminAccess ? true : (perms.objects[obj.key]?.[col.key as keyof ObjPerms] ?? false);
                          return (
                            <td key={col.key} className="px-2 py-2.5 text-center">
                              <button
                                onClick={() => !profile.grantsAdminAccess && toggleObjPerm(obj.key, col.key as keyof ObjPerms)}
                                disabled={profile.grantsAdminAccess}
                                className={`w-6 h-6 rounded border inline-flex items-center justify-center transition-colors ${
                                  checked
                                    ? 'bg-[#151f6d] border-[#151f6d] text-white'
                                    : 'border-gray-300 text-transparent hover:border-gray-400'
                                } disabled:cursor-default`}
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Implications: Modify All → View All → Read. Create/Edit → Read.
              </p>
            </div>
          )}

          {/* ── App Permissions ── */}
          {tab === 'app' && (
            <div>
              {profile.grantsAdminAccess && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 font-medium">
                    This profile grants full administrator access. All permissions are automatically enabled and cannot be modified.
                  </p>
                </div>
              )}
              {profile.isSystem && !profile.grantsAdminAccess && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
                  <Lock className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    This is a system profile. Its name is locked, but permissions can be edited.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">Administrative and application-level access.</p>
                {!profile.grantsAdminAccess && (
                  <div className="flex gap-2">
                    <button onClick={() => setAllApp(true)} className="px-2.5 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100 font-medium">Grant All</button>
                    <button onClick={() => setAllApp(false)} className="px-2.5 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium">Revoke All</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {APP_PERMS.map(({ key, label, desc }) => {
                  const checked = profile.grantsAdminAccess ? true : (perms.app[key] ?? false);
                  return (
                    <button
                      key={key}
                      onClick={() => !profile.grantsAdminAccess && toggleAppPerm(key)}
                      disabled={profile.grantsAdminAccess}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
                        checked
                          ? 'bg-[#151f6d]/5 border-[#151f6d]/30'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      } disabled:cursor-default`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                        checked ? 'bg-[#151f6d] border-[#151f6d] text-white' : 'border-gray-300'
                      }`}>
                        {checked && <Check className="w-3 h-3" />}
                      </div>
                      <div>
                        <div className={`text-sm font-medium ${checked ? 'text-[#151f6d]' : 'text-gray-800'}`}>{label}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Members ── */}
          {tab === 'members' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">
                  {members.length} user{members.length !== 1 ? 's' : ''} assigned to this profile.
                </p>
                <button
                  onClick={() => setShowAddUser(!showAddUser)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#151f6d] text-white rounded-lg hover:bg-[#1c2b99] transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Assign User
                </button>
              </div>

              {showAddUser && (
                <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Select a user to assign</label>
                  {availableUsers.length === 0 ? (
                    <p className="text-sm text-gray-400">No unassigned users available.</p>
                  ) : (
                    <select
                      className="w-full max-w-sm text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#151f6d]/30"
                      defaultValue=""
                      disabled={assigningUser}
                      onChange={e => { if (e.target.value) handleAssignUser(e.target.value); }}
                    >
                      <option value="" disabled>Choose user…</option>
                      {availableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name ?? u.email} ({u.email})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {membersLoading ? (
                <div className="text-sm text-gray-400 py-8 text-center">Loading members…</div>
              ) : members.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
                  No users are assigned to this profile.
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#fafafa] border-b border-gray-200">
                        <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Name</th>
                        <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Email</th>
                        <th className="text-center px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                        <th className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 w-24"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <Link href={`/settings/users/${m.id}`} className="text-sm font-medium text-[#151f6d] hover:underline">
                              {m.name ?? '—'}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{m.email}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              m.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {m.isActive ? 'Active' : 'Frozen'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleRemoveUser(m.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded-md transition-colors"
                              title="Remove from profile"
                            >
                              <UserMinus className="w-3 h-3" />
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
