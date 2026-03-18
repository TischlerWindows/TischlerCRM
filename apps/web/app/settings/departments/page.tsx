'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Users,
  X,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Save,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';

interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  parentId: string | null;
  isActive: boolean;
  parent: { id: string; name: string } | null;
  children: { id: string; name: string }[];
  _count: { users: number };
}

interface DepartmentDetail extends DepartmentRow {
  users: {
    id: string;
    name: string | null;
    email: string;
    isActive: boolean;
    title: string | null;
  }[];
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  isActive: boolean;
  title: string | null;
  department: { id: string; name: string } | null;
}

type TreeNode = DepartmentRow & { childNodes: TreeNode[] };

function buildTree(departments: DepartmentRow[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const d of departments) {
    map.set(d.id, { ...d, childNodes: [] });
  }
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.childNodes.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

function getDescendantIds(deptId: string, departments: DepartmentRow[]): Set<string> {
  const ids = new Set<string>();
  const queue = [deptId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const d of departments) {
      if (d.parentId === current && !ids.has(d.id)) {
        ids.add(d.id);
        queue.push(d.id);
      }
    }
  }
  return ids;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DepartmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formParent, setFormParent] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [addingUserId, setAddingUserId] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<DepartmentRow[]>('/departments');
      setDepartments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await apiClient.get<DepartmentDetail>(`/departments/${id}`);
      setDetail(data);
      setFormName(data.name);
      setFormDesc(data.description || '');
      setFormParent(data.parentId || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load department details');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const users = await apiClient.getUsers();
      setAllUsers(users as unknown as UserOption[]);
    } catch {
      // non-critical
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const selectDepartment = useCallback(
    (id: string) => {
      setIsCreating(false);
      setSelectedId(id);
      setShowAddUser(false);
      loadDetail(id);
    },
    [loadDetail],
  );

  const startCreate = useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setIsCreating(true);
    setFormName('');
    setFormDesc('');
    setFormParent('');
    setShowAddUser(false);
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      const created = await apiClient.post<DepartmentRow>('/admin/departments', {
        name: formName.trim(),
        description: formDesc.trim() || null,
        parentId: formParent || null,
      });
      setSuccess(`Department "${formName.trim()}" created`);
      await load();
      setIsCreating(false);
      selectDepartment(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create department');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedId || !formName.trim()) return;
    setSaving(true);
    try {
      await apiClient.put(`/admin/departments/${selectedId}`, {
        name: formName.trim(),
        description: formDesc.trim() || null,
        parentId: formParent || null,
      });
      setSuccess('Department updated');
      await load();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update department');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirm('Delete this department? Users must be reassigned first.')) return;
    setDeleting(true);
    try {
      await apiClient.delete(`/admin/departments/${selectedId}`);
      setSuccess('Department deleted');
      setSelectedId(null);
      setDetail(null);
      setIsCreating(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete department');
    } finally {
      setDeleting(false);
    }
  };

  const handleAddUser = async (userId: string) => {
    if (!selectedId) return;
    setAddingUserId(userId);
    try {
      await apiClient.updateUser(userId, { departmentId: selectedId });
      setSuccess('User added to department');
      setShowAddUser(false);
      await loadDetail(selectedId);
      await load();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user');
    } finally {
      setAddingUserId(null);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    if (!selectedId) return;
    setRemovingUserId(userId);
    try {
      await apiClient.updateUser(userId, { departmentId: null });
      setSuccess('User removed from department');
      await loadDetail(selectedId);
      await load();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove user');
    } finally {
      setRemovingUserId(null);
    }
  };

  const tree = useMemo(() => buildTree(departments), [departments]);

  const excludedParentIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const desc = getDescendantIds(selectedId, departments);
    desc.add(selectedId);
    return desc;
  }, [selectedId, departments]);

  const availableParents = useMemo(() => {
    return departments.filter((d) => !excludedParentIds.has(d.id));
  }, [departments, excludedParentIds]);

  const availableUsers = useMemo(() => {
    if (!detail) return [];
    const memberIds = new Set(detail.users.map((u) => u.id));
    return allUsers.filter((u) => !memberIds.has(u.id) && u.isActive);
  }, [allUsers, detail]);

  const toggleCollapse = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError(null);
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  const renderTreeNode = (node: TreeNode, depth: number, isLast: boolean) => {
    const isSelected = selectedId === node.id;
    const hasChildren = node.childNodes.length > 0;
    const isExpanded = !collapsed.has(node.id);

    return (
      <div key={node.id} className="relative">
        {/* Connector lines */}
        {depth > 0 && (
          <>
            {/* Horizontal connector */}
            <div
              className="absolute top-[18px] h-px bg-gray-300"
              style={{ left: `${depth * 24 - 12}px`, width: '12px' }}
            />
            {/* Vertical connector for non-last siblings */}
            {!isLast && (
              <div
                className="absolute top-0 bottom-0 w-px bg-gray-300"
                style={{ left: `${depth * 24 - 12}px` }}
              />
            )}
            {/* Vertical connector top half for last sibling */}
            {isLast && (
              <div
                className="absolute top-0 w-px bg-gray-300"
                style={{ left: `${depth * 24 - 12}px`, height: '18px' }}
              />
            )}
          </>
        )}

        {/* Node row */}
        <div
          className={`relative flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-all group ${
            isSelected
              ? 'bg-[#151f6d]/5 border-l-2 border-[#151f6d]'
              : 'hover:bg-gray-50 border-l-2 border-transparent'
          }`}
          style={{ marginLeft: `${depth * 24}px` }}
          onClick={() => selectDepartment(node.id)}
        >
          {hasChildren ? (
            <button
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-gray-200 transition-colors flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse(node.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
              )}
            </button>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
            </div>
          )}
          <span
            className={`text-sm font-medium truncate ${
              isSelected ? 'text-[#151f6d]' : 'text-gray-800'
            }`}
          >
            {node.name}
          </span>
          <span className="ml-auto flex-shrink-0 text-[11px] font-medium bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 tabular-nums">
            {node._count.users}
          </span>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div className="relative">
            {/* Vertical line connecting children */}
            {node.childNodes.length > 1 && (
              <div
                className="absolute w-px bg-gray-300"
                style={{
                  left: `${(depth + 1) * 24 - 12}px`,
                  top: 0,
                  bottom: '18px',
                }}
              />
            )}
            {node.childNodes.map((child, idx) =>
              renderTreeNode(child, depth + 1, idx === node.childNodes.length - 1),
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      <SettingsPageHeader
        icon={Building2}
        title="Departments"
        subtitle="Organize team hierarchy and reporting structure"
        action={{
          label: 'New Department',
          icon: Plus,
          onClick: startCreate,
        }}
      />

      {error && (
        <div className="mx-8 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between items-start">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-2 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {success && (
        <div className="mx-8 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between items-start">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-2 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-0 flex-1 min-h-0 mx-8 mt-6 mb-8">
        {/* Left panel: Tree */}
        <div className="w-full lg:w-[40%] bg-white rounded-xl lg:rounded-r-none border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-[#151f6d]" />
            <h2 className="text-sm font-semibold text-gray-800">Hierarchy</h2>
            <span className="text-xs text-gray-400 ml-auto">
              {departments.length} department{departments.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                Loading…
              </div>
            ) : departments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Building2 className="w-8 h-8 text-gray-300 mb-2" />
                <p className="text-sm text-gray-500">No departments yet</p>
                <button
                  onClick={startCreate}
                  className="mt-3 text-sm text-[#151f6d] hover:underline font-medium"
                >
                  Create your first department
                </button>
              </div>
            ) : (
              tree.map((node, idx) => renderTreeNode(node, 0, idx === tree.length - 1))
            )}
          </div>
        </div>

        {/* Right panel: Detail */}
        <div className="w-full lg:w-[60%] bg-white rounded-xl lg:rounded-l-none border border-gray-200 lg:border-l-0 flex flex-col overflow-hidden">
          {!selectedId && !isCreating ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-[#f0f1f9] flex items-center justify-center mb-4">
                <Building2 className="w-7 h-7 text-[#151f6d]/40" />
              </div>
              <p className="text-sm text-gray-500">Select a department to view details</p>
              <p className="text-xs text-gray-400 mt-1">
                Or create a new department to get started
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isCreating ? 'New Department' : detail?.name || ''}
                </h2>
                <div className="flex items-center gap-2">
                  {!isCreating && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                  <button
                    onClick={isCreating ? handleCreate : handleUpdate}
                    disabled={saving || !formName.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-[#151f6d] rounded-lg hover:bg-[#151f6d]/90 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Saving…' : isCreating ? 'Create' : 'Save'}
                  </button>
                </div>
              </div>

              {detailLoading && !isCreating ? (
                <div className="flex items-center justify-center py-12 text-sm text-gray-400">
                  Loading details…
                </div>
              ) : (
                <>
                  {/* Details form */}
                  <div className="px-6 py-5 border-b border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">
                      Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d] outline-none transition-shadow"
                          placeholder="e.g. Sales"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description
                        </label>
                        <textarea
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d] outline-none transition-shadow resize-none"
                          rows={2}
                          placeholder="Brief description of this department"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Parent Department
                        </label>
                        <select
                          value={formParent}
                          onChange={(e) => setFormParent(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#151f6d]/20 focus:border-[#151f6d] outline-none transition-shadow"
                        >
                          <option value="">None (Top Level)</option>
                          {(isCreating ? departments : availableParents).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Members section (only for existing departments) */}
                  {!isCreating && detail && (
                    <div className="px-6 py-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          Members
                          <span className="text-[11px] font-medium bg-gray-100 text-gray-500 rounded-full px-1.5 py-0.5 ml-1 normal-case tracking-normal">
                            {detail.users.length}
                          </span>
                        </h3>
                        <button
                          onClick={() => setShowAddUser(!showAddUser)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#151f6d] border border-[#151f6d]/20 rounded-lg hover:bg-[#151f6d]/5 transition-colors"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Add User
                        </button>
                      </div>

                      {/* Add user dropdown */}
                      {showAddUser && (
                        <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden bg-[#f8f8fc]">
                          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-600">
                              Select a user to add
                            </span>
                            <button
                              onClick={() => setShowAddUser(false)}
                              className="p-0.5 rounded hover:bg-gray-200"
                            >
                              <X className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            {availableUsers.length === 0 ? (
                              <div className="px-3 py-4 text-center text-xs text-gray-400">
                                No available users to add
                              </div>
                            ) : (
                              availableUsers.map((u) => (
                                <button
                                  key={u.id}
                                  onClick={() => handleAddUser(u.id)}
                                  disabled={addingUserId === u.id}
                                  className="w-full text-left px-3 py-2 hover:bg-white flex items-center gap-2 border-b border-gray-100 last:border-b-0 transition-colors disabled:opacity-50"
                                >
                                  <div className="w-7 h-7 rounded-full bg-[#151f6d]/10 flex items-center justify-center flex-shrink-0">
                                    <span className="text-[10px] font-semibold text-[#151f6d]">
                                      {(u.name || u.email).charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm text-gray-800 truncate">
                                      {u.name || u.email}
                                    </div>
                                    <div className="text-[11px] text-gray-400 truncate">
                                      {u.email}
                                    </div>
                                  </div>
                                  {addingUserId === u.id ? (
                                    <span className="text-[11px] text-gray-400">Adding…</span>
                                  ) : (
                                    <Plus className="w-3.5 h-3.5 text-[#151f6d] flex-shrink-0" />
                                  )}
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      {/* Member rows */}
                      {detail.users.length === 0 ? (
                        <div className="text-center py-8 text-sm text-gray-400">
                          No members in this department
                        </div>
                      ) : (
                        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                          {detail.users.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
                            >
                              <div className="w-8 h-8 rounded-full bg-[#151f6d]/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-[#151f6d]">
                                  {(u.name || u.email).charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-800 truncate">
                                  {u.name || u.email}
                                </div>
                                <div className="text-[11px] text-gray-400 truncate">
                                  {u.email}
                                  {u.title && ` · ${u.title}`}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                                  u.isActive
                                    ? 'bg-emerald-50 text-emerald-600'
                                    : 'bg-amber-50 text-amber-600'
                                }`}
                              >
                                {u.isActive ? 'Active' : 'Frozen'}
                              </span>
                              <button
                                onClick={() => handleRemoveUser(u.id)}
                                disabled={removingUserId === u.id}
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 flex-shrink-0"
                                title="Remove from department"
                              >
                                {removingUserId === u.id ? (
                                  <span className="text-[10px]">…</span>
                                ) : (
                                  <UserMinus className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
