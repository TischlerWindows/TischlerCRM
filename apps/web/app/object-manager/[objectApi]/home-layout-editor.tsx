'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'homeLayout';

type PanelType = 'report' | 'widget';

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

function loadLayout(): HomeLayout {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return migrateLayout(JSON.parse(stored));
    } catch (e) {
      return { columns: 2, panels: [], updatedAt: new Date().toISOString() };
    }
  }
  return { columns: 2, panels: [], updatedAt: new Date().toISOString() };
}

export default function HomeLayoutEditor() {
  const [layout, setLayout] = useState<HomeLayout>({ columns: 2, panels: [], updatedAt: '' });
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [widgets, setWidgets] = useState<Array<{ id: string; title: string }>>([]);
  const [draggedPanelId, setDraggedPanelId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  const [fadeSaved, setFadeSaved] = useState(false);

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

  useEffect(() => {
    setLayout(loadLayout());

    const savedReports = localStorage.getItem('customReports');
    const customReports = savedReports ? JSON.parse(savedReports) : [];
    setReports(customReports.map((r: any) => ({ id: r.id, name: r.name })));

    const savedDashboards = localStorage.getItem('dashboards');
    const dashboards: Dashboard[] = savedDashboards ? JSON.parse(savedDashboards) : [];
    const flattenedWidgets = dashboards.flatMap((dashboard) =>
      (dashboard.widgets || []).map((widget) => ({
        id: widget.id,
        title: `${dashboard.name}: ${widget.title || widget.type}`,
      }))
    );
    setWidgets(flattenedWidgets);
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
      </aside>

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
                          draggedPanelId === panel.id ? 'ring-2 ring-indigo-300' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{panel.title}</div>
                            <div className="text-xs text-gray-500">{panel.type === 'report' ? 'Report' : 'Widget'}</div>
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
