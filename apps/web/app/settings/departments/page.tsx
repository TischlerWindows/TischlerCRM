'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
  Users,
  X,
  FolderTree,
  Shield,
  Check,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';

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
  { key: 'manageProfiles', label: 'Manage Profiles' },
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
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'objects' | 'app'>('details');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (!schema) loadSchema();
      const data = await apiClient.get<DepartmentRow[]>('/departments');
      setDepartments(data);
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
        permissions: formPerms,
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
        permissions: formPerms,
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
    if (!p || !p.objectPermissions) return 'No permissions set';
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <Building2 className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">
            Manage departments and their permissions — each department controls what its members can access
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">
          {error}
          <button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">
          {success}
          <button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-6 py-4 flex justify-end">
        <button
          onClick={() => { resetForm(); setShowCreate(true); }}
          className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy/90 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {/* Department tree */}
      <div className="px-6 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading...</div>
          ) : departments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No departments yet</div>
          ) : (
            rootDepts.map((d) => renderDept(d))
          )}
        </div>
      </div>

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
              {(['details', 'objects', 'app'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'details' ? 'Details' : tab === 'objects' ? 'Object Permissions' : 'App Permissions'}
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
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 font-medium text-gray-700 w-32">Object</th>
                          {PERM_KEYS.map((k) => (
                            <th key={k} className="text-center px-2 py-2 font-medium text-gray-700 text-xs uppercase">
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
    </div>
  );
}
