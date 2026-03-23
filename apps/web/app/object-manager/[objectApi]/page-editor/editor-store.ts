import { create } from 'zustand';
import type {
  FormattingRule,
  PageLayout,
  WidgetType,
  WidgetConfig,
} from '@/lib/schema';
import type {
  CanvasField,
  CanvasSection,
  CanvasTab,
  CanvasWidget,
  ColumnCount,
  SelectedElement,
} from './types';
import type { LayoutPresetId } from './layout-presets';
import { getPresetSections } from './layout-presets';
import { normalizeCanvasTabGrids } from '@/lib/tab-canvas-grid';

interface Snapshot {
  tabs: CanvasTab[];
  sections: CanvasSection[];
  fields: CanvasField[];
  widgets: CanvasWidget[];
  highlightFields: string[];
}

export interface EditorState {
  // Data
  tabs: CanvasTab[];
  sections: CanvasSection[];
  fields: CanvasField[];
  widgets: CanvasWidget[];

  // UI
  activeTabId: string;
  selectedElement: SelectedElement;
  layoutName: string;
  editingLayoutId: string | null;
  /** Field API names for record header highlights (max ~6 in UI) */
  highlightFields: string[];
  formattingRules: FormattingRule[];
  hasUnsavedChanges: boolean;

  // Undo
  undoStack: Snapshot[];

  // Actions — tabs
  setLayoutName: (name: string) => void;
  setActiveTab: (tabId: string) => void;
  setSelectedElement: (el: SelectedElement) => void;
  addTab: () => void;
  updateTabLabel: (tabId: string, label: string) => void;
  deleteTab: (tabId: string) => void;

  // Actions — sections
  addSection: () => void;
  updateSection: (id: string, updates: Partial<CanvasSection>) => void;
  deleteSection: (id: string) => void;
  moveSection: (id: string, dir: 'up' | 'down') => void;
  updateSectionColumns: (id: string, cols: ColumnCount) => void;
  toggleSectionCollapsed: (id: string) => void;
  /** Resize shared border between two sections on the same grid row (12-col canvas). */
  adjustAdjacentGridSpans: (
    leftSectionId: string,
    rightSectionId: string,
    deltaLeftSpan: number,
  ) => void;
  /** Append preset sections to the active tab (undoable). */
  applyLayoutPreset: (presetId: LayoutPresetId) => void;

  // Actions — fields
  addField: (field: CanvasField) => void;
  updateField: (id: string, updates: Partial<CanvasField>) => void;
  deleteField: (id: string) => void;
  setFields: (fields: CanvasField[]) => void;

  // Actions — widgets
  addWidget: (widget: CanvasWidget) => void;
  updateWidget: (id: string, updates: Partial<CanvasWidget>) => void;
  deleteWidget: (id: string) => void;
  setWidgets: (widgets: CanvasWidget[]) => void;

  // Highlights (layout-level)
  setHighlightFields: (apiNames: string[]) => void;
  addHighlightField: (apiName: string) => void;
  removeHighlightField: (apiName: string) => void;
  moveHighlightField: (index: number, dir: 'up' | 'down') => void;

  // Actions — formatting
  setFormattingRules: (rules: FormattingRule[]) => void;

  // Actions — lifecycle
  loadLayout: (layout: PageLayout) => void;
  reset: () => void;
  markSaved: () => void;
  markDirty: () => void;
  pushUndo: () => void;
  undo: () => void;
}

const DEFAULT_TABS: CanvasTab[] = [
  { id: 'tab-1', label: 'General Information', order: 0 },
];

const DEFAULT_SECTIONS: CanvasSection[] = [
  {
    id: 'section-1',
    label: 'Basic Details',
    tabId: 'tab-1',
    columns: 2,
    order: 0,
    collapsed: false,
    showInRecord: true,
    showInTemplate: true,
    gridRow: 1,
    gridColumn: 1,
    gridColumnSpan: 12,
    gridRowSpan: 1,
  },
];

export const useEditorStore = create<EditorState>()((set, get) => ({
  // Initial state
  tabs: DEFAULT_TABS,
  sections: DEFAULT_SECTIONS,
  fields: [],
  widgets: [],
  activeTabId: 'tab-1',
  selectedElement: null,
  layoutName: 'Page Layout',
  editingLayoutId: null,
  highlightFields: [],
  formattingRules: [],
  hasUnsavedChanges: false,
  undoStack: [],

  // Layout name
  setLayoutName: (name) => set({ layoutName: name, hasUnsavedChanges: true }),
  setActiveTab: (tabId) => set({ activeTabId: tabId }),
  setSelectedElement: (el) => set({ selectedElement: el }),

  // Tabs
  addTab: () => {
    const { tabs } = get();
    const newTab: CanvasTab = {
      id: `tab-${Date.now()}`,
      label: `New Tab ${tabs.length + 1}`,
      order: tabs.length,
    };
    set({ tabs: [...tabs, newTab], activeTabId: newTab.id, hasUnsavedChanges: true });
  },

  updateTabLabel: (tabId, label) => {
    set((s) => ({
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, label } : t)),
      hasUnsavedChanges: true,
    }));
  },

  deleteTab: (tabId) => {
    const { tabs, sections, fields, widgets, activeTabId } = get();
    if (tabs.length <= 1) return;
    const remaining = tabs.filter((t) => t.id !== tabId);
    const sectionIds = new Set(sections.filter((s) => s.tabId === tabId).map((s) => s.id));
    set({
      tabs: remaining,
      sections: sections.filter((s) => s.tabId !== tabId),
      fields: fields.filter((f) => !sectionIds.has(f.sectionId)),
      widgets: widgets.filter((w) => w.tabId !== tabId),
      activeTabId: activeTabId === tabId ? remaining[0]?.id || '' : activeTabId,
      hasUnsavedChanges: true,
    });
  },

  // Sections
  addSection: () => {
    const { sections, widgets, activeTabId } = get();
    const tabSections = sections.filter((s) => s.tabId === activeTabId);
    const tabWids = widgets.filter((w) => w.tabId === activeTabId && !w.sectionId);
    let maxRowEnd = 0;
    for (const s of tabSections) {
      const end = (s.gridRow ?? 1) + (s.gridRowSpan ?? 1) - 1;
      if (end > maxRowEnd) maxRowEnd = end;
    }
    for (const w of tabWids) {
      const end = (w.gridRow ?? 1) + (w.gridRowSpan ?? 1) - 1;
      if (end > maxRowEnd) maxRowEnd = end;
    }
    const newSection: CanvasSection = {
      id: `section-${Date.now()}`,
      label: `New Section ${tabSections.length + 1}`,
      tabId: activeTabId,
      columns: 2,
      order: tabSections.length,
      collapsed: false,
      showInRecord: true,
      showInTemplate: true,
      gridRow: maxRowEnd + 1,
      gridColumn: 1,
      gridColumnSpan: 12,
      gridRowSpan: 1,
    };
    set({ sections: [...sections, newSection], hasUnsavedChanges: true });
  },

  updateSection: (id, updates) => {
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...updates } : sec)),
      hasUnsavedChanges: true,
    }));
  },

  adjustAdjacentGridSpans: (leftSectionId: string, rightSectionId: string, deltaLeftSpan: number) => {
    set((s) => {
      const left = s.sections.find((sec) => sec.id === leftSectionId);
      const right = s.sections.find((sec) => sec.id === rightSectionId);
      if (!left || !right) return s;
      const rowL = left.gridRow ?? 1;
      const rowR = right.gridRow ?? 1;
      if (rowL !== rowR) return s;
      const lCol = left.gridColumn ?? 1;
      const lSpan = left.gridColumnSpan ?? 12;
      const rCol = right.gridColumn ?? 1;
      if (lCol + lSpan !== rCol) return s;
      const rSpan = right.gridColumnSpan ?? 12;
      const newL = Math.max(1, Math.min(lSpan + rSpan - 1, lSpan + deltaLeftSpan));
      const newR = lSpan + rSpan - newL;
      if (newR < 1) return s;
      return {
        sections: s.sections.map((sec) => {
          if (sec.id === leftSectionId) return { ...sec, gridColumnSpan: newL };
          if (sec.id === rightSectionId) {
            return { ...sec, gridColumn: lCol + newL, gridColumnSpan: newR };
          }
          return sec;
        }),
        hasUnsavedChanges: true,
      };
    });
  },

  deleteSection: (id) => {
    set((s) => ({
      sections: s.sections.filter((sec) => sec.id !== id),
      fields: s.fields.filter((f) => f.sectionId !== id),
      widgets: s.widgets.filter((w) => w.sectionId !== id),
      hasUnsavedChanges: true,
    }));
  },

  moveSection: (id, dir) => {
    const { sections, activeTabId } = get();
    const tabSections = sections
      .filter((s) => s.tabId === activeTabId)
      .sort((a, b) => a.order - b.order);
    const idx = tabSections.findIndex((s) => s.id === id);
    if (idx < 0) return;
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === tabSections.length - 1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    const currentOrder = tabSections[idx].order;
    const swapOrder = tabSections[swapIdx].order;
    set({
      sections: sections.map((s) => {
        if (s.id === tabSections[idx].id) return { ...s, order: swapOrder };
        if (s.id === tabSections[swapIdx].id) return { ...s, order: currentOrder };
        return s;
      }),
      hasUnsavedChanges: true,
    });
  },

  updateSectionColumns: (id, cols) => {
    set((s) => {
      const maxCol = cols - 1;
      const nextFields = s.fields.map((f) => {
        if (f.sectionId !== id) return f;
        const column = Math.min(f.column, maxCol);
        const colSpan = Math.min(f.colSpan, cols - column);
        return { ...f, column, colSpan: Math.max(1, colSpan) };
      });
      const nextWidgets = s.widgets.map((w) => {
        if (w.sectionId !== id) return w;
        const column = Math.min(w.column, maxCol);
        const colSpan = Math.min(w.colSpan, cols - column);
        return { ...w, column, colSpan: Math.max(1, colSpan) };
      });
      return {
        sections: s.sections.map((sec) => (sec.id === id ? { ...sec, columns: cols } : sec)),
        fields: nextFields,
        widgets: nextWidgets,
        hasUnsavedChanges: true,
      };
    });
  },

  toggleSectionCollapsed: (id) => {
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === id ? { ...sec, collapsed: !sec.collapsed } : sec,
      ),
    }));
  },

  applyLayoutPreset: (presetId) => {
    get().pushUndo();
    const { sections, fields, widgets, activeTabId } = get();
    const removedIds = new Set(
      sections.filter((s) => s.tabId === activeTabId).map((s) => s.id),
    );
    const keptSections = sections.filter((s) => s.tabId !== activeTabId);
    const specs = getPresetSections(presetId);
    const ts = Date.now();
    const newSections: CanvasSection[] = specs.map((spec, i) => ({
      id: `section-${ts}-${i}`,
      label: spec.label,
      tabId: activeTabId,
      columns: spec.columns,
      order: i,
      collapsed: false,
      showInRecord: true,
      showInTemplate: true,
      layoutRowId: spec.layoutRowId,
      rowWeight: spec.rowWeight,
      gridColumn: spec.gridColumn,
      gridColumnSpan: spec.gridColumnSpan,
      gridRow: spec.gridRow,
      gridRowSpan: spec.gridRowSpan,
    }));
    set({
      sections: [...keptSections, ...newSections],
      fields: fields.filter((f) => !removedIds.has(f.sectionId)),
      widgets: widgets.filter((w) => {
        if (w.tabId !== activeTabId) return true;
        if (!w.sectionId) return true;
        return !removedIds.has(w.sectionId);
      }),
      selectedElement: null,
      hasUnsavedChanges: true,
    });
  },

  // Fields
  addField: (field) => {
    set((s) => ({ fields: [...s.fields, field], hasUnsavedChanges: true }));
  },

  updateField: (id, updates) => {
    set((s) => ({
      fields: s.fields.map((f) => (f.id === id ? { ...f, ...updates } : f)),
      hasUnsavedChanges: true,
    }));
  },

  deleteField: (id) => {
    set((s) => ({ fields: s.fields.filter((f) => f.id !== id), hasUnsavedChanges: true }));
  },

  setFields: (fields) => set({ fields }),

  // Widgets
  addWidget: (widget) => {
    set((s) => ({ widgets: [...s.widgets, widget], hasUnsavedChanges: true }));
  },

  updateWidget: (id, updates) => {
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...updates } : w)),
      hasUnsavedChanges: true,
    }));
  },

  deleteWidget: (id) => {
    set((s) => ({ widgets: s.widgets.filter((w) => w.id !== id), hasUnsavedChanges: true }));
  },

  setWidgets: (widgets) => set({ widgets, hasUnsavedChanges: true }),

  setHighlightFields: (apiNames) =>
    set({ highlightFields: apiNames.slice(0, 8), hasUnsavedChanges: true }),

  addHighlightField: (apiName) => {
    set((s) => {
      if (s.highlightFields.includes(apiName) || s.highlightFields.length >= 6) return s;
      return {
        highlightFields: [...s.highlightFields, apiName],
        hasUnsavedChanges: true,
      };
    });
  },

  removeHighlightField: (apiName) => {
    set((s) => ({
      highlightFields: s.highlightFields.filter((a) => a !== apiName),
      hasUnsavedChanges: true,
    }));
  },

  moveHighlightField: (index, dir) => {
    set((s) => {
      const arr = [...s.highlightFields];
      const j = dir === 'up' ? index - 1 : index + 1;
      if (j < 0 || j >= arr.length) return s;
      const t = arr[index];
      arr[index] = arr[j];
      arr[j] = t;
      return { highlightFields: arr, hasUnsavedChanges: true };
    });
  },

  // Formatting rules
  setFormattingRules: (rules) => set({ formattingRules: rules, hasUnsavedChanges: true }),

  // Load an existing PageLayout into canvas state
  loadLayout: (layout) => {
    const newTabs: CanvasTab[] = [];
    const newSections: CanvasSection[] = [];
    const newFields: CanvasField[] = [];
    const newWidgets: CanvasWidget[] = [];
    let fieldCounter = 1;
    let widgetCounter = 1;
    let sectionLoadCounter = 1;

    layout.tabs.forEach((tab, tabIdx) => {
      const tabId = tab.id || `tab-${tabIdx + 1}`;
      newTabs.push({
        id: tabId,
        label: tab.label,
        order: tab.order,
      });

      tab.sections.forEach((section) => {
        const sectionId = section.id || `section-load-${sectionLoadCounter++}`;
        newSections.push({
          id: sectionId,
          label: section.label,
          tabId,
          columns: section.columns || 2,
          order: section.order,
          collapsed: false,
          description: section.description,
          visibleIf: section.visibleIf,
          showInRecord: section.showInRecord !== false,
          showInTemplate: section.showInTemplate !== false,
          layoutRowId: section.layoutRowId,
          rowWeight: section.rowWeight,
          gridColumn: section.gridColumn,
          gridColumnSpan: section.gridColumnSpan,
          gridRow: section.gridRow,
          gridRowSpan: section.gridRowSpan,
        });

        section.fields.forEach((f) => {
          newFields.push({
            id: `placed-${fieldCounter++}-${f.apiName}`,
            fieldApiName: f.apiName,
            sectionId,
            column: f.column,
            order: f.order,
            colSpan: (f as any).colSpan ?? 1,
            rowSpan: (f as any).rowSpan ?? 1,
            presentation: f.presentation,
          });
        });

        if (section.widgets) {
          section.widgets.forEach((w) => {
            newWidgets.push({
              id: w.id || `widget-${widgetCounter++}-${w.widgetType}`,
              widgetType: w.widgetType,
              tabId,
              sectionId,
              column: w.column,
              order: w.order,
              colSpan: w.colSpan ?? 1,
              rowSpan: w.rowSpan ?? 1,
              config: w.config,
            });
          });
        }
      });

      if (tab.widgets?.length) {
        tab.widgets.forEach((w) => {
          newWidgets.push({
            id: w.id || `widget-${widgetCounter++}-${w.widgetType}`,
            widgetType: w.widgetType,
            tabId,
            sectionId: '',
            column: w.column ?? 0,
            order: w.order,
            colSpan: w.colSpan ?? 1,
            rowSpan: w.rowSpan ?? 1,
            config: w.config,
            gridColumn: w.gridColumn,
            gridColumnSpan: w.gridColumnSpan,
            gridRow: w.gridRow,
            gridRowSpan: w.gridRowSpan,
          });
        });
      }
    });

    newTabs.forEach((tab) => {
      normalizeCanvasTabGrids(newSections, newWidgets, tab.id);
    });

    const formattingRules =
      layout.formattingRules?.length
        ? layout.formattingRules
        : ((layout.extensions?.formattingRules as FormattingRule[] | undefined) ?? []);

    set({
      editingLayoutId: layout.id,
      layoutName: layout.name || 'Page Layout',
      highlightFields: [...(layout.highlightFields || [])].slice(0, 6),
      tabs: newTabs.length ? newTabs : DEFAULT_TABS,
      sections: newSections,
      fields: newFields,
      widgets: newWidgets,
      activeTabId: newTabs[0]?.id || 'tab-1',
      selectedElement: null,
      formattingRules,
      hasUnsavedChanges: false,
      undoStack: [],
    });
  },

  // Reset to defaults (new layout)
  reset: () =>
    set({
      tabs: [{ id: 'tab-1', label: 'General Information', order: 0 }],
      sections: [
        {
          id: 'section-1',
          label: 'Basic Details',
          tabId: 'tab-1',
          columns: 2,
          order: 0,
          collapsed: false,
          showInRecord: true,
          showInTemplate: true,
          gridRow: 1,
          gridColumn: 1,
          gridColumnSpan: 12,
          gridRowSpan: 1,
        },
      ],
      fields: [],
      widgets: [],
      activeTabId: 'tab-1',
      selectedElement: null,
      layoutName: 'Page Layout',
      editingLayoutId: null,
      highlightFields: [],
      formattingRules: [],
      hasUnsavedChanges: false,
      undoStack: [],
    }),

  markSaved: () => set({ hasUnsavedChanges: false }),
  markDirty: () => set({ hasUnsavedChanges: true }),

  // Undo
  pushUndo: () => {
    const { tabs, sections, fields, widgets, highlightFields, undoStack } = get();
    const snapshot: Snapshot = {
      tabs: structuredClone(tabs),
      sections: structuredClone(sections),
      fields: structuredClone(fields),
      widgets: structuredClone(widgets),
      highlightFields: [...highlightFields],
    };
    set({ undoStack: [...undoStack.slice(-29), snapshot] });
  },

  undo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      tabs: prev.tabs,
      sections: prev.sections,
      fields: prev.fields,
      widgets: prev.widgets,
      highlightFields: [...(prev.highlightFields ?? [])],
      undoStack: undoStack.slice(0, -1),
      hasUnsavedChanges: true,
    });
  },
}));
