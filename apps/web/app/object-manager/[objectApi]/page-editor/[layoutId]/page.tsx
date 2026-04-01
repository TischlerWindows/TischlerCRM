'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, PanelLeftClose, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/lib/schema-store';
import {
  generateId,
  type FieldDef,
  type PageLayout,
} from '@/lib/schema';
import { isLegacyLayout, migrateLegacyLayout } from '@/lib/layout-migration';
import { getObjectListHref } from '@/lib/object-list-routes';
import { useToast } from '@/components/toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { buildPageLayout } from '../build-page-layout';
import { CanvasRegion } from '../canvas-section';
import { DndContextWrapper } from '../dnd-context-wrapper';
import { EditorToolbar } from '../editor-toolbar';
import { FloatingProperties } from '../floating-properties';
import { FormattingRulesDialog } from '../formatting-rules-dialog';
import { LayoutPreviewDialog } from '../layout-preview-dialog';
import { PaletteComponents } from '../palette-components';
import { PaletteFields } from '../palette-fields';
import { TemplateGallery } from '../template-gallery';
import { useEditorStore } from '../editor-store';
import type {
  LayoutSection,
  LayoutTab,
  TemplateTabDef,
} from '../types';
import { useEditorSidePanels } from '../use-editor-side-panels';

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

function createDefaultRegion(regionCount: number): LayoutSection {
  return {
    id: `region-${Date.now()}`,
    label: `Section ${regionCount + 1}`,
    gridColumn: 1,
    gridColumnSpan: 12,
    gridRow: regionCount + 1,
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

export default function PageEditorFullPage() {
  const params = useParams();
  const router = useRouter();
  const objectApiName = toParamValue(params.objectApi);
  const layoutId = toParamValue(params.layoutId);
  const routeKey = `${objectApiName}::${layoutId}`;
  const { showToast } = useToast();

  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  const layout = useEditorStore((s) => s.layout);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const isDirty = useEditorStore((s) => s.isDirty);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const addSection = useEditorStore((s) => s.addSection);
  const loadLayout = useEditorStore((s) => s.loadLayout);
  const setFormattingRules = useEditorStore((s) => s.setFormattingRules);

  const [pendingNavHref, setPendingNavHref] = useState<string | null>(null);
  const [showFormattingRulesDialog, setShowFormattingRulesDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rulesTargetFilter, setRulesTargetFilter] = useState<
    { type: 'field' | 'panel' | 'region'; id: string; panelId?: string } | undefined
  >(undefined);
  const [rulesInitialRuleId, setRulesInitialRuleId] = useState<string | undefined>(undefined);
  const [showTemplateGallery, setShowTemplateGallery] = useState(layoutId === 'new');
  const [paletteTab, setPaletteTab] = useState<'fields' | 'components'>('fields');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const leftPanelContainerId = `page-editor-left-panel-${encodeURIComponent(routeKey || 'new')}`;

  const sidePanels = useEditorSidePanels();
  const didLoadLayoutRef = useRef<string | null>(null);

  useEffect(() => {
    didLoadLayoutRef.current = null;
    setShowTemplateGallery(layoutId === 'new');
  }, [layoutId, routeKey]);

  useEffect(() => {
    if (!object) return;
    if (didLoadLayoutRef.current === routeKey) return;
    didLoadLayoutRef.current = routeKey;

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

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

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

  useEffect(() => {
    if (!activeTab) return;
    if (activeTabId !== activeTab.id) {
      setActiveTab(activeTab.id);
    }
  }, [activeTab, activeTabId, setActiveTab]);

  const layoutAssignmentNote = useMemo(() => {
    if (!object?.recordTypes?.length) return null;
    if (layoutId === 'new') {
      return 'After you save, go back to Page Layouts and use “Assign to record type” so records use this layout.';
    }
    const assigned = object.recordTypes.filter((rt) => rt.pageLayoutId === layoutId);
    if (assigned.length === 0) {
      return 'Not linked to a record type yet — assign it from the Page Layouts list so it applies to records.';
    }
    const names = assigned.map((r) => r.name).join(', ');
    const def = object.defaultRecordTypeId;
    const hasDefault = !!(def && assigned.some((r) => r.id === def));
    return `Used for: ${names}.${hasDefault ? ' Includes your default record type.' : ''}`;
  }, [object, layoutId]);

  const performSave = useCallback(async (): Promise<boolean> => {
    if (!object) return false;
    if (!layout.name.trim()) {
      showToast('Please enter a layout name.', 'error');
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
  }, [layout, layoutId, loadLayout, object, objectApiName, router, updateObject]);

  const handleSave = useCallback(() => {
    void performSave();
  }, [performSave]);

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

  const handleAddSection = useCallback(() => {
    if (!activeTab) return;
    const region = createDefaultRegion(activeTab.regions.length);
    addSection(region, activeTab.id);
    setSelectedElement({ type: 'region', id: region.id });
  }, [activeTab, addSection, setSelectedElement]);

  const handleLeftResizeKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        sidePanels.adjustLeftWidth(-16);
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        sidePanels.adjustLeftWidth(16);
      }
    },
    [sidePanels],
  );

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

  if (!object) {
    return <div className="p-6">Object not found</div>;
  }

  const objectManagerHref = `/object-manager/${encodeURIComponent(objectApiName)}?section=page-editor`;
  const objectListHref = getObjectListHref(objectApiName);
  const objectListLabel = object.pluralLabel || object.label;

  return (
    <div className="flex h-screen flex-col">
      <EditorToolbar
        onSave={handleSave}
        onPreview={() => setShowPreview(true)}
        onOpenRules={() => setShowFormattingRulesDialog(true)}
        onRequestNavigate={requestNavigate}
        objectManagerHref={objectManagerHref}
        objectListHref={objectListHref}
        objectListLabel={objectListLabel}
        layoutAssignmentNote={layoutAssignmentNote}
      />

      <DndContextWrapper>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div
            id={leftPanelContainerId}
            className="relative flex shrink-0 flex-col border-r border-gray-200 bg-white transition-[width] duration-150"
            style={{
              width: sidePanels.leftCollapsed ? 40 : sidePanels.leftWidth,
              minWidth: sidePanels.leftCollapsed ? 40 : undefined,
            }}
          >
            <button
              type="button"
              title={sidePanels.leftCollapsed ? 'Show fields panel' : 'Hide fields panel'}
              onClick={() => sidePanels.toggleLeftCollapsed()}
              aria-label={sidePanels.leftCollapsed ? 'Expand fields panel' : 'Collapse fields panel'}
              aria-expanded={!sidePanels.leftCollapsed}
              aria-controls={leftPanelContainerId}
              className="absolute right-0 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-l-md border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-gray-50"
            >
              {sidePanels.leftCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            {!sidePanels.leftCollapsed && (
              <div className="flex h-full min-h-0 flex-col">
                <div className="grid grid-cols-2 border-b border-gray-200 bg-white p-2">
                  <button
                    type="button"
                    onClick={() => setPaletteTab('fields')}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      paletteTab === 'fields'
                        ? 'bg-brand-navy text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Fields
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaletteTab('components')}
                    className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                      paletteTab === 'components'
                        ? 'bg-brand-navy text-white'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Components
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-hidden">
                  {paletteTab === 'fields' ? (
                    <PaletteFields availableFields={allFields} />
                  ) : (
                    <PaletteComponents />
                  )}
                </div>
              </div>
            )}
          </div>
          {!sidePanels.leftCollapsed && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize fields panel"
              aria-valuemin={200}
              aria-valuemax={520}
              aria-valuenow={Math.round(sidePanels.leftWidth)}
              tabIndex={0}
              onMouseDown={sidePanels.startResizeLeft}
              onKeyDown={handleLeftResizeKeyDown}
              className="w-1.5 shrink-0 cursor-col-resize border-r border-transparent bg-gray-200/80 hover:bg-brand-navy/20"
            />
          )}

          <main className="min-w-0 flex-1 overflow-y-auto bg-gray-100 p-6" data-editor-canvas>
            <div className={showTemplateGallery && layoutId === 'new' ? 'pointer-events-none opacity-40' : ''}>
              {activeTab ? (
                <>
                  <div className="grid grid-cols-12 gap-4">
                    {activeRegions.map((region) => (
                      <CanvasRegion key={region.id} region={region} tabId={activeTab.id} />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-4 w-full border-dashed border-gray-300 hover:border-brand-navy hover:text-brand-navy"
                    onClick={handleAddSection}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Section
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                  No tabs are available for this layout.
                </div>
              )}
            </div>
          </main>
          {/* Right properties sidebar — always visible, 320px wide */}
          <div className="flex w-80 shrink-0 flex-col overflow-hidden border-l border-gray-200 bg-white">
            <FloatingProperties
              onClose={() => setSelectedElement(null)}
              availableFields={allFields}
            />
          </div>
        </div>
      </DndContextWrapper>

      <LayoutPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        pageLayout={layout as unknown as import('@/lib/schema').PageLayout}
        allFields={allFields}
        objectLabel={object.label}
      />

      <FormattingRulesDialog
        open={showFormattingRulesDialog}
        onOpenChange={(isOpen) => {
          setShowFormattingRulesDialog(isOpen);
          if (!isOpen) {
            setRulesTargetFilter(undefined);
            setRulesInitialRuleId(undefined);
          }
        }}
        rules={layout.formattingRules ?? []}
        onApply={(next) => setFormattingRules(next)}
        objectFields={object.fields}
        targetFilter={rulesTargetFilter}
        initialRuleId={rulesInitialRuleId}
      />

      <TemplateGallery
        open={showTemplateGallery && layoutId === 'new'}
        onClose={() => setShowTemplateGallery(false)}
        onSelect={(tabs) => handleTemplateSelect(tabs)}
        savedTemplates={(schema?.customLayoutTemplates ?? []).filter(
          (template) => template.objectApi === objectApiName,
        )}
      />

      <ConfirmDialog
        open={pendingNavHref !== null}
        onOpenChange={(open) => { if (!open) setPendingNavHref(null); }}
        title="You have unsaved changes"
        description="Leave this page without saving? Your changes will be lost."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="destructive"
        onConfirm={() => {
          const href = pendingNavHref;
          setPendingNavHref(null);
          if (href) router.push(href);
        }}
      />

      {(isSaving || saveSuccess) && (
        <div className={`pointer-events-none fixed bottom-4 right-4 rounded-md px-3 py-2 text-xs text-white shadow-lg transition-colors ${
          saveSuccess ? 'bg-emerald-600' : 'bg-gray-900'
        }`}>
          {saveSuccess ? 'Saved ✓' : 'Saving...'}
        </div>
      )}
    </div>
  );
}
