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

interface Snapshot {
  tabs: CanvasTab[];
  sections: CanvasSection[];
  fields: CanvasField[];
  widgets: CanvasWidget[];
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

  // Actions — fields
  addField: (field: CanvasField) => void;
  updateField: (id: string, updates: Partial<CanvasField>) => void;
  deleteField: (id: string) => void;
  setFields: (fields: CanvasField[]) => void;

  // Actions — widgets
  addWidget: (widget: CanvasWidget) => void;
  updateWidget: (id: string, updates: Partial<CanvasWidget>) => void;
  deleteWidget: (id: string) => void;

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
      widgets: widgets.filter((w) => !sectionIds.has(w.sectionId)),
      activeTabId: activeTabId === tabId ? remaining[0]?.id || '' : activeTabId,
      hasUnsavedChanges: true,
    });
  },

  // Sections
  addSection: () => {
    const { sections, activeTabId } = get();
    const tabSections = sections.filter((s) => s.tabId === activeTabId);
    const newSection: CanvasSection = {
      id: `section-${Date.now()}`,
      label: `New Section ${tabSections.length + 1}`,
      tabId: activeTabId,
      columns: 2,
      order: tabSections.length,
      collapsed: false,
      showInRecord: true,
      showInTemplate: true,
    };
    set({ sections: [...sections, newSection], hasUnsavedChanges: true });
  },

  updateSection: (id, updates) => {
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, ...updates } : sec)),
      hasUnsavedChanges: true,
    }));
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
    set((s) => ({
      sections: s.sections.map((sec) => (sec.id === id ? { ...sec, columns: cols } : sec)),
      hasUnsavedChanges: true,
    }));
  },

  toggleSectionCollapsed: (id) => {
    set((s) => ({
      sections: s.sections.map((sec) =>
        sec.id === id ? { ...sec, collapsed: !sec.collapsed } : sec,
      ),
    }));
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

  // Formatting rules
  setFormattingRules: (rules) => set({ formattingRules: rules, hasUnsavedChanges: true }),

  // Load an existing PageLayout into canvas state
  loadLayout: (layout) => {
    const newTabs: CanvasTab[] = layout.tabs.map((tab, idx) => ({
      id: `tab-${idx + 1}`,
      label: tab.label,
      order: tab.order,
    }));

    const newSections: CanvasSection[] = [];
    const newFields: CanvasField[] = [];
    const newWidgets: CanvasWidget[] = [];
    let sectionCounter = 1;
    let fieldCounter = 1;
    let widgetCounter = 1;

    layout.tabs.forEach((tab, tabIdx) => {
      const tabId = `tab-${tabIdx + 1}`;
      tab.sections.forEach((section) => {
        const sectionId = `section-${sectionCounter++}`;
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
              id: `widget-${widgetCounter++}-${w.widgetType}`,
              widgetType: w.widgetType,
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
    });

    const formattingRules =
      layout.formattingRules?.length
        ? layout.formattingRules
        : ((layout.extensions?.formattingRules as FormattingRule[] | undefined) ?? []);

    set({
      editingLayoutId: layout.id,
      layoutName: layout.name || 'Page Layout',
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
        },
      ],
      fields: [],
      widgets: [],
      activeTabId: 'tab-1',
      selectedElement: null,
      layoutName: 'Page Layout',
      editingLayoutId: null,
      formattingRules: [],
      hasUnsavedChanges: false,
      undoStack: [],
    }),

  markSaved: () => set({ hasUnsavedChanges: false }),
  markDirty: () => set({ hasUnsavedChanges: true }),

  // Undo
  pushUndo: () => {
    const { tabs, sections, fields, widgets, undoStack } = get();
    const snapshot: Snapshot = {
      tabs: structuredClone(tabs),
      sections: structuredClone(sections),
      fields: structuredClone(fields),
      widgets: structuredClone(widgets),
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
      undoStack: undoStack.slice(0, -1),
      hasUnsavedChanges: true,
    });
  },
}));
