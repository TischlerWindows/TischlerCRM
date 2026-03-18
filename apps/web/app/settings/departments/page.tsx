'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Building2,
  Plus,
  Trash2,
  Users,
  X,
  FolderTree,
  Home,
  LayoutDashboard,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { getSetting } from '@/lib/preferences';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { SettingsContentCard } from '@/components/settings/settings-content-card';

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
  const [formHomeLayoutId, setFormHomeLayoutId] = useState<string>('');
  const [homeTemplates, setHomeTemplates] = useState<Array<{ id: string; name: string; layout: any }>>([]);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'home'>('details');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<DepartmentRow[]>('/departments');
      setDepartments(data);
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
    setFormHomeLayoutId('');
    setActiveTab('details');
    setShowEdit(d.id);
  };

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
        subtitle="Organize team hierarchy and reporting structure"
        action={{
          label: 'New Department',
          icon: Plus,
          onClick: () => { resetForm(); setShowCreate(true); },
        }}
      />

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

      <SettingsContentCard>
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading…</div>
        ) : departments.length === 0 ? (
          <div className="p-12 text-center text-gray-500">No departments yet</div>
        ) : (
          rootDepts.map((d) => renderDept(d))
        )}
      </SettingsContentCard>

      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => { setShowCreate(false); setShowEdit(null); resetForm(); }}
        >
          <div
            className="bg-white rounded-lg w-full max-w-lg mx-4 shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-navy" />
                {showEdit ? 'Edit Department' : 'New Department'}
              </h2>
              <button
                onClick={() => { setShowCreate(false); setShowEdit(null); resetForm(); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="border-b px-6 flex gap-0 flex-shrink-0">
              {(['details', 'home'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? 'border-brand-navy text-brand-navy'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'details' ? 'Details' : 'Home Page'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {activeTab === 'details' && (
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name <span className="text-red-500">*</span></label>
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

              {activeTab === 'home' && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Assign a Home Page layout template for members of this department.
                    Users without a personal Home layout will see this layout when they log in.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Home Page Layout Template</label>
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
                {saving ? 'Saving…' : showEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
