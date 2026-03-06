'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Plus,
  Trash2,
  Users,
  ChevronRight,
  X,
  FolderTree,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';

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

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formParent, setFormParent] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setFormName(''); setFormDesc(''); setFormParent(''); };

  const handleCreate = async () => {
    if (!formName) return;
    setSaving(true);
    try {
      await apiClient.post('/departments', { name: formName, description: formDesc || null, parentId: formParent || null });
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
      await apiClient.put(`/departments/${showEdit}`, { name: formName, description: formDesc || null, parentId: formParent || null });
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
    setShowEdit(d.id);
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

  const renderDept = (d: DepartmentRow, depth: number = 0) => (
    <div key={d.id}>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100`} style={{ paddingLeft: `${16 + depth * 24}px` }}>
        {childMap.has(d.id) && <FolderTree className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        {!childMap.has(d.id) && <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <button onClick={() => openEdit(d)} className="text-sm font-medium text-brand-navy hover:underline">{d.name}</button>
          {d.description && <p className="text-xs text-gray-500 truncate">{d.description}</p>}
        </div>
        <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" />{d._count.users}</span>
        <button onClick={() => handleDelete(d.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {childMap.get(d.id)?.map((child) => renderDept(child, depth + 1))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/settings" className="p-1 hover:bg-gray-100 rounded"><ArrowLeft className="w-5 h-5 text-gray-500" /></Link>
            <Building2 className="w-6 h-6 text-brand-navy" />
            <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          </div>
          <p className="text-sm text-gray-600 ml-10">Organize users by department with hierarchy</p>
        </div>
      </div>

      {error && <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex justify-between">{error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button></div>}
      {success && <div className="mx-6 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex justify-between">{success}<button onClick={() => setSuccess(null)}><X className="w-4 h-4" /></button></div>}

      <div className="px-6 py-4 flex justify-end">
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="px-4 py-2 bg-brand-navy text-white text-sm font-medium rounded-lg hover:bg-brand-navy/90 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

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

      {/* Create/Edit Modal */}
      {(showCreate || showEdit) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => { setShowCreate(false); setShowEdit(null); }}>
          <div className="bg-white rounded-lg w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold">{showEdit ? 'Edit Department' : 'New Department'}</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={formDesc} onChange={(e) => setFormDesc(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent Department</label>
                <select value={formParent} onChange={(e) => setFormParent(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="">None (Top Level)</option>
                  {departments.filter((d) => d.id !== showEdit).map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="border-t px-6 py-3 flex justify-end gap-2">
              <button onClick={() => { setShowCreate(false); setShowEdit(null); }} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={showEdit ? handleUpdate : handleCreate} disabled={!formName || saving} className="px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy/90 disabled:opacity-50">
                {saving ? 'Saving...' : showEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
