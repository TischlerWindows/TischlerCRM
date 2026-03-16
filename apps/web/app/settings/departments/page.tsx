'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Users,
  X,
  FolderTree,
  Shield,
  Check,
  Home,
  LayoutDashboard,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';
import { getSetting } from '@/lib/preferences';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

// ── Types ──────────────────────────────────────────────────────────
interface ObjectPerms {
  read: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  viewAll: boolean;
  modifyAll: boolean;
}

interface Permissions {
  isAdmin?: boolean;
  objectPermissions: Record<string, ObjectPerms>;
  appPermissions: Record<string, boolean>;
}

interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  permissions: Permissions | null;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string }[];
  _count: { users: number };
}

const BUILTIN_CRM_OBJECTS = [
  'Property', 'Contact', 'Account', 'Product', 'Lead',
  'Deal', 'Project', 'Service', 'Quote', 'Installation',
];

const PERM_KEYS: (keyof ObjectPerms)[] = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];

const APP_PERMISSIONS = [
  { key: 'manageUsers', label: 'Manage Users' },
  { key: 'manageRoles', label: 'Manage Roles' },
  { key: 'manageDepartments', label: 'Manage Departments' },
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

export default function DepartmentsPage() {
  const { schema, loadSchema } = useSchemaStore();
  const CRM_OBJECTS = schema
    ? schema.objects.map(o => o.apiName)
    : BUILTIN_CRM_OBJECTS;

  const emptyPermissions = (): Permissions => ({
    objectPermissions: Object.fromEntries(
      CRM_OBJECTS.map((o) => [o, { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false }])
    ),
    appPermissions: Object.fromEntries(APP_PERMISSIONS.map((p) => [p.key, false])),
  });

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formParent, setFormParent] = useState('');
  const [formPerms, setFormPerms] = useState<Permissions>(emptyPermissions());
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [formHomeLayoutId, setFormHomeLayoutId] = useState<string>('');
  const [homeTemplates, setHomeTemplates] = useState<Array<{ id: string; name: string; layout: any }>>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'objects' | 'app' | 'home'>('details');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!schema) loadSchema();
      const data = await apiClient.get<DepartmentRow[]>('/departments');
      setDepartments(data);
      // Load home layout templates
      const tpls = await getSetting<Array<{ id: string; name: string; layout: any }>>('homeLayoutTemplates');
      setHomeTemplates(tpls || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setFormName('');
    setFormDesc('');
    setFormParent('');
    setFormPerms(emptyPermissions());
    setFormIsAdmin(false);
    setFormHomeLayoutId('');
    setActiveTab('details');
  };

  const handleCreate = async () => {
    if (!formName) return;
    setSaving(true);
    try {
      await apiClient.post('/departments', {
        name: formName,
        description: formDesc || null,
        parentId: formParent || null,
        permissions: { ...formPerms, isAdmin: formIsAdmin, homePageLayoutId: formHomeLayoutId || undefined },
      });
      setSuccess(`Department "${formName}" created`);
      setShowCreate(false);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!showEdit || !formName) return;
    setSaving(true);
    try {
      await apiClient.put(`/departments/${showEdit}`, {
        name: formName,
        description: formDesc || null,
        parentId: formParent || null,
        permissions: { ...formPerms, isAdmin: formIsAdmin, homePageLayoutId: formHomeLayoutId || undefined },
      });
      setSuccess('Department updated');
      setShowEdit(null);
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this department?')) return;
    try {
      await apiClient.delete(`/departments/${id}`);
      setSuccess('Department deleted');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  const openEdit = (d: DepartmentRow) => {
    setFormName(d.name);
    setFormDesc(d.description || '');
    setFormParent(d.parentId || '');
    const perms = d.permissions && typeof d.permissions === 'object' && Object.keys(d.permissions).length > 0
      ? {
          objectPermissions: { ...emptyPermissions().objectPermissions, ...(d.permissions.objectPermissions || {}) },
          appPermissions: { ...emptyPermissions().appPermissions, ...(d.permissions.appPermissions || {}) },
        }
      : emptyPermissions();
    setFormPerms(perms);
    setFormIsAdmin(!!(d.permissions as any)?.isAdmin);
    setFormHomeLayoutId((d.permissions as any)?.homePageLayoutId || '');
    setActiveTab('details');
    setShowEdit(d.id);
  };

  // Permissions helpers
  const toggleObjPerm = (obj: string, key: keyof ObjectPerms) => {
    setFormPerms((prev) => ({
      ...prev,
      objectPermissions: {
        ...prev.objectPermissions,
        [obj]: {
          ...(prev.objectPermissions[obj] || { read: false, create: false, edit: false, delete: false, viewAll: false, modifyAll: false }),
          [key]: !(prev.objectPermissions[obj]?.[key] ?? false),
        },
      },
    }));
  };

  const toggleAppPerm = (key: string) => {
    setFormPerms((prev) => ({
      ...prev,
      appPermissions: {
        ...prev.appPermissions,
        [key]: !prev.appPermissions[key],
      },
    }));
  };

  const setAllObjPerms = (value: boolean) => {
    setFormPerms((prev) => ({
      ...prev,
      objectPermissions: Object.fromEntries(
        CRM_OBJECTS.map((o) => [o, { read: value, create: value, edit: value, delete: value, viewAll: value, modifyAll: value }])
      ),
    }));
  };

  const setAllAppPerms = (value: boolean) => {
    setFormPerms((prev) => ({
      ...prev,
      appPermissions: Object.fromEntries(APP_PERMISSIONS.map((p) => [p.key, value])),
    }));
  };

  // Build tree
  const rootDepts = departments.filter((d) => !d.parentId);
  const childMap = new Map<string, DepartmentRow[]>();
  departments.forEach((d) => {
    if (d.parentId) {
      if (!childMap.has(d.parentId)) childMap.set(d.parentId, []);
      childMap.get(d.parentId)!.push(d);
    }
  });

  const permsSummary = (d: DepartmentRow) => {
    const p = d.permissions;
    if (!p) return 'No permissions set';
    if ((p as any).isAdmin) return 'Admin — Full Access';
    if (!p.objectPermissions) return 'No permissions set';
    const objCount = Object.values(p.objectPermissions).filter((o: any) => o?.read).length;
    return `${objCount}/${CRM_OBJECTS.length} objects`;
  };

  const renderDept = (d: DepartmentRow, depth: number = 0) => (
    <div key={d.id}>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 cursor-pointer"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
        onClick={() => openEdit(d)}
      >
        {childMap.has(d.id) ? (
          <FolderTree className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-brand-navy hover:underline">{d.name}</span>
          {d.description && <p className="text-xs text-gray-500 truncate">{d.description}</p>}
        </div>
        <span className="text-xs text-gray-400 hidden sm:inline">{permsSummary(d)}</span>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <Users className="w-3 h-3" />
          {d._count.users}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}
          className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {childMap.get(d.id)?.map((child) => renderDept(child, depth + 1))}
    </div>
  );

  const isModalOpen = showCreate || showEdit;

  return (
    <>
      <SettingsPageHeader
        icon={Building2}
        title="Departments"
        subtitle="Organize team structure and permissions"
        action={{
          label: 'New Department',
          icon: Plus,
          onClick: () => { resetForm(); setShowCreate(true); },
        }}
      />

      {/* Alerts */}
      {error && (
        <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-8 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Department tree */}
      <SettingsContentCard>
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : departments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No departments yet</div>
        ) : (
          rootDepts.map((d) => renderDept(d))
        )}
      </SettingsContentCard>

      {/* ── Create / Edit Modal ────────────────────────────────────── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => { setShowCreate(false); setShowEdit(null); resetForm(); }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-navy" />
                {showEdit ? 'Edit Department' : 'New Department'}
              </h2>
              <button
                onClick={() => { setShowCreate(false); setShowEdit(null); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="border-b px-6 flex gap-0 flex-shrink-0">
              {(['details', 'objects', 'app', 'home'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'details' ? 'Details' : tab === 'objects' ? 'Object Permissions' : tab === 'app' ? 'App Permissions' : 'Home Page'}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* ─ Details tab ─ */}
              {activeTab === 'details' && (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                    <input
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy"
                      placeholder="e.g. Sales"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formDesc}
                      onChange={(e) => setFormDesc(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Parent Department</label>
                    <select
                      value={formParent}
                      onChange={(e) => setFormParent(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy"
                    >
                      <option value="">None (Top Level)</option>
                      {departments.filter((d) => d.id !== showEdit).map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Admin Mode Toggle */}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={formIsAdmin}
                        onClick={() => {
                          const newVal = !formIsAdmin;
                          setFormIsAdmin(newVal);
                          if (newVal) {
                            // Auto-grant all permissions when enabling admin mode
                            setFormPerms({
                              ...formPerms,
                              objectPermissions: Object.fromEntries(
                                CRM_OBJECTS.map((o) => [o, { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true }])
                              ),
                              appPermissions: Object.fromEntries(APP_PERMISSIONS.map((p) => [p.key, true])),
                            });
                          }
                        }}
                        className={`mt-0.5 relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-navy focus:ring-offset-2 ${
                          formIsAdmin ? 'bg-brand-navy' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            formIsAdmin ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Admin Mode</label>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Full access to all objects, including any new objects created in the future.
                          Object and app permission tabs are still editable as overrides.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─ Object Permissions tab ─ */}
              {activeTab === 'objects' && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-600">Set CRUD and visibility for each CRM object</p>
                    <div className="flex gap-2">
                      <button onClick={() => setAllObjPerms(true)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                        Grant All
                      </button>
                      <button onClick={() => setAllObjPerms(false)} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">
                        Revoke All
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-[#fafafa] border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em] w-32">Object</th>
                          {PERM_KEYS.map((k) => (
                            <th key={k} className="text-center px-2 py-2 text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">
                              {k === 'viewAll' ? 'View All' : k === 'modifyAll' ? 'Modify All' : k.charAt(0).toUpperCase() + k.slice(1)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {CRM_OBJECTS.map((obj, idx) => (
                          <tr key={obj} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <td className="px-3 py-2 font-medium text-gray-800">{obj}</td>
                            {PERM_KEYS.map((k) => {
                              const checked = formPerms.objectPermissions[obj]?.[k] ?? false;
                              return (
                                <td key={k} className="text-center px-2 py-2">
                                  <button
                                    onClick={() => toggleObjPerm(obj, k)}
                                    className={`w-6 h-6 rounded border inline-flex items-center justify-center transition-colors ${
                                      checked
                                        ? 'bg-brand-navy border-brand-navy text-white'
                                        : 'border-gray-300 text-transparent hover:border-gray-400'
                                    }`}
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
                </div>
              )}

              {/* ─ App Permissions tab ─ */}
              {activeTab === 'app' && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-gray-600">Administrative and application-level permissions</p>
                    <div className="flex gap-2">
                      <button onClick={() => setAllAppPerms(true)} className="px-2 py-1 text-xs bg-green-50 text-green-700 rounded hover:bg-green-100">
                        Grant All
                      </button>
                      <button onClick={() => setAllAppPerms(false)} className="px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">
                        Revoke All
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {APP_PERMISSIONS.map((ap) => {
                      const checked = formPerms.appPermissions[ap.key] ?? false;
                      return (
                        <button
                          key={ap.key}
                          onClick={() => toggleAppPerm(ap.key)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                            checked
                              ? 'bg-brand-navy/5 border-brand-navy/30 text-brand-navy'
                              : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${
                              checked ? 'bg-brand-navy border-brand-navy text-white' : 'border-gray-300'
                            }`}
                          >
                            {checked && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-sm font-medium">{ap.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─ Home Page Layout tab ─ */}
              {activeTab === 'home' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Assign a Home Page layout template for members of this department.
                    Users without a personal Home layout will see this layout when they log in.
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Home Page Layout Template
                    </label>
                    <select
                      value={formHomeLayoutId}
                      onChange={(e) => setFormHomeLayoutId(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                    >
                      <option value="">— None (use default) —</option>
                      {homeTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.layout?.panels?.length || 0} panels, {t.layout?.columns || 2} columns)
                        </option>
                      ))}
                    </select>
                  </div>

                  {formHomeLayoutId && (() => {
                    const selected = homeTemplates.find(t => t.id === formHomeLayoutId);
                    if (!selected) return null;
                    return (
                      <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <div className="flex items-center gap-2 mb-3">
                          <LayoutDashboard className="w-4 h-4 text-brand-navy" />
                          <span className="text-sm font-medium text-gray-800">{selected.name}</span>
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          <span className="font-medium">{selected.layout?.columns || 2} columns</span>
                          {' · '}
                          <span>{selected.layout?.panels?.length || 0} panels</span>
                        </div>
                        {selected.layout?.panels && selected.layout.panels.length > 0 && (
                          <div className="space-y-1">
                            {selected.layout.panels.map((panel: any, idx: number) => (
                              <div key={idx} className="text-xs text-gray-500 flex items-center gap-2">
                                <span className="w-4 h-4 rounded bg-brand-navy/10 text-brand-navy flex items-center justify-center text-[10px] font-medium">{idx + 1}</span>
                                <span>{panel.title || panel.sourceId || 'Untitled panel'}</span>
                                <span className="text-gray-400">({panel.type})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {homeTemplates.length === 0 && (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Home className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500 mb-1">No templates available</p>
                      <p className="text-xs text-gray-400">
                        Go to Object Manager → Home → Home Layout Editor to design a layout, then save it as a template.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t px-6 py-3 flex justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => { setShowCreate(false); setShowEdit(null); resetForm(); }}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={showEdit ? handleUpdate : handleCreate}
                disabled={!formName || saving}
                className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50"
              >
                {saving ? 'Saving...' : showEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
