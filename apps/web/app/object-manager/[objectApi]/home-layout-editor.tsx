'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, Copy, FileText, Users, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPreference, setPreference, getSetting, setSetting } from '@/lib/preferences';
import { apiClient } from '@/lib/api-client';

const STORAGE_KEY = 'homeLayout';
const TEMPLATES_KEY = 'homeLayoutTemplates';

type HomeLayoutTemplate = {
  id: string;
  name: string;
  layout: HomeLayout;
  createdAt: string;
};

type PanelType = 'report' | 'widget' | 'dashboard';

interface CrmUser {
  id: string;
  name: string | null;
  email: string;
}

type HomePanel = {
  id: string;
  type: PanelType;
  sourceId: string;
  title: string;
  row: number;
  column: number;
  order: number;
};

type HomeLayout = {
  columns: number;
  panels: HomePanel[];
  updatedAt: string;
};

interface SavedReport {
  id: string;
  name: string;
}

interface DashboardWidget {
  id: string;
  title?: string;
  type: string;
}

interface Dashboard {
  id: string;
  name: string;
  widgets: DashboardWidget[];
}

function migrateLayout(raw: any): HomeLayout {
  if (raw?.panels && typeof raw.columns === 'number') {
    const migratedPanels = raw.panels.map((panel: any, index: number) => ({
      ...panel,
      row: panel.row ?? Math.floor(index / Math.max(raw.columns, 1)),
      column: panel.column ?? index % Math.max(raw.columns, 1),
    }));
    return { ...raw, panels: migratedPanels } as HomeLayout;
  }

  if (raw?.rows) {
    const panels = raw.rows
      .sort((a: any, b: any) => a.order - b.order)
      .flatMap((row: any) =>
        row.panels
          .sort((a: any, b: any) => a.order - b.order)
          .map((panel: any) => ({
            ...panel,
            row: row.order ?? 0,
            column: panel.column ?? 0,
          }))
      );

    return {
      columns: Math.min(Math.max(raw.rows[0]?.columns ?? 2, 1), 4),
      panels,
      updatedAt: new Date().toISOString(),
    };
  }

  return { columns: 2, panels: [], updatedAt: new Date().toISOString() };
}

async function loadLayout(): Promise<HomeLayout> {
  try {
    const stored = await getPreference<any>(STORAGE_KEY);
    if (stored) {
      return migrateLayout(stored);
    }
  } catch (e) {
    // fall through to default
  }
  return { columns: 2, panels: [], updatedAt: new Date().toISOString() };
}

export default function HomeLayoutEditor() {
  const [layout, setLayout] = useState<HomeLayout>({ columns: 2, panels: [], updatedAt: '' });
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [widgets, setWidgets] = useState<Array<{ id: string; title: string }>>([]);
  const [dashboardRecords, setDashboardRecords] = useState<Dashboard[]>([]);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [fadeSaved, setFadeSaved] = useState(false);
  const [templates, setTemplates] = useState<HomeLayoutTemplate[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  // User assignment
  const [users, setUsers] = useState<CrmUser[]>([]);
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignSourceId, setAssignSourceId] = useState<'current' | string>('current');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);

  const getNextAvailableSlot = () => {
    const columns = Math.max(layout.columns, 1);
    const maxExistingRow = layout.panels.length > 0
      ? Math.max(...layout.panels.map((panel) => panel.row))
      : 0;

    for (let row = 0; row <= maxExistingRow + 1; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (!getPanelAt(row, column)) {
          return { row, column };
        }
      }
    }

    return { row: maxExistingRow + 1, column: 0 };
  };

  const loadTemplates = async () => {
    try {
      const saved = await getSetting<HomeLayoutTemplate[]>(TEMPLATES_KEY);
      setTemplates(saved || []);
    } catch {
      setTemplates([]);
    }
  };

  const saveAsTemplate = async () => {
    if (!templateName.trim()) return;
    const template: HomeLayoutTemplate = {
      id: `hlt-${Date.now()}`,
      name: templateName.trim(),
      layout: { ...layout, updatedAt: new Date().toISOString() },
      createdAt: new Date().toISOString(),
    };
    const next = [...templates, template];
    await setSetting(TEMPLATES_KEY, next);
    setTemplates(next);
    setTemplateName('');
    setShowTemplateDialog(false);
    setShowSaved(true);
    setFadeSaved(false);
    window.setTimeout(() => setFadeSaved(true), 1500);
    window.setTimeout(() => setShowSaved(false), 2000);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? Departments using it will keep their current assignment.')) return;
    const next = templates.filter((t) => t.id !== id);
    await setSetting(TEMPLATES_KEY, next);
    setTemplates(next);
  };

  const loadFromTemplate = (template: HomeLayoutTemplate) => {
    setLayout({ ...template.layout, updatedAt: new Date().toISOString() });
  };

  useEffect(() => {
    (async () => {
      setLayout(await loadLayout());
      await loadTemplates();

      try {
        const customReports = (await getSetting<any[]>('customReports')) || [];
        setReports(customReports.map((r: any) => ({ id: r.id, name: r.name })));
      } catch (e) {
        console.error('Error loading reports:', e);
      }

      // Load individual widgets from settings (legacy) and real dashboards from API
      try {
        const dashboards: Dashboard[] = (await getSetting<Dashboard[]>('dashboards')) || [];
        const flattenedWidgets = dashboards.flatMap((dashboard) =>
          (dashboard.widgets || []).map((widget) => ({
            id: widget.id,
            title: `${dashboard.name}: ${widget.title || widget.type}`,
          }))
        );
        setWidgets(flattenedWidgets);
      } catch (e) {
        console.error('Error loading dashboards:', e);
      }

      // Fetch real dashboard records from API
      try {
        const dbs = await apiClient.getDashboards();
        setDashboardRecords(dbs || []);
      } catch (e) {
        console.error('Error loading dashboard records:', e);
      }

      // Fetch users for layout assignment
      try {
        const userList = await apiClient.getUsers();
        setUsers(userList || []);
      } catch (e) {
        // Non-admin users won't be able to fetch users — silently ignore
      }
    })();
  }, []);

  const panelsSorted = useMemo(() => {
    return layout.panels
      .slice()
      .sort((a, b) => (a.row - b.row) || (a.order - b.order));
  }, [layout.panels]);

  const maxRow = useMemo(() => {
    return panelsSorted.reduce((acc, panel) => Math.max(acc, panel.row), 0);
  }, [panelsSorted]);

  const persistLayout = (next: HomeLayout) => {
    setPreference(STORAGE_KEY, next);
    setLayout(next);
  };

  const addPanel = (type: PanelType, sourceId: string, title: string) => {
    const slot = getNextAvailableSlot();
    const rowPanels = layout.panels.filter((panel) => panel.row === slot.row);
    const order = rowPanels.length;
    const newPanel: HomePanel = {
      id: `panel-${Date.now()}-${sourceId}`,
      type,
      sourceId,
      title,
      row: slot.row,
      column: slot.column,
      order,
    };

    setLayout({
      ...layout,
      panels: [...layout.panels, newPanel],
      updatedAt: new Date().toISOString(),
    });
  };

  const removePanel = (panelId: string) => {
    const remaining = layout.panels.filter((panel) => panel.id !== panelId);
    const normalized = normalizeOrders(remaining, layout.columns);
    setLayout({ ...layout, panels: normalized, updatedAt: new Date().toISOString() });
  };

  const reorderPanel = (panelId: string, direction: 'up' | 'down') => {
    const panel = layout.panels.find((p) => p.id === panelId);
    if (!panel) return;
    const rowPanels = layout.panels
      .filter((p) => p.row === panel.row)
      .sort((a, b) => a.order - b.order);
    const index = rowPanels.findIndex((p) => p.id === panelId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= rowPanels.length) return;

    const reordered = rowPanels.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const nextPanels = layout.panels.map((p) => {
      if (p.row !== panel.row) return p;
      const nextOrder = reordered.findIndex((item) => item.id === p.id);
      return { ...p, order: nextOrder };
    });

    setLayout({ ...layout, panels: nextPanels, updatedAt: new Date().toISOString() });
  };

  const handleColumnsChange = (columns: number) => {
    const nextColumns = Math.min(Math.max(columns, 1), 4);
    const normalized = normalizeOrders(layout.panels, nextColumns);
    setLayout({
      ...layout,
      columns: nextColumns,
      panels: normalized,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleRowChange = (panelId: string, row: number) => {
    const nextPanels = layout.panels.map((panel) =>
      panel.id === panelId ? { ...panel, row } : panel
    );
    const normalized = normalizeOrders(nextPanels, layout.columns);
    setLayout({ ...layout, panels: normalized, updatedAt: new Date().toISOString() });
  };

  const handleColumnChange = (panelId: string, column: number) => {
    const nextPanels = layout.panels.map((panel) =>
      panel.id === panelId ? { ...panel, column } : panel
    );
    const normalized = normalizeOrders(nextPanels, layout.columns);
    setLayout({ ...layout, panels: normalized, updatedAt: new Date().toISOString() });
  };

  const normalizeOrders = (panels: HomePanel[], columns: number) => {
    const nextPanels = panels.map((panel) => ({ ...panel }));
    const maxRow = nextPanels.reduce((acc, panel) => Math.max(acc, panel.row), 0);

    for (let row = 0; row <= maxRow; row += 1) {
      const rowPanels = nextPanels
        .filter((panel) => panel.row === row)
        .sort((a, b) => (a.column - b.column) || (a.order - b.order))
        .map((panel, index) => ({
          ...panel,
          column: Math.min(panel.column, Math.max(columns - 1, 0)),
          order: index,
        }));

      rowPanels.forEach((panel) => {
        const idx = nextPanels.findIndex((p) => p.id === panel.id);
        if (idx >= 0) nextPanels[idx] = panel;
      });
    }

    return nextPanels;
  };

  const getPanelAt = (row: number, column: number) => {
    return layout.panels.find((panel) => panel.row === row && panel.column === column);
  };

  const handlePanelDragStart = (panelId: string, e: React.DragEvent) => {
    setDraggedPanelId(panelId);
    e.dataTransfer.setData('text/plain', panelId);
    e.dataTransfer.setData('application/home-panel', JSON.stringify({ kind: 'panel', panelId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePanelDragEnd = () => {
    setDraggedPanelId(null);
  };

  const handleSourceDragStart = (type: PanelType, sourceId: string, title: string, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', `${type}:${sourceId}`);
    e.dataTransfer.setData('application/home-panel', JSON.stringify({ kind: 'source', type, sourceId, title }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDropOnCell = (row: number, column: number, e: React.DragEvent) => {
    e.preventDefault();
    const payload = e.dataTransfer.getData('application/home-panel');
    if (!payload) return;
    const data = JSON.parse(payload) as
      | { kind: 'panel'; panelId: string }
      | { kind: 'source'; type: PanelType; sourceId: string; title: string };

    if (data.kind === 'source') {
      const newPanel: HomePanel = {
        id: `panel-${Date.now()}-${data.sourceId}`,
        type: data.type,
        sourceId: data.sourceId,
        title: data.title,
        row,
        column,
        order: 0,
      };

      const swapped = getPanelAt(row, column);
      const nextPanels = swapped
        ? layout.panels.map((panel) =>
            panel.id === swapped.id
              ? { ...panel, row: Math.max(...layout.panels.map((p) => p.row)) + 1, column: 0 }
              : panel
          )
        : layout.panels.slice();

      const normalized = normalizeOrders([...nextPanels, newPanel], layout.columns);
      setLayout({ ...layout, panels: normalized, updatedAt: new Date().toISOString() });
      setDraggedPanelId(null);
      return;
    }

    const draggedPanel = layout.panels.find((panel) => panel.id === data.panelId);
    if (!draggedPanel) return;
    const targetPanel = getPanelAt(row, column);

    const nextPanels = layout.panels.map((panel) => {
      if (panel.id === draggedPanel.id) {
        return { ...panel, row, column };
      }
      if (targetPanel && panel.id === targetPanel.id) {
        return { ...panel, row: draggedPanel.row, column: draggedPanel.column };
      }
      return panel;
    });

    const normalized = normalizeOrders(nextPanels, layout.columns);
    setLayout({ ...layout, panels: normalized, updatedAt: new Date().toISOString() });
    setDraggedPanelId(null);
  };

  const handleDragOverCell = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSave = () => {
    persistLayout({ ...layout, updatedAt: new Date().toISOString() });
    setShowSaved(true);
    setFadeSaved(false);
    window.setTimeout(() => setFadeSaved(true), 1500);
    window.setTimeout(() => setShowSaved(false), 2000);
  };

  const handleReset = () => {
    const next = { columns: 2, panels: [], updatedAt: new Date().toISOString() };
    persistLayout(next);
  };

  const handleAssign = async () => {
    if (selectedUserIds.size === 0) return;
    setAssigning(true);
    setAssignError(null);
    setAssignSuccess(null);

    const layoutToAssign: HomeLayout = assignSourceId === 'current'
      ? { ...layout, updatedAt: new Date().toISOString() }
      : (() => {
          const tmpl = templates.find((t) => t.id === assignSourceId);
          return tmpl ? { ...tmpl.layout, updatedAt: new Date().toISOString() } : { ...layout, updatedAt: new Date().toISOString() };
        })();

    const errors: string[] = [];
    for (const userId of Array.from(selectedUserIds)) {
      try {
        await apiClient.setUserPreferenceAdmin(userId, 'homeLayout', layoutToAssign);
      } catch (e: any) {
        const user = users.find((u) => u.id === userId);
        errors.push(user?.name || user?.email || userId);
      }
    }

    setAssigning(false);
    if (errors.length > 0) {
      setAssignError(`Failed to assign layout to: ${errors.join(', ')}`);
    } else {
      setAssignSuccess(`Layout assigned to ${selectedUserIds.size} user${selectedUserIds.size === 1 ? '' : 's'}.`);
      window.setTimeout(() => setAssignSuccess(null), 3000);
      setShowAssignDialog(false);
      setSelectedUserIds(new Set());
    }
  };

  return (
    <div className="flex h-full">
      {showSaved && (
        <div
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm font-medium w-[420px] text-center transition-opacity duration-300 ${fadeSaved ? 'opacity-0' : 'opacity-100'}`}
        >
          Layout Saved!
        </div>
      )}
      <aside className="w-80 border-r bg-white p-4 space-y-6 overflow-y-auto">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Reports</h3>
          <div className="space-y-2">
            {reports.length === 0 && (
              <p className="text-xs text-gray-500">No reports available.</p>
            )}
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => handleSourceDragStart('report', report.id, report.name, e)}
                  className="flex-1 text-left text-sm text-gray-700 truncate cursor-move"
                >
                  {report.name}
                </div>
                <Button size="sm" variant="outline" onClick={() => addPanel('report', report.id, report.name)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Dashboards</h3>
          <div className="space-y-2">
            {dashboardRecords.length === 0 && (
              <p className="text-xs text-gray-500">No dashboards found. Create dashboards first.</p>
            )}
            {dashboardRecords.map((db) => (
              <div key={db.id} className="flex items-center justify-between gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => handleSourceDragStart('dashboard', db.id, db.name, e)}
                  className="flex items-center gap-1.5 flex-1 text-left text-sm text-gray-700 truncate cursor-move"
                >
                  <LayoutDashboard className="h-3.5 w-3.5 text-brand-navy shrink-0" />
                  {db.name}
                </div>
                <Button size="sm" variant="outline" onClick={() => addPanel('dashboard', db.id, db.name)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Dashboard Widgets</h3>
          <div className="space-y-2">
            {widgets.length === 0 && (
              <p className="text-xs text-gray-500">No dashboard widgets available.</p>
            )}
            {widgets.map((widget) => (
              <div key={widget.id} className="flex items-center justify-between gap-2">
                <div
                  role="button"
                  tabIndex={0}
                  draggable
                  onDragStart={(e) => handleSourceDragStart('widget', widget.id, widget.title, e)}
                  className="flex-1 text-left text-sm text-gray-700 truncate cursor-move"
                >
                  {widget.title}
                </div>
                <Button size="sm" variant="outline" onClick={() => addPanel('widget', widget.id, widget.title)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} size="sm" className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Layout
          </Button>
          <Button onClick={handleReset} size="sm" variant="outline">
            Reset
          </Button>
        </div>

        <div className="border-t pt-4 space-y-2">
          <Button onClick={() => setShowTemplateDialog(true)} size="sm" variant="outline" className="w-full">
            <Copy className="h-4 w-4 mr-2" />
            Save as Template
          </Button>
          {users.length > 0 && (
            <Button
              onClick={() => { setAssignSourceId('current'); setSelectedUserIds(new Set()); setAssignError(null); setAssignSuccess(null); setShowAssignDialog(true); }}
              size="sm"
              variant="outline"
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              Assign Layout to Users
            </Button>
          )}
          {assignSuccess && (
            <p className="text-xs text-green-600 text-center">{assignSuccess}</p>
          )}
        </div>

        {/* Saved Templates */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Page Layout Templates</h3>
          {templates.length === 0 && (
            <p className="text-xs text-gray-500">No templates saved yet. Save the current layout as a template to assign it to departments.</p>
          )}
          <div className="space-y-2">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 p-2 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.layout.panels?.length || 0} panels · {t.layout.columns} cols</div>
                </div>
                <div className="flex items-center gap-1">
                  {users.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Assign this template to users"
                      onClick={() => { setAssignSourceId(t.id); setSelectedUserIds(new Set()); setAssignError(null); setAssignSuccess(null); setShowAssignDialog(true); }}
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => loadFromTemplate(t)} title="Load into editor">
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteTemplate(t.id)} title="Delete template">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Assign Layout to Users Dialog */}
      {showAssignDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-labelledby="assign-dialog-title">
          <div className="bg-white rounded-xl shadow-xl w-[480px] max-h-[80vh] flex flex-col p-6">
            <h3 id="assign-dialog-title" className="text-lg font-semibold mb-1">Assign Layout to Users</h3>
            <p className="text-sm text-gray-600 mb-4">
              Overwrites the selected users&apos; home page with{' '}
              {assignSourceId === 'current'
                ? 'the current layout'
                : `the &ldquo;${templates.find((t) => t.id === assignSourceId)?.name}&rdquo; template`}.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">Layout to assign</label>
              <select
                value={assignSourceId}
                onChange={(e) => setAssignSourceId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              >
                <option value="current">Current layout (unsaved changes included)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg mb-4">
              <div className="p-2 flex items-center justify-between border-b border-gray-100">
                <span className="text-xs font-medium text-gray-700">Users ({users.length})</span>
                <button
                  type="button"
                  className="text-xs text-brand-navy hover:underline"
                  onClick={() => setSelectedUserIds(
                    selectedUserIds.size === users.length ? new Set() : new Set(users.map((u) => u.id))
                  )}
                >
                  {selectedUserIds.size === users.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.has(u.id)}
                    onChange={(e) => {
                      const next = new Set(selectedUserIds);
                      if (e.target.checked) next.add(u.id); else next.delete(u.id);
                      setSelectedUserIds(next);
                    }}
                    className="rounded border-gray-300 text-brand-navy focus:ring-brand-navy/40"
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{u.name || u.email}</div>
                    {u.name && <div className="text-xs text-gray-500 truncate">{u.email}</div>}
                  </div>
                </label>
              ))}
            </div>

            {assignError && <p className="text-xs text-red-600 mb-3" role="alert">{assignError}</p>}

            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowAssignDialog(false); setAssignError(null); }} disabled={assigning}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleAssign} disabled={selectedUserIds.size === 0 || assigning}>
                {assigning ? 'Assigning…' : `Assign to ${selectedUserIds.size} user${selectedUserIds.size === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Save as Template Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-[400px] p-6">
            <h3 className="text-lg font-semibold mb-2">Save as Template</h3>
            <p className="text-sm text-gray-600 mb-4">Give this home page layout a name. You can then assign it to departments.</p>
            <input
              type="text"
              placeholder="e.g. Sales Home, Support Home"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveAsTemplate()}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setShowTemplateDialog(false); setTemplateName(''); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={saveAsTemplate} disabled={!templateName.trim()}>
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 p-6 bg-gray-50 overflow-y-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Layout</h2>
          <select
            value={layout.columns}
            onChange={(e) => handleColumnsChange(Number(e.target.value))}
            className="border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {[1, 2, 3, 4].map((count) => (
              <option key={count} value={count}>
                {count} Column{count === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>

        {panelsSorted.length === 0 && (
          <div className="border border-dashed border-gray-300 rounded-lg p-6 text-sm text-gray-500">
            Add panels to start building your Home layout.
          </div>
        )}

        <div className="space-y-4">
          {Array.from({ length: maxRow + 2 }, (_, rowIndex) => (
            <div
              key={rowIndex}
              className={`grid gap-4 ${
                layout.columns === 1
                  ? 'grid-cols-1'
                  : layout.columns === 2
                    ? 'grid-cols-2'
                    : layout.columns === 3
                      ? 'grid-cols-3'
                      : 'grid-cols-4'
              }`}
            >
              {Array.from({ length: layout.columns }, (_, colIndex) => {
                const panel = getPanelAt(rowIndex, colIndex);
                return (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    onDragOver={handleDragOverCell}
                    onDrop={(e) => handleDropOnCell(rowIndex, colIndex, e)}
                    className="min-h-[140px] rounded-lg border-2 border-dashed border-gray-300 bg-white p-3 flex"
                  >
                    {panel ? (
                      <div
                        draggable
                        onDragStart={(e) => handlePanelDragStart(panel.id, e)}
                        onDragEnd={handlePanelDragEnd}
                        className={`flex-1 rounded-lg border border-gray-200 bg-gray-50 p-3 cursor-move ${
                          draggedPanelId === panel.id ? 'ring-2 ring-brand-navy/30' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{panel.title}</div>
                            <div className="text-xs text-gray-500">{panel.type === 'report' ? 'Report' : panel.type === 'dashboard' ? 'Dashboard' : 'Widget'}</div>
                          </div>
                          <button
                            onClick={() => removePanel(panel.id)}
                            className="text-gray-400 hover:text-red-500"
                            aria-label="Remove panel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Row</span>
                            <select
                              value={panel.row + 1}
                              onChange={(e) => handleRowChange(panel.id, Math.max(Number(e.target.value) - 1, 0))}
                              className="border border-gray-300 rounded px-2 py-1"
                            >
                              {Array.from({ length: maxRow + 2 }, (_, index) => index + 1).map((rowValue) => (
                                <option key={rowValue} value={rowValue}>
                                  Row {rowValue}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500">Column</span>
                            <select
                              value={panel.column + 1}
                              onChange={(e) => handleColumnChange(panel.id, Math.max(Number(e.target.value) - 1, 0))}
                              className="border border-gray-300 rounded px-2 py-1"
                            >
                              {Array.from({ length: layout.columns }, (_, index) => index + 1).map((colValue) => (
                                <option key={colValue} value={colValue}>
                                  Column {colValue}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            onClick={() => reorderPanel(panel.id, 'up')}
                            disabled={panel.order === 0}
                            className="p-1 border rounded disabled:opacity-50"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => reorderPanel(panel.id, 'down')}
                            disabled={panel.order === panelsSorted.filter((item) => item.row === panel.row).length - 1}
                            className="p-1 border rounded disabled:opacity-50"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
                        Drop here
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
