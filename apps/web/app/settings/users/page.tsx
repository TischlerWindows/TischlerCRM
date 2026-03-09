'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Plus,
  Search,
  Building2,
  UserCheck,
  UserX,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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
  profile: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  manager: { id: string; name: string; email: string } | null;
}

interface Department {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
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

  // Create form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formDeptId, setFormDeptId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersData, deptsData] = await Promise.all([
        apiClient.get<UserRow[]>('/admin/users'),
        apiClient.get<Department[]>('/departments'),
      ]);
      setUsers(usersData);
      setDepartments(deptsData);
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
      });
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
    if (!confirm(`Are you sure you want to permanently delete ${user.name || user.email}? This cannot be undone.`)) return;
    try {
      await apiClient.delete(`/admin/users/${user.id}`);
      setSuccess(`User "${user.name || user.email}" deleted`);
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
    setShowEditModal(user.id);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormTitle('');
    setFormPhone('');
    setFormDeptId('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <Users className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">Manage user accounts and departments</p>
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

      {/* Toolbar */}
      <div className="px-6 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-navy focus:border-brand-navy"
            />
          </div>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as '' | 'true' | 'false')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Status</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <button onClick={loadData} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => { resetForm(); setShowCreateModal(true); }}
            className="ml-auto px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy/90 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-8">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Last Login</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-navy flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{user.name || '—'}</div>
                            {user.title && <div className="text-xs text-gray-500">{user.title}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {user.department?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            user.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {user.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(user)}
                            className="px-3 py-1 text-xs font-medium text-brand-navy hover:bg-brand-navy/10 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(user.id)}
                            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                              user.isActive
                                ? 'text-red-600 hover:bg-red-50'
                                : 'text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {user.isActive ? 'Freeze' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500">{filteredUsers.length} user(s)</div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">New User</h2>
              <button onClick={() => setShowCreateModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
                <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Select Dept</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleCreate} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowEditModal(null); setEditUser(null); }}>
          <div className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Edit User: {editUser.name || editUser.email}</h2>
              <button onClick={() => { setShowEditModal(null); setEditUser(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input disabled value={formEmail} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select value={formDeptId} onChange={(e) => setFormDeptId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                    <option value="">Select Dept</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => { setShowEditModal(null); setEditUser(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleUpdate} disabled={saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
