'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Shield,
  Building2,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
  Pencil,
  Lock,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsFilterBar } from '@/components/settings/settings-filter-bar';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

interface RoleRef {
  id: string;
  name: string;
  label: string;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  title: string | null;
  phone: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  orgRole: RoleRef | null;
  department: { id: string; name: string } | null;
  manager: { id: string; name: string; email: string } | null;
}

interface Department {
  id: string;
  name: string;
}

const AVATAR_COLORS = ['#151f6d', '#da291c', '#2563eb', '#059669', '#7c3aed', '#d97706', '#0f1754'];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }
  return email[0].toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' \u00b7 ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDeptId, setFormDeptId] = useState('');
  const [formRoleId, setFormRoleId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, deptsData, rolesData] = await Promise.all([
        apiClient.get<UserRow[]>('/admin/users'),
        apiClient.get<Department[]>('/departments'),
        apiClient.get<RoleRef[]>('/admin/roles'),
      ]);
      setUsers(usersData);
      setDepartments(deptsData);
      setRoles(rolesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUsers = users.filter((u) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        u.name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.title?.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (filterDepartment && u.department?.id !== filterDepartment) return false;
    if (filterActive === 'true' && !u.isActive) return false;
    if (filterActive === 'false' && u.isActive) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!formName || !formEmail || !formPassword) {
      setError('Name, Email, and Password are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiClient.post('/admin/users', {
        name: formName,
        email: formEmail,
        password: formPassword,
        title: formTitle || null,
        phone: formPhone || null,
        departmentId: formDeptId || null,
        roleId: formRoleId || null,
      });
      setSuccess('User created successfully');
      setShowCreateModal(false);
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.put(`/admin/users/${editUser.id}`, {
        name: formName || undefined,
        title: formTitle || null,
        phone: formPhone || null,
        departmentId: formDeptId || null,
        roleId: formRoleId || null,
      });
      if (formPassword) {
        await apiClient.post(`/admin/users/${editUser.id}/reset-password`, { password: formPassword });
      }
      setSuccess('User updated successfully');
      setShowEditModal(null);
      setEditUser(null);
      resetForm();
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await apiClient.post(`/admin/users/${userId}/freeze`, {});
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user status');
    }
  };

  const handleDelete = async (user: UserRow) => {
    if (!confirm(`Delete ${user.name || user.email}? They can be restored from the Recycle Bin.`)) return;
    try {
      await apiClient.delete(`/admin/users/${user.id}`);
      setSuccess(`User "${user.name || user.email}" moved to Recycle Bin`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const openEdit = (user: UserRow) => {
    setEditUser(user);
    setFormName(user.name || '');
    setFormEmail(user.email);
    setFormTitle(user.title || '');
    setFormPhone(user.phone || '');
    setFormDeptId(user.department?.id || '');
    setFormRoleId(user.orgRole?.id || '');
    setFormPassword('');
    setShowEditModal(user.id);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormTitle('');
    setFormPhone('');
    setFormDeptId('');
    setFormRoleId('');
  };

  return (
    <>
      <SettingsPageHeader
        icon={Users}
        title="Users"
        subtitle="Manage user accounts, roles, and access permissions"
        action={{
          label: 'New User',
          icon: Plus,
          onClick: () => { resetForm(); setShowCreateModal(true); },
        }}
      />

      {/* Alerts */}
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

      <SettingsFilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search by name or email..."
        filters={[
          {
            value: filterDepartment,
            onChange: setFilterDepartment,
            options: [
              { value: '', label: 'All Departments' },
              ...departments.map((d) => ({ value: d.id, label: d.name })),
            ],
          },
          {
            value: filterActive,
            onChange: (v) => setFilterActive(v as '' | 'true' | 'false'),
            options: [
              { value: '', label: 'All Statuses' },
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ],
          },
        ]}
        resultCount={`Showing ${filteredUsers.length} of ${users.length} users`}
      />

      <SettingsContentCard>
        {loading ? (
          <div className="p-16 text-center text-brand-gray">Loading users...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-16 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-brand-gray text-sm">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#fafafa] border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]" style={{ width: '28%' }}>User</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]" style={{ width: '15%' }}>Role</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]" style={{ width: '15%' }}>Department</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]" style={{ width: '10%' }}>Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]" style={{ width: '18%' }}>Last Login</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold text-brand-gray uppercase tracking-[0.04em]" style={{ width: '14%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const displayName = user.name || user.email;
                  const initials = getInitials(user.name, user.email);
                  const avatarColor = getAvatarColor(displayName);
                  const isSystem = user.role === 'system_administrator' || user.orgRole?.name === 'system_administrator';

                  return (
                    <tr key={user.id} className="border-b border-[#f0f0f0] last:border-0 hover:bg-[#f9fafb] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white text-[13px] font-bold flex-shrink-0"
                            style={{ backgroundColor: avatarColor }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-brand-dark">{user.name || '\u2014'}</div>
                            <div className="text-[12px] text-brand-gray">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {user.orgRole ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isSystem ? 'bg-brand-navy text-white' : 'bg-[#eef0fb] text-brand-navy'}`}>
                            {user.orgRole.label}
                          </span>
                        ) : (
                          <span className="text-[12px] text-brand-gray">\u2014</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-gray-600">
                        {user.department?.name || '\u2014'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${user.isActive ? 'bg-[#dcfce7] text-[#166534]' : 'bg-[#fee2e2] text-[#991b1b]'}`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[12px] text-gray-500">
                        {user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-gray hover:bg-gray-100 hover:text-brand-dark transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-[15px] h-[15px]" />
                          </button>
                          <button
                            onClick={() => handleToggleActive(user.id)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${user.isActive ? 'text-brand-gray hover:bg-orange-50 hover:text-orange-600' : 'text-green-600 hover:bg-green-50'}`}
                            title={user.isActive ? 'Freeze' : 'Activate'}
                          >
                            {user.isActive ? <Lock className="w-[15px] h-[15px]" /> : <RefreshCw className="w-[15px] h-[15px]" />}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-gray hover:bg-red-50 hover:text-brand-red transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-[15px] h-[15px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SettingsContentCard>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-dark">New User</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={formRoleId} onChange={(e) => setFormRoleId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy outline-none">
                    <option value="">Select Role</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy outline-none">
                    <option value="">Select Dept</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-brand-dark">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-light disabled:opacity-50 font-medium">
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowEditModal(null); setEditUser(null); }}>
          <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-brand-dark">Edit User: {editUser.name || editUser.email}</h2>
              <button onClick={() => { setShowEditModal(null); setEditUser(null); }} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input disabled value={formEmail} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select value={formRoleId} onChange={(e) => setFormRoleId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy outline-none">
                    <option value="">Select Role</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy outline-none">
                    <option value="">Select Dept</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Leave blank to keep current" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-navy focus:ring-1 focus:ring-brand-navy outline-none" />
                <p className="text-xs text-gray-400 mt-1">Min 6 characters. Leave blank to keep current password.</p>
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => { setShowEditModal(null); setEditUser(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-brand-dark">Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-light disabled:opacity-50 font-medium">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}