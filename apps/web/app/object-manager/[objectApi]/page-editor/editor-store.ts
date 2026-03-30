import { create } from 'zustand';
import type {
  EditorPageLayout,
  SelectedElement,
  LayoutTab,
  LayoutSection,
  LayoutPanel,
  PanelField,
  LayoutWidget,
  FormattingRule,
} from './types';

// ── Helper finders ────────────────────────────────────────────────────────────

function findRegionEntry(
  layout: EditorPageLayout,
  regionId: string,
): { tab: LayoutTab; region: LayoutSection } | undefined {
  for (const tab of layout.tabs) {
    const region = tab.regions.find((r) => r.id === regionId);
    if (region) return { tab, region };
  }
}

function findPanelEntry(
  layout: EditorPageLayout,
  panelId: string,
): { tab: LayoutTab; region: LayoutSection; panel: LayoutPanel } | undefined {
  for (const tab of layout.tabs) {
    for (const region of tab.regions) {
      const panel = region.panels.find((p) => p.id === panelId);
      if (panel) return { tab, region, panel };
    }
  }
}

function findWidgetEntry(
  layout: EditorPageLayout,
  widgetId: string,
): { tab: LayoutTab; region: LayoutSection; widget: LayoutWidget } | undefined {
  for (const tab of layout.tabs) {
    for (const region of tab.regions) {
      const widget = region.widgets.find((w) => w.id === widgetId);
      if (widget) return { tab, region, widget };
    }
  }
}

function reindexOrder<T extends { order: number }>(items: T[]): T[] {
  return items.map((item, index) => ({ ...item, order: index }));
}

// ── Default layout ────────────────────────────────────────────────────────────

const DEFAULT_LAYOUT: EditorPageLayout = {
  id: '',
  name: 'New Layout',
  objectApi: '',
  active: false,
  isDefault: false,
  roles: [],
  tabs: [
    {
      id: 'tab-1',
      label: 'Details',
      order: 0,
      regions: [],
    },
  ],
  formattingRules: [],
};

// ── State interface ───────────────────────────────────────────────────────────

export interface EditorState {
  layout: EditorPageLayout;
  selectedElement: SelectedElement;
  isDirty: boolean;
  undoStack: EditorPageLayout[];
  redoStack: EditorPageLayout[];
  activeTabId: string;

  // Non-mutating UI actions
  setSelectedElement: (el: SelectedElement) => void;
  setActiveTab: (tabId: string) => void;

  // Mutating layout metadata
  setLayoutName: (name: string) => void;

  // Section actions
  updateSection: (regionId: string, patch: Partial<LayoutSection>) => void;
  addSection: (region: LayoutSection, tabId: string) => void;
  removeSection: (regionId: string) => void;
  resizeSection: (regionId: string, newColSpan: number) => void;
  swapSections: (regionIdA: string, regionIdB: string) => void;

  // Panel actions
  updatePanel: (panelId: string, patch: Partial<LayoutPanel>) => void;
  addPanel: (panel: LayoutPanel, regionId: string) => void;
  removePanel: (panelId: string) => void;
  movePanel: (panelId: string, regionId: string, toIndex: number) => void;

  // Field actions
  updateField: (fieldApiName: string, panelId: string, patch: Partial<PanelField>) => void;
  addField: (field: PanelField, panelId: string, atIndex?: number) => void;
  removeField: (fieldApiName: string, panelId: string) => void;
  moveField: (fieldApiName: string, fromPanelId: string, toPanelId: string, atIndex: number) => void;
  resizeField: (fieldApiName: string, panelId: string, newColSpan: number) => void;

  // Widget actions
  updateWidget: (widgetId: string, patch: Partial<LayoutWidget>) => void;
  addWidget: (widget: LayoutWidget, regionId: string, atIndex?: number) => void;
  removeWidget: (widgetId: string) => void;
  moveWidget: (widgetId: string, toRegionId: string, atIndex: number) => void;

  // Tab actions
  addTab: (label?: string) => void;
  updateTab: (tabId: string, patch: Partial<LayoutTab>) => void;
  removeTab: (tabId: string) => void;

  // Formatting rules
  setFormattingRules: (rules: FormattingRule[]) => void;

  // Undo/redo
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;

  // Lifecycle
  loadLayout: (layout: EditorPageLayout) => void;
  reset: () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()((set, get) => ({
  layout: structuredClone(DEFAULT_LAYOUT),
  selectedElement: null,
  isDirty: false,
  undoStack: [],
  redoStack: [],
  activeTabId: 'tab-1',

  // ── Non-mutating UI ────────────────────────────────────────────────────────

  setSelectedElement: (el) => set({ selectedElement: el }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  // ── Undo/redo ──────────────────────────────────────────────────────────────

  pushUndo: () => {
    const { layout, undoStack } = get();
    const snapshot = structuredClone(layout);
    set({
      undoStack: [...undoStack, snapshot].slice(-30),
      redoStack: [],
      isDirty: true,
    });
  },

  undo: () => {
    const { undoStack, redoStack, layout } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      layout: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, structuredClone(layout)],
      isDirty: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack, layout } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      layout: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, structuredClone(layout)].slice(-30),
      isDirty: true,
    });
  },

  // ── Layout metadata ────────────────────────────────────────────────────────

  setLayoutName: (name) => {
    get().pushUndo();
    set((s) => ({ layout: { ...s.layout, name } }));
  },

  // ── Section actions ─────────────────────────────────────────────────────────

  updateSection: (regionId, patch) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((r) =>
            r.id === regionId ? { ...r, ...patch } : r,
          ),
        })),
      },
    }));
  },

  addSection: (region, tabId) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) =>
          tab.id === tabId ? { ...tab, regions: [...tab.regions, region] } : tab,
        ),
      },
    }));
  },

  removeSection: (regionId) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.filter((r) => r.id !== regionId),
        })),
      },
    }));
  },

  resizeSection: (regionId, newColSpan) => {
    get().pushUndo();
    set((s) => {
      const entry = findRegionEntry(s.layout, regionId);
      if (!entry) return s;
      const { tab, region } = entry;
      const oldSpan = region.gridColumnSpan;
      const clampedSpan = Math.max(2, Math.min(10, newColSpan));
      const delta = clampedSpan - oldSpan;

      const sameRow = tab.regions.filter(
        (r) => r.id !== regionId && r.gridRow === region.gridRow,
      );
      const rightNeighbor = sameRow.find(
        (r) => r.gridColumn === region.gridColumn + oldSpan,
      );

      const newTabs = s.layout.tabs.map((t) => {
        if (t.id !== tab.id) return t;
        return {
          ...t,
          regions: t.regions.map((r) => {
            if (r.id === regionId) return { ...r, gridColumnSpan: clampedSpan };
            if (rightNeighbor && r.id === rightNeighbor.id) {
              return {
                ...r,
                gridColumn: region.gridColumn + clampedSpan,
                gridColumnSpan: Math.max(2, rightNeighbor.gridColumnSpan - delta),
              };
            }
            return r;
          }),
        };
      });

      return { layout: { ...s.layout, tabs: newTabs } };
    });
  },

  swapSections: (regionIdA, regionIdB) => {
    // Preflight both lookups before modifying undo stack
    const currentLayout = get().layout;
    const entryA = findRegionEntry(currentLayout, regionIdA);
    const entryB = findRegionEntry(currentLayout, regionIdB);
    if (!entryA || !entryB) return;

    get().pushUndo();
    set((s) => {
      // Re-read from s.layout inside set for safety (in case of concurrent updates)
      const a = findRegionEntry(s.layout, regionIdA);
      const b = findRegionEntry(s.layout, regionIdB);
      if (!a || !b) return s;

      const { gridColumn: colA, gridRow: rowA, gridColumnSpan: spanA, gridRowSpan: rowSpanA } = a.region;
      const { gridColumn: colB, gridRow: rowB, gridColumnSpan: spanB, gridRowSpan: rowSpanB } = b.region;

      return {
        layout: {
          ...s.layout,
          tabs: s.layout.tabs.map((tab) => ({
            ...tab,
            regions: tab.regions.map((r) => {
              if (r.id === regionIdA) {
                return { ...r, gridColumn: colB, gridRow: rowB, gridColumnSpan: spanB, gridRowSpan: rowSpanB };
              }
              if (r.id === regionIdB) {
                return { ...r, gridColumn: colA, gridRow: rowA, gridColumnSpan: spanA, gridRowSpan: rowSpanA };
              }
              return r;
            }),
          })),
        },
      };
    });
  },

  // ── Panel actions ──────────────────────────────────────────────────────────

  updatePanel: (panelId, patch) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            panels: region.panels.map((p) =>
              p.id === panelId ? { ...p, ...patch } : p,
            ),
          })),
        })),
      },
    }));
  },

  addPanel: (panel, regionId) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) =>
            region.id === regionId
              ? { ...region, panels: reindexOrder([...region.panels, panel]) }
              : region,
          ),
        })),
      },
    }));
  },

  removePanel: (panelId) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            panels: reindexOrder(region.panels.filter((p) => p.id !== panelId)),
          })),
        })),
      },
    }));
  },

  movePanel: (panelId, regionId, toIndex) => {
    get().pushUndo();
    set((s) => {
      const entry = findPanelEntry(s.layout, panelId);
      if (!entry) return s;
      const panelToMove = entry.panel;
      const sourceRegionId = entry.region.id;

      const captured = panelToMove;
      const srcId = sourceRegionId;
      const fromIndex = entry.region.panels.findIndex((p) => p.id === panelId);

      const newTabs = s.layout.tabs.map((tab) => ({
        ...tab,
        regions: tab.regions.map((region) => {
          const isSrc = region.id === srcId;
          const isDst = region.id === regionId;

          if (isSrc && !isDst) {
            return {
              ...region,
              panels: reindexOrder(region.panels.filter((p) => p.id !== panelId)),
            };
          }
          if (!isSrc && isDst) {
            const panels = [...region.panels];
            const insertionIndex = Math.max(0, Math.min(toIndex, panels.length));
            panels.splice(insertionIndex, 0, captured);
            return { ...region, panels: reindexOrder(panels) };
          }
          if (isSrc && isDst) {
            const panels = region.panels.filter((p) => p.id !== panelId);
            const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;
            const insertionIndex = Math.max(0, Math.min(adjustedTo, panels.length));
            panels.splice(insertionIndex, 0, captured);
            return { ...region, panels: reindexOrder(panels) };
          }
          return region;
        }),
      }));

      return { layout: { ...s.layout, tabs: newTabs } };
    });
  },

  // ── Field actions ──────────────────────────────────────────────────────────

  updateField: (fieldApiName, panelId, patch) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            panels: region.panels.map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    fields: panel.fields.map((f) =>
                      f.fieldApiName === fieldApiName ? { ...f, ...patch } : f,
                    ),
                  }
                : panel,
            ),
          })),
        })),
      },
    }));
  },

  addField: (field, panelId, atIndex) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            panels: region.panels.map((panel) => {
              if (panel.id !== panelId) return panel;
              const fields = [...panel.fields];
              if (atIndex !== undefined) {
                const insertionIndex = Math.max(0, Math.min(atIndex, fields.length));
                fields.splice(insertionIndex, 0, field);
              } else {
                fields.push(field);
              }
              return { ...panel, fields: reindexOrder(fields) };
            }),
          })),
        })),
      },
    }));
  },

  removeField: (fieldApiName, panelId) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            panels: region.panels.map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    fields: reindexOrder(
                      panel.fields.filter((f) => f.fieldApiName !== fieldApiName),
                    ),
                  }
                : panel,
            ),
          })),
        })),
      },
    }));
  },

  moveField: (fieldApiName, fromPanelId, toPanelId, atIndex) => {
    get().pushUndo();
    set((s) => {
      const entry = findPanelEntry(s.layout, fromPanelId);
      if (!entry) return s;
      const fieldToMove = entry.panel.fields.find((f) => f.fieldApiName === fieldApiName);
      if (!fieldToMove) return s;

      const captured = fieldToMove;

      const newTabs = s.layout.tabs.map((tab) => ({
        ...tab,
        regions: tab.regions.map((region) => ({
          ...region,
          panels: region.panels.map((panel) => {
            const isSrc = panel.id === fromPanelId;
            const isDst = panel.id === toPanelId;

            if (isSrc && !isDst) {
              return {
                ...panel,
                fields: reindexOrder(
                  panel.fields.filter((f) => f.fieldApiName !== fieldApiName),
                ),
              };
            }
            if (!isSrc && isDst) {
              const fields = [...panel.fields];
              const insertionIndex = Math.max(0, Math.min(atIndex, fields.length));
              fields.splice(insertionIndex, 0, captured);
              return { ...panel, fields: reindexOrder(fields) };
            }
            if (isSrc && isDst) {
              const fields = panel.fields.filter((f) => f.fieldApiName !== fieldApiName);
              const insertionIndex = Math.max(0, Math.min(atIndex, fields.length));
              fields.splice(insertionIndex, 0, captured);
              return { ...panel, fields: reindexOrder(fields) };
            }
            return panel;
          }),
        })),
      }));

      return { layout: { ...s.layout, tabs: newTabs } };
    });
  },

  resizeField: (fieldApiName, panelId, newColSpan) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            panels: region.panels.map((panel) =>
              panel.id === panelId
                ? {
                    ...panel,
                    fields: panel.fields.map((f) =>
                      f.fieldApiName === fieldApiName ? { ...f, colSpan: newColSpan } : f,
                    ),
                  }
                : panel,
            ),
          })),
        })),
      },
    }));
  },

  // ── Widget actions ─────────────────────────────────────────────────────────

  updateWidget: (widgetId, patch) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            widgets: region.widgets.map((w) =>
              w.id === widgetId ? { ...w, ...patch } : w,
            ),
          })),
        })),
      },
    }));
  },

  addWidget: (widget, regionId, atIndex) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => {
            if (region.id !== regionId) return region;
            const widgets = [...region.widgets];
            if (atIndex !== undefined) {
              const insertionIndex = Math.max(0, Math.min(atIndex, widgets.length));
              widgets.splice(insertionIndex, 0, widget);
            } else {
              widgets.push(widget);
            }
            return { ...region, widgets: reindexOrder(widgets) };
          }),
        })),
      },
    }));
  },

  removeWidget: (widgetId) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((tab) => ({
          ...tab,
          regions: tab.regions.map((region) => ({
            ...region,
            widgets: reindexOrder(region.widgets.filter((w) => w.id !== widgetId)),
          })),
        })),
      },
    }));
  },

  moveWidget: (widgetId, toRegionId, atIndex) => {
    get().pushUndo();
    set((s) => {
      const sourceEntry = findWidgetEntry(s.layout, widgetId);
      if (!sourceEntry) return s;
      const destinationEntry = findRegionEntry(s.layout, toRegionId);
      if (!destinationEntry) return s;

      const widgetToMove = sourceEntry.widget;
      const sourceRegionId = sourceEntry.region.id;

      const newTabs = s.layout.tabs.map((tab) => ({
        ...tab,
        regions: tab.regions.map((region) => {
          const isSrc = region.id === sourceRegionId;
          const isDst = region.id === toRegionId;

          if (isSrc && isDst) {
            const widgets = region.widgets.filter((w) => w.id !== widgetId);
            const insertionIndex = Math.max(0, Math.min(atIndex, widgets.length));
            widgets.splice(insertionIndex, 0, widgetToMove);
            return { ...region, widgets: reindexOrder(widgets) };
          }

          if (isSrc && !isDst) {
            return {
              ...region,
              widgets: reindexOrder(region.widgets.filter((w) => w.id !== widgetId)),
            };
          }

          if (!isSrc && isDst) {
            const widgets = [...region.widgets];
            const insertionIndex = Math.max(0, Math.min(atIndex, widgets.length));
            widgets.splice(insertionIndex, 0, widgetToMove);
            return { ...region, widgets: reindexOrder(widgets) };
          }

          return region;
        }),
      }));

      return { layout: { ...s.layout, tabs: newTabs } };
    });
  },

  // ── Tab actions ────────────────────────────────────────────────────────────

  addTab: (label) => {
    get().pushUndo();
    set((s) => {
      const newTab: LayoutTab = {
        id: `tab-${Date.now()}`,
        label: label ?? `Tab ${s.layout.tabs.length + 1}`,
        order: s.layout.tabs.length,
        regions: [],
      };
      return {
        layout: { ...s.layout, tabs: [...s.layout.tabs, newTab] },
        activeTabId: newTab.id,
      };
    });
  },

  updateTab: (tabId, patch) => {
    get().pushUndo();
    set((s) => ({
      layout: {
        ...s.layout,
        tabs: s.layout.tabs.map((t) => (t.id === tabId ? { ...t, ...patch } : t)),
      },
    }));
  },

  removeTab: (tabId) => {
    get().pushUndo();
    set((s) => {
      if (s.layout.tabs.length <= 1) return s;
      const remaining = s.layout.tabs.filter((t) => t.id !== tabId);
      return {
        layout: { ...s.layout, tabs: remaining },
        activeTabId:
          s.activeTabId === tabId ? (remaining[0]?.id ?? '') : s.activeTabId,
      };
    });
  },

  // ── Formatting rules ───────────────────────────────────────────────────────

  setFormattingRules: (rules) => {
    get().pushUndo();
    set((s) => ({ layout: { ...s.layout, formattingRules: rules } }));
  },

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  loadLayout: (layout) => {
    set({
      layout,
      selectedElement: null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      activeTabId: layout.tabs[0]?.id ?? '',
    });
  },

  reset: () => {
    set({
      layout: structuredClone(DEFAULT_LAYOUT),
      selectedElement: null,
      isDirty: false,
      undoStack: [],
      redoStack: [],
      activeTabId: 'tab-1',
    });
  },
}));
