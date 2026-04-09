'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  generateId,
  type FieldDef,
  type ObjectDef,
  type PageLayout,
} from '@/lib/schema';
import { isLegacyLayout, migrateLegacyLayout } from '@/lib/layout-migration';
import { getObjectListHref } from '@/lib/object-list-routes';
import { useToast } from '@/components/toast';
import { useSchemaStore } from '@/lib/schema-store';
import { buildPageLayout } from '../build-page-layout';
import { useEditorStore } from '../editor-store';
import type {
  LayoutSection,
  LayoutTab,
  TemplateTabDef,
} from '../types';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function toParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function createBlankLayout(objectApi: string): PageLayout {
  return {
    id: '',
    name: 'New Layout',
    objectApi,
    active: false,
    isDefault: false,
    roles: [],
    tabs: [
      {
        id: `tab-${Date.now()}`,
        label: 'Details',
        order: 0,
        regions: [],
      },
    ],
    formattingRules: [],
  };
}

function createDefaultRegion(regions: LayoutSection[]): LayoutSection {
  const maxRow = regions.reduce((max, r) => Math.max(max, r.gridRow + r.gridRowSpan - 1), 0);
  return {
    id: `region-${Date.now()}`,
    label: `Section ${regions.length + 1}`,
    gridColumn: 1,
    gridColumnSpan: 12,
    gridRow: maxRow + 1,
    gridRowSpan: 1,
    style: {},
    panels: [],
    widgets: [],
  };
}

function convertTemplateTabsToLayoutTabs(templateTabs: TemplateTabDef[]): LayoutTab[] {
  const sourceTabs = templateTabs.length > 0 ? templateTabs : [{ id: 'tab-1', label: 'Details', order: 0, regions: [] }];
  return sourceTabs.map((tab, tabIndex) => ({
    id: `tab-${Date.now()}-${tabIndex}-${Math.random().toString(36).slice(2, 6)}`,
    label: tab.label || `Tab ${tabIndex + 1}`,
    order: tabIndex,
    regions: (tab.regions ?? []).map((region, regionIndex) => ({
      id: `region-${Date.now()}-${tabIndex}-${regionIndex}-${Math.random().toString(36).slice(2, 6)}`,
      label: region.label || `Section ${regionIndex + 1}`,
      gridColumn: typeof region.gridColumn === 'number' ? region.gridColumn : 1,
      gridColumnSpan: typeof region.gridColumnSpan === 'number' ? region.gridColumnSpan : 12,
      gridRow: typeof region.gridRow === 'number' ? region.gridRow : regionIndex + 1,
      gridRowSpan: typeof region.gridRowSpan === 'number' ? region.gridRowSpan : 1,
      style: region.style ?? {},
      panels: (region.panels ?? []).map((panel, panelIndex) => ({
        id: `panel-${Date.now()}-${tabIndex}-${regionIndex}-${panelIndex}-${Math.random().toString(36).slice(2, 6)}`,
        label: panel.label || `Panel ${panelIndex + 1}`,
        order: panelIndex,
        columns: panel.columns ?? 2,
        style: panel.style ?? {},
        fields: [],
      })),
      widgets: [],
    })),
  }));
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export interface EditorLifecycle {
  /* Schema-derived data */
  object: ObjectDef | undefined;
  allFields: FieldDef[];
  objectApiName: string;
  layoutId: string;
  routeKey: string;

  /* Layout-derived data */
  sortedTabs: LayoutTab[];
  activeTab: LayoutTab | null;
  activeRegions: LayoutSection[];
  layoutAssignmentNote: string | null;

  /* Actions */
  handleSave: () => void;
  performSave: () => Promise<boolean>;
  requestNavigate: (href: string) => void;
  handleAddSection: () => void;
  handleTemplateSelect: (tabs: TemplateTabDef[]) => void;

  /* Navigation hrefs */
  backHref: string;
  backLabel: string;
  objectManagerHref: string;
  objectListHref: string | null;
  objectListLabel: string;

  /* Dialog / UI state */
  pendingNavHref: string | null;
  setPendingNavHref: (href: string | null) => void;
  showFormattingRulesDialog: boolean;
  setShowFormattingRulesDialog: (v: boolean) => void;
  showPreview: boolean;
  setShowPreview: (v: boolean) => void;
  rulesTargetFilter: { type: 'field' | 'panel' | 'region'; id: string; panelId?: string } | undefined;
  setRulesTargetFilter: (v: { type: 'field' | 'panel' | 'region'; id: string; panelId?: string } | undefined) => void;
  rulesInitialRuleId: string | undefined;
  setRulesInitialRuleId: (v: string | undefined) => void;
  showTemplateGallery: boolean;
  setShowTemplateGallery: (v: boolean) => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

export function useEditorLifecycle(): EditorLifecycle {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const objectApiName = toParamValue(params.objectApi);
  const layoutId = toParamValue(params.layoutId);
  const routeKey = `${objectApiName}::${layoutId}`;
  const { showToast } = useToast();

  const returnTo = searchParams.get('returnTo');

  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  /* Editor store selectors */
  const layout = useEditorStore((s) => s.layout);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const isDirty = useEditorStore((s) => s.isDirty);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const addSection = useEditorStore((s) => s.addSection);
  const loadLayout = useEditorStore((s) => s.loadLayout);
  const setFormattingRules = useEditorStore((s) => s.setFormattingRules);

  /* ---- Local UI state ---- */
  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const [showFormattingRulesDialog, setShowFormattingRulesDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rulesTargetFilter, setRulesTargetFilter] = useState<
    { type: 'field' | 'panel' | 'region'; id: string; panelId?: string } | undefined
  >(undefined);
  const [rulesInitialRuleId, setRulesInitialRuleId] = useState<string | undefined>(undefined);
  const [showTemplateGallery, setShowTemplateGallery] = useState(layoutId === 'new');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const didLoadLayoutRef = useRef<string | null>(null);
  /** Captures `object.updatedAt` at load time for concurrent-edit detection. */
  const loadedUpdatedAtRef = useRef<string | null>(null);

  /* ---- Load layout from schema store ---- */
  useEffect(() => {
    didLoadLayoutRef.current = null;
    loadedUpdatedAtRef.current = null;
    setShowTemplateGallery(layoutId === 'new');
  }, [layoutId, routeKey]);

  useEffect(() => {
    if (!object) return;
    if (didLoadLayoutRef.current === routeKey) return;
    didLoadLayoutRef.current = routeKey;

    // Capture the object's updatedAt so we can detect concurrent edits on save.
    loadedUpdatedAtRef.current = object.updatedAt ?? null;

    if (layoutId === 'new') {
      loadLayout(createBlankLayout(objectApiName));
      return;
    }

    const existingLayout = object.pageLayouts?.find((item) => item.id === layoutId);
    if (existingLayout) {
      if (isLegacyLayout(existingLayout)) {
        loadLayout(migrateLegacyLayout(existingLayout as any));
      } else {
        loadLayout(existingLayout);
      }
      return;
    }

    loadLayout(createBlankLayout(objectApiName));
  }, [layoutId, loadLayout, object, objectApiName, routeKey]);

  /* ---- Beforeunload guard ---- */
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  /* ---- Formatting-rules custom event ---- */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail ?? {};
      setRulesTargetFilter(detail.targetFilter ?? undefined);
      setRulesInitialRuleId(detail.ruleId ?? undefined);
      setShowFormattingRulesDialog(true);
    };
    window.addEventListener('open-formatting-rules', handler);
    return () => window.removeEventListener('open-formatting-rules', handler);
  }, []);

  /* ---- Derived data ---- */
  const allFields = useMemo<FieldDef[]>(() => object?.fields ?? [], [object]);
  const sortedTabs = useMemo(
    () => [...layout.tabs].sort((a, b) => a.order - b.order),
    [layout.tabs],
  );
  const activeTab = useMemo(
    () => sortedTabs.find((tab) => tab.id === activeTabId) ?? sortedTabs[0] ?? null,
    [sortedTabs, activeTabId],
  );
  const activeRegions = useMemo(
    () =>
      [...(activeTab?.regions ?? [])].sort((a, b) => {
        if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow;
        if (a.gridColumn !== b.gridColumn) return a.gridColumn - b.gridColumn;
        return 0;
      }),
    [activeTab],
  );

  /* Sync active tab id when the computed activeTab diverges from store */
  useEffect(() => {
    if (!activeTab) return;
    if (activeTabId !== activeTab.id) {
      setActiveTab(activeTab.id);
    }
  }, [activeTab, activeTabId, setActiveTab]);

  const layoutAssignmentNote = useMemo(() => {
    if (!object?.recordTypes?.length) return null;
    if (layoutId === 'new') {
      return 'After you save, go back to Page Layouts and use "Assign to record type" so records use this layout.';
    }
    const assigned = object.recordTypes.filter((rt) => rt.pageLayoutId === layoutId);
    if (assigned.length === 0) {
      return 'Not linked to a record type yet \u2014 assign it from the Page Layouts list so it applies to records.';
    }
    const names = assigned.map((r) => r.name).join(', ');
    const def = object.defaultRecordTypeId;
    const hasDefault = !!(def && assigned.some((r) => r.id === def));
    return `Used for: ${names}.${hasDefault ? ' Includes your default record type.' : ''}`;
  }, [object, layoutId]);

  /* ---- Save ---- */
  const performSave = useCallback(async (): Promise<boolean> => {
    if (!object) return false;
    if (!layout.name.trim()) {
      showToast('Please enter a layout name.', 'error');
      return false;
    }

    // Concurrent-edit detection: compare the object's current updatedAt with the
    // value captured at load time. If another user (or tab) saved in the meantime,
    // the timestamps will differ.
    const freshObject = useSchemaStore.getState().schema?.objects.find(
      (o) => o.apiName === objectApiName,
    );
    if (
      loadedUpdatedAtRef.current &&
      freshObject?.updatedAt &&
      freshObject.updatedAt !== loadedUpdatedAtRef.current
    ) {
      showToast(
        'This layout was modified by another user. Please reload to see their changes.',
        'error',
      );
      return false;
    }

    setIsSaving(true);

    const builtLayout = buildPageLayout(layout);
    const savedLayout: PageLayout = {
      ...builtLayout,
      id: builtLayout.id || (layoutId === 'new' ? generateId() : layoutId),
      objectApi: objectApiName,
    };

    try {
      const existingLayouts = object.pageLayouts ?? [];
      const updatedLayouts = existingLayouts.some((item) => item.id === savedLayout.id)
        ? existingLayouts.map((item) => (item.id === savedLayout.id ? savedLayout : item))
        : [...existingLayouts, savedLayout];

      await updateObject(objectApiName, {
        pageLayouts: updatedLayouts,
      });

      // After a successful save, refresh the baseline timestamp so the next
      // save doesn't mistakenly detect our own write as a concurrent edit.
      const savedObject = useSchemaStore.getState().schema?.objects.find(
        (o) => o.apiName === objectApiName,
      );
      if (savedObject?.updatedAt) {
        loadedUpdatedAtRef.current = savedObject.updatedAt;
      }

      loadLayout(savedLayout);

      if (layoutId === 'new') {
        router.replace(
          `/object-manager/${encodeURIComponent(objectApiName)}/page-editor/${encodeURIComponent(savedLayout.id)}`,
        );
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      return true;
    } catch (err) {
      console.error('Failed to save layout:', err);
      showToast('Failed to save layout. Please try again.', 'error');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [layout, layoutId, loadLayout, object, objectApiName, router, updateObject, showToast]);

  const handleSave = useCallback(() => {
    void performSave();
  }, [performSave]);

  /* ---- Navigation ---- */
  const requestNavigate = useCallback(
    (href: string) => {
      if (useEditorStore.getState().isDirty) {
        setPendingNavHref(href);
        return;
      }
      router.push(href);
    },
    [router],
  );

  /* ---- Add section ---- */
  const handleAddSection = useCallback(() => {
    if (!activeTab) return;
    const region = createDefaultRegion(activeTab.regions);
    addSection(region, activeTab.id);
    setSelectedElement({ type: 'region', id: region.id });
  }, [activeTab, addSection, setSelectedElement]);

  /* ---- Template select ---- */
  const handleTemplateSelect = useCallback((tabs: TemplateTabDef[]) => {
    const convertedTabs = convertTemplateTabsToLayoutTabs(tabs);
    useEditorStore.setState((state) => ({
      layout: {
        ...state.layout,
        tabs: convertedTabs.length > 0 ? convertedTabs : createBlankLayout(state.layout.objectApi ?? '').tabs,
      },
      activeTabId: convertedTabs[0]?.id ?? state.activeTabId,
      selectedElement: null,
      isDirty: true,
      undoStack: [],
      redoStack: [],
    }));
    setShowTemplateGallery(false);
  }, []);

  /* ---- Derived hrefs / labels ---- */
  const objectManagerHref = `/object-manager/${encodeURIComponent(objectApiName)}?section=page-editor`;
  const objectListHref = getObjectListHref(objectApiName);
  const objectListLabel = object?.pluralLabel || object?.label || objectApiName;

  const backHref = returnTo || objectManagerHref;
  const backLabel = returnTo ? 'Back' : 'Layouts';

  return {
    object,
    allFields,
    objectApiName,
    layoutId,
    routeKey,

    sortedTabs,
    activeTab,
    activeRegions,
    layoutAssignmentNote,

    handleSave,
    performSave,
    requestNavigate,
    handleAddSection,
    handleTemplateSelect,

    backHref,
    backLabel,
    objectManagerHref,
    objectListHref,
    objectListLabel,

    pendingNavHref,
    setPendingNavHref,
    showFormattingRulesDialog,
    setShowFormattingRulesDialog,
    showPreview,
    setShowPreview,
    rulesTargetFilter,
    setRulesTargetFilter,
    rulesInitialRuleId,
    setRulesInitialRuleId,
    showTemplateGallery,
    setShowTemplateGallery,
    isSaving,
    saveSuccess,
  };
}
