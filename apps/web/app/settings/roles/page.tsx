'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Plus,
  ChevronRight,
  ChevronDown,
  Users,
  Pencil,
  Trash2,
  X,
  Lock,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

interface Role {
  id: string;
  name: string;
  label: string;
  description: string | null;
  level: number;
  parentId: string | null;
  parent: { id: string; name: string; label: string } | null;
  children: { id: string; name: string; label: string; level: number }[];
  permissions: any;
  visibility: any;
  isSystem: boolean;
  _count: { users: number };
}

const CORE_OBJECTS = ['Property', 'Contact', 'Account', 'Product', 'Lead', 'Deal', 'Project', 'Service', 'Quote', 'Installation'];
const ACTIONS = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'] as const;
const APP_PERMS = [
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

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'objects' | 'app'>('objects');

  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLevel, setFormLevel] = useState(4);
  const [formParentId, setFormParentId] = useState('');
  const [formObjPerms, setFormObjPerms] = useState<Record<string, Record<string, boolean>>>({});
  const [formAppPerms, setFormAppPerms] = useState<Record<string, boolean>>({});

  const loadRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<Role[]>('/admin/roles');
      setRoles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const toggleExpanded = (id: string) => {
    setExpandedRoles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetForm = () => {
    setEditingRole(null);
    setFormName('');
    setFormLabel('');
    setFormDescription('');
    setFormLevel(4);
    setFormParentId('');
    setFormObjPerms({});
    setFormAppPerms({});
    setActiveTab('objects');
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (role: Role) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormLabel(role.label);
    setFormDescription(role.description || '');
    setFormLevel(role.level);
    setFormParentId(role.parentId || '');
    const perms = role.permissions || {};
    setFormObjPerms(perms.objectPermissions || {});
    setFormAppPerms(perms.appPermissions || {});
    setActiveTab('objects');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName || !formLabel) {
      setError('Name and Label are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        name: formName,
        label: formLabel,
        description: formDescription || null,
        level: formLevel,
        parentId: formParentId || null,
        permissions: { objectPermissions: formObjPerms, appPermissions: formAppPerms },
        visibility: editingRole?.visibility || {},
      };
      if (editingRole) {
        await apiClient.put(`/admin/roles/${editingRole.id}`, body);
        setSuccess('Role updated');
      } else {
        await apiClient.post('/admin/roles', body);
        setSuccess('Role created');
      }
      setShowModal(false);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) return;
    if (!confirm(`Delete role "${role.label}"? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/admin/roles/${role.id}`);
      setSuccess(`Role "${role.label}" deleted`);
      await loadRoles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  };

  const toggleObjPerm = (obj: string, action: string) => {
    setFormObjPerms(prev => {
      const objPerms = { ...(prev[obj] || {}) };
      objPerms[action] = !objPerms[action];
      return { ...prev, [obj]: objPerms };
    });
  };

  const toggleAppPerm = (key: string) => {
    setFormAppPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const rolesByLevel = roles.reduce<Record<number, Role[]>>((acc, r) => {
    acc[r.level] = acc[r.level] || [];
    acc[r.level].push(r);
    return acc;
  }, {});

  const sortedLevels = Object.keys(rolesByLevel).map(Number).sort((a, b) => a - b);

  return (
    <>
      <SettingsPageHeader
        icon={Shield}
        title="Roles"
        subtitle="Configure role hierarchy and permissions"
        action={{
          label: 'New Role',
          icon: Plus,
          onClick: () => { resetForm(); setShowModal(true); },
        }}
      />

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
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading roles...</div>
        ) : roles.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No roles defined</div>
        ) : (
          <div>
            {sortedLevels.map(level => (
              <div key={level}>
                <div className="px-4 py-2 bg-[#fafafa] border-b border-gray-200">
                  <span className="text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]">Level {level}</span>
                </div>
                {rolesByLevel[level].map(role => (
                  <div key={role.id} className="border-b border-gray-100 last:border-b-0">
                    <div className="flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                      <button onClick={() => toggleExpanded(role.id)} className="p-1 mr-2">
                        {expandedRoles.has(role.id) ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{role.label}</span>
                          {role.isSystem && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-navy/10 text-brand-navy">
                              <Lock className="w-2.5 h-2.5" /> System
                            </span>
                          )}
                        </div>
                        {role.description && <div className="text-xs text-gray-500 mt-0.5">{role.description}</div>}
                      </div>
                      <div className="flex items-center gap-4 ml-4">
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Users className="w-3.5 h-3.5" /> {role._count.users}
                        </span>
                        <button onClick={() => openEdit(role)} className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-brand-navy/10 rounded transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {!role.isSystem && (
                          <button onClick={() => handleDelete(role)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    {expandedRoles.has(role.id) && (
                      <div className="px-12 pb-3 text-xs text-gray-500 space-y-1">
                        <div><span className="font-medium">Name:</span> {role.name}</div>
                        {role.parent && <div><span className="font-medium">Parent:</span> {role.parent.label}</div>}
                        {role.children.length > 0 && (
                          <div><span className="font-medium">Children:</span> {role.children.map(c => c.label).join(', ')}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </SettingsContentCard>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-3xl mx-4 shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-900">{editingRole ? `Edit Role: ${editingRole.label}` : 'New Role'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name (API key) *</label>
                  <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="e.g. sales_manager" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Label *</label>
                  <input value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="e.g. Sales Manager" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input value={formDescription} onChange={e => setFormDescription(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level (1=highest authority)</label>
                  <input type="number" min={1} max={99} value={formLevel} onChange={e => setFormLevel(parseInt(e.target.value) || 4)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parent Role</label>
                  <select value={formParentId} onChange={e => setFormParentId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">None</option>
                    {roles.filter(r => r.id !== editingRole?.id).map(r => (
                      <option key={r.id} value={r.id}>{r.label} (Level {r.level})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex gap-4 mb-4">
                  <button onClick={() => setActiveTab('objects')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'objects' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    Object Permissions
                  </button>
                  <button onClick={() => setActiveTab('app')} className={`text-sm font-medium pb-1 border-b-2 transition-colors ${activeTab === 'app' ? 'border-brand-navy text-brand-navy' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    App Permissions
                  </button>
                </div>

                {activeTab === 'objects' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Object</th>
                          {ACTIONS.map(a => (
                            <th key={a} className="px-3 py-2 text-center font-semibold text-gray-600 capitalize">{a}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {CORE_OBJECTS.map(obj => (
                          <tr key={obj} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800">{obj}</td>
                            {ACTIONS.map(action => (
                              <td key={action} className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={!!formObjPerms[obj]?.[action]}
                                  onChange={() => toggleObjPerm(obj, action)}
                                  className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'app' && (
                  <div className="grid grid-cols-2 gap-2">
                    {APP_PERMS.map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!formAppPerms[key]}
                          onChange={() => toggleAppPerm(key)}
                          className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">
                {saving ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
