'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, LayoutTemplate, Loader2, Plus, Save, Search, Trash2 } from 'lucide-react';
import { SettingsPageHeader } from '@/components/settings/settings-page-header';
import { apiClient, type UserRow } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { useSchemaStore } from '@/lib/schema-store';
import {
  createDefaultSearchPageLayoutSettings,
  type SearchPageLayout,
  type SearchPageLayoutSettings,
} from '@/lib/search-page-layouts';

const SETTINGS_KEY = 'searchPageLayouts';
const fieldClass = 'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800';

export default function SearchLayoutsSettingsPage() {
  const { user } = useAuth();
  const { schema, loadSchema } = useSchemaStore();
  const [config, setConfig] = useState<SearchPageLayoutSettings | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!schema) void loadSchema();
  }, [schema, loadSchema]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      apiClient.getSetting(SETTINGS_KEY).catch(() => null),
      apiClient.getUsers(),
    ]).then(([saved, activeUsers]) => {
      if (cancelled) return;
      const value = saved?.value as SearchPageLayoutSettings | undefined;
      if (value && Array.isArray(value.layouts)) {
        setConfig({
          version: 1,
          layouts: value.layouts,
          defaultLayoutId: value.defaultLayoutId,
          userAssignments: value.userAssignments ?? {},
        });
        setSelectedLayoutId(value.layouts[0]?.id ?? '');
      }
      setUsers(activeUsers.filter(row => row.isActive));
    }).catch(cause => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : 'Failed to load search layout settings.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user?.role]);

  const searchableObjects = useMemo(() => (schema?.objects ?? [])
    .filter(objectDef => objectDef.searchConfig?.enabled)
    .map(objectDef => ({
      apiName: objectDef.apiName,
      label: objectDef.pluralLabel || objectDef.label,
    }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })), [schema]);

  useEffect(() => {
    if (loading || !schema || config) return;
    const defaults = createDefaultSearchPageLayoutSettings(searchableObjects.map(objectDef => objectDef.apiName));
    setConfig(defaults);
    setSelectedLayoutId(defaults.layouts[0]?.id ?? '');
  }, [config, loading, schema, searchableObjects]);

  const currentLayout = config?.layouts.find(layout => layout.id === selectedLayoutId) ?? null;

  const updateCurrentLayout = (updates: Partial<SearchPageLayout>) => {
    if (!currentLayout || !config) return;
    setConfig({
      ...config,
      layouts: config.layouts.map(layout => layout.id === currentLayout.id ? { ...layout, ...updates } : layout),
    });
  };

  const handleCreate = () => {
    if (!config) return;
    const id = globalThis.crypto?.randomUUID?.() ?? `search-layout-${Date.now()}`;
    const layout: SearchPageLayout = {
      id,
      name: `Search Layout ${config.layouts.length + 1}`,
      objectApiNames: searchableObjects.map(objectDef => objectDef.apiName),
    };
    setConfig({ ...config, layouts: [...config.layouts, layout] });
    setSelectedLayoutId(id);
    setError(null);
    setSuccess(null);
  };

  const handleDelete = () => {
    if (!config || !currentLayout || config.layouts.length < 2) return;
    const layouts = config.layouts.filter(layout => layout.id !== currentLayout.id);
    const defaultLayoutId = config.defaultLayoutId === currentLayout.id ? layouts[0]!.id : config.defaultLayoutId;
    const userAssignments = Object.fromEntries(
      Object.entries(config.userAssignments).filter(([, layoutId]) => layoutId !== currentLayout.id),
    );
    setConfig({ ...config, layouts, defaultLayoutId, userAssignments });
    setSelectedLayoutId(defaultLayoutId ?? layouts[0]!.id);
    setSuccess(null);
  };

  const handleAssignment = (userId: string, layoutId: string) => {
    if (!config) return;
    const userAssignments = { ...config.userAssignments };
    if (layoutId) userAssignments[userId] = layoutId;
    else delete userAssignments[userId];
    setConfig({ ...config, userAssignments });
    setSuccess(null);
  };

  const handleSave = async () => {
    if (!config) return;
    if (config.layouts.some(layout => !layout.name.trim())) {
      setError('Every search layout needs a name.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiClient.setSetting(SETTINGS_KEY, {
        ...config,
        layouts: config.layouts.map(layout => ({ ...layout, name: layout.name.trim() })),
      });
      setSuccess('Search page layouts saved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to save search layouts.');
    } finally {
      setSaving(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-8">
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">Only administrators can manage search page layouts and user assignments.</div>
      </div>
    );
  }

  if (loading || !config) {
    return <div className="flex min-h-[320px] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-navy" /></div>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <SettingsPageHeader
        icon={Search}
        title="Search Page Layouts"
        subtitle="Choose which searchable objects appear in global search results and assign layouts to users."
        action={{ label: saving ? 'Saving…' : 'Save Changes', icon: Save, onClick: () => { void handleSave(); } }}
      />
      <div className="space-y-6 p-4 sm:p-8">
        {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
        {success && <div role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

        <section className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Layouts</h2>
              <p className="mt-0.5 text-xs text-gray-500">Users without an assignment receive the default layout.</p>
            </div>
            <button type="button" onClick={handleCreate} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Plus className="h-4 w-4" /> New Layout
            </button>
          </div>
          <div className="grid md:grid-cols-[220px_minmax(0,1fr)]">
            <nav aria-label="Search layouts" className="border-b border-gray-200 p-2 md:border-b-0 md:border-r">
              {config.layouts.map(layout => (
                <button
                  key={layout.id}
                  type="button"
                  onClick={() => setSelectedLayoutId(layout.id)}
                  className={`mb-1 flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm ${layout.id === selectedLayoutId ? 'bg-[#f0f1fa] font-medium text-brand-navy' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <span className="truncate">{layout.name || 'Untitled layout'}</span>
                  {layout.id === config.defaultLayoutId && <span className="ml-2 text-[10px] uppercase text-gray-500">Default</span>}
                </button>
              ))}
            </nav>

            {currentLayout && (
              <div className="min-w-0 space-y-6 p-4 sm:p-6">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="min-w-[220px] flex-1 text-sm font-medium text-gray-700">
                    Layout name
                    <input className={`${fieldClass} mt-1`} value={currentLayout.name} onChange={event => updateCurrentLayout({ name: event.target.value })} maxLength={80} />
                  </label>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, defaultLayoutId: currentLayout.id })}
                    disabled={config.defaultLayoutId === currentLayout.id}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-default disabled:bg-gray-100"
                  >
                    {config.defaultLayoutId === currentLayout.id ? <span className="inline-flex items-center gap-1"><Check className="h-4 w-4" /> Default</span> : 'Set as Default'}
                  </button>
                  <button type="button" onClick={handleDelete} disabled={config.layouts.length < 2} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-40">
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </div>

                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">Searchable Objects</h3>
                      <p className="mt-0.5 text-xs text-gray-500">Only objects enabled for search are listed here.</p>
                    </div>
                    <span className="text-xs text-gray-500">{currentLayout.objectApiNames.length} selected</span>
                  </div>
                  {searchableObjects.length === 0 ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No objects are currently enabled for global search.</p>
                  ) : (
                    <div className="grid gap-1 rounded-md border border-gray-200 p-2 sm:grid-cols-2 lg:grid-cols-3">
                      {searchableObjects.map(objectDef => {
                        const checked = currentLayout.objectApiNames.includes(objectDef.apiName);
                        return (
                          <label key={objectDef.apiName} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => updateCurrentLayout({
                                objectApiNames: checked
                                  ? currentLayout.objectApiNames.filter(apiName => apiName !== objectDef.apiName)
                                  : [...currentLayout.objectApiNames, objectDef.apiName],
                              })}
                              className="h-4 w-4 rounded border-gray-300 text-brand-navy focus:ring-brand-navy"
                            />
                            {objectDef.label}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section>
                  <div className="mb-2">
                    <h3 className="text-sm font-semibold text-gray-900">User Assignments</h3>
                    <p className="mt-0.5 text-xs text-gray-500">Assign one layout per user. Unassigned users use the default.</p>
                  </div>
                  <div className="overflow-x-auto rounded-md border border-gray-200">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
                        <tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Search Layout</th></tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {users.map(row => (
                          <tr key={row.id}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-gray-800">{row.name || row.email}</div>
                              {row.name && <div className="text-xs text-gray-500">{row.email}</div>}
                            </td>
                            <td className="px-3 py-2">
                              <select className={fieldClass} value={config.userAssignments[row.id] ?? ''} onChange={event => handleAssignment(row.id, event.target.value)}>
                                <option value="">Use default layout</option>
                                {config.layouts.map(layout => <option key={layout.id} value={layout.id}>{layout.name || 'Untitled layout'}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                        {users.length === 0 && <tr><td colSpan={2} className="px-3 py-6 text-center text-sm text-gray-500">No active users found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            )}
          </div>
        </section>

        <div className="flex justify-end">
          <button type="button" onClick={() => { void handleSave(); }} disabled={saving} className="inline-flex items-center gap-2 rounded-md bg-brand-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-navy-dark disabled:opacity-50">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}