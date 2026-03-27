'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronRight, PanelLeftClose, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchemaStore } from '@/lib/schema-store';
import {
  generateId,
  type FieldDef,
  type PageField,
  type PageLayout,
  type PageSection,
  type PageTab,
  type PageWidget,
} from '@/lib/schema';
import { getObjectListHref } from '@/lib/object-list-routes';
import { buildPageLayout } from '../build-page-layout';
import { CanvasRegion } from '../canvas-region';
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
  EditorPageLayout,
  LayoutPanel,
  LayoutRegion,
  LayoutTab,
  LayoutWidget,
  PanelField,
  TemplateTabDef,
} from '../types';
import { useEditorSidePanels } from '../use-editor-side-panels';

function toParamValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

function createBlankLayout(objectApi: string): EditorPageLayout {
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

function parseBehavior(value: unknown): PanelField['behavior'] {
  if (value === 'required' || value === 'readOnly' || value === 'hidden') return value;
  return 'none';
}

function parseWidgetConfig(
  widgetType: LayoutWidget['widgetType'],
  value: unknown,
): LayoutWidget['config'] {
  if (value && typeof value === 'object' && 'type' in value) {
    return value as LayoutWidget['config'];
  }

  switch (widgetType) {
    case 'RelatedList':
      return {
        type: 'RelatedList',
        relatedObjectApiName: '',
        relationshipFieldApiName: '',
        displayColumns: [],
      };
    case 'ActivityFeed':
      return { type: 'ActivityFeed', maxItems: 10 };
    case 'FileFolder':
      return { type: 'FileFolder', provider: 'local' };
    case 'CustomComponent':
      return { type: 'CustomComponent', componentId: '' };
    case 'Spacer':
      return { type: 'Spacer', minHeightPx: 32 };
    case 'HeaderHighlights':
      return { type: 'HeaderHighlights', fieldApiNames: [] };
  }
}

function normalizeField(rawField: unknown, fieldIndex: number): PanelField {
  const candidate = (rawField ?? {}) as Record<string, unknown>;
  return {
    fieldApiName:
      typeof candidate.fieldApiName === 'string'
        ? candidate.fieldApiName
        : `field-${fieldIndex + 1}`,
    colSpan: typeof candidate.colSpan === 'number' ? Math.max(1, candidate.colSpan) : 1,
    order: typeof candidate.order === 'number' ? candidate.order : fieldIndex,
    behavior: parseBehavior(candidate.behavior),
    labelOverride:
      typeof candidate.labelOverride === 'string' ? candidate.labelOverride : undefined,
    labelStyle:
      candidate.labelStyle && typeof candidate.labelStyle === 'object'
        ? (candidate.labelStyle as PanelField['labelStyle'])
        : {},
    valueStyle:
      candidate.valueStyle && typeof candidate.valueStyle === 'object'
        ? (candidate.valueStyle as PanelField['valueStyle'])
        : {},
  };
}

function normalizePanel(rawPanel: unknown, panelIndex: number): LayoutPanel {
  const candidate = (rawPanel ?? {}) as Record<string, unknown>;
  const fieldsRaw = Array.isArray(candidate.fields) ? candidate.fields : [];
  const columns =
    typeof candidate.columns === 'number' && candidate.columns >= 1 && candidate.columns <= 4
      ? candidate.columns
      : 2;

  return {
    id: typeof candidate.id === 'string' ? candidate.id : `panel-${Date.now()}-${panelIndex}`,
    label: typeof candidate.label === 'string' ? candidate.label : `Panel ${panelIndex + 1}`,
    order: typeof candidate.order === 'number' ? candidate.order : panelIndex,
    columns: columns as LayoutPanel['columns'],
    style:
      candidate.style && typeof candidate.style === 'object'
        ? (candidate.style as LayoutPanel['style'])
        : {},
    fields: fieldsRaw.map((field, fieldIndex) => normalizeField(field, fieldIndex)),
    ...(typeof candidate.hidden === 'boolean' ? { hidden: candidate.hidden } : {}),
  };
}

function normalizeWidget(rawWidget: unknown, widgetIndex: number): LayoutWidget {
  const candidate = (rawWidget ?? {}) as Record<string, unknown>;
  const widgetType =
    candidate.widgetType === 'RelatedList' ||
    candidate.widgetType === 'ActivityFeed' ||
    candidate.widgetType === 'FileFolder' ||
    candidate.widgetType === 'CustomComponent' ||
    candidate.widgetType === 'Spacer' ||
    candidate.widgetType === 'HeaderHighlights'
      ? candidate.widgetType
      : 'Spacer';

  return {
    id: typeof candidate.id === 'string' ? candidate.id : `widget-${Date.now()}-${widgetIndex}`,
    widgetType,
    order: typeof candidate.order === 'number' ? candidate.order : widgetIndex,
    config: parseWidgetConfig(widgetType, candidate.config),
  };
}

function normalizeRegion(rawRegion: unknown, regionIndex: number): LayoutRegion {
  const candidate = (rawRegion ?? {}) as Record<string, unknown>;
  const panelsRaw = Array.isArray(candidate.panels) ? candidate.panels : [];
  const widgetsRaw = Array.isArray(candidate.widgets) ? candidate.widgets : [];
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `region-${Date.now()}-${regionIndex}`,
    label: typeof candidate.label === 'string' ? candidate.label : `Region ${regionIndex + 1}`,
    gridColumn: typeof candidate.gridColumn === 'number' ? candidate.gridColumn : 1,
    gridColumnSpan:
      typeof candidate.gridColumnSpan === 'number' ? Math.max(1, candidate.gridColumnSpan) : 12,
    gridRow: typeof candidate.gridRow === 'number' ? candidate.gridRow : regionIndex + 1,
    gridRowSpan: typeof candidate.gridRowSpan === 'number' ? candidate.gridRowSpan : 1,
    style:
      candidate.style && typeof candidate.style === 'object'
        ? (candidate.style as LayoutRegion['style'])
        : {},
    panels: panelsRaw.map((panel, panelIndex) => normalizePanel(panel, panelIndex)),
    widgets: widgetsRaw.map((widget, widgetIndex) => normalizeWidget(widget, widgetIndex)),
    ...(typeof candidate.hidden === 'boolean' ? { hidden: candidate.hidden } : {}),
  };
}

function normalizeTab(rawTab: unknown, tabIndex: number): LayoutTab {
  const candidate = (rawTab ?? {}) as Record<string, unknown>;
  const regionsRaw = Array.isArray(candidate.regions) ? candidate.regions : [];
  return {
    id: typeof candidate.id === 'string' ? candidate.id : `tab-${Date.now()}-${tabIndex}`,
    label: typeof candidate.label === 'string' ? candidate.label : `Tab ${tabIndex + 1}`,
    order: typeof candidate.order === 'number' ? candidate.order : tabIndex,
    regions: regionsRaw.map((region, regionIndex) => normalizeRegion(region, regionIndex)),
  };
}

function normalizePanelColumns(value: number | undefined): LayoutPanel['columns'] {
  if (value === 1 || value === 2 || value === 3 || value === 4) return value;
  return 2;
}

function toPageField(panelField: PanelField, fieldIndex: number, columns: number): PageField {
  return {
    apiName: panelField.fieldApiName,
    column: fieldIndex % Math.max(1, columns),
    order: typeof panelField.order === 'number' ? panelField.order : fieldIndex,
    ...(panelField.colSpan > 1 ? { colSpan: panelField.colSpan } : {}),
  };
}

function toPageWidget(widget: LayoutWidget, region: LayoutRegion, widgetIndex: number): PageWidget {
  return {
    id: widget.id,
    widgetType: widget.widgetType,
    column: 0,
    order: typeof widget.order === 'number' ? widget.order : widgetIndex,
    config: widget.config,
    gridColumn: region.gridColumn,
    gridColumnSpan: region.gridColumnSpan,
    gridRow: region.gridRow,
    gridRowSpan: region.gridRowSpan,
  };
}

function toPersistedLayout(editorLayout: EditorPageLayout): PageLayout {
  const highlightSet = new Set<string>();
  const tabs: PageTab[] = [...editorLayout.tabs]
    .sort((a, b) => a.order - b.order)
    .map((tab, tabIndex) => {
      const sections: PageSection[] = [];
      let nextSectionOrder = 0;
      const regions = [...tab.regions].sort((a, b) => {
        if (a.gridRow !== b.gridRow) return a.gridRow - b.gridRow;
        if (a.gridColumn !== b.gridColumn) return a.gridColumn - b.gridColumn;
        return 0;
      });

      regions.forEach((region, regionIndex) => {
        const regionWidgets = [...region.widgets]
          .sort((a, b) => a.order - b.order)
          .map((widget, widgetIndex) => {
            if (
              widget.widgetType === 'HeaderHighlights' &&
              widget.config.type === 'HeaderHighlights'
            ) {
              widget.config.fieldApiNames.forEach((fieldApiName) => highlightSet.add(fieldApiName));
            }
            return toPageWidget(widget, region, widgetIndex);
          });
        const panels = [...region.panels].sort((a, b) => a.order - b.order);

        if (panels.length === 0) {
          sections.push({
            id: `section-${region.id}`,
            label: region.label || `Region ${regionIndex + 1}`,
            columns: 1,
            order: nextSectionOrder++,
            fields: [],
            ...(regionWidgets.length > 0 ? { widgets: regionWidgets } : {}),
            gridColumn: region.gridColumn,
            gridColumnSpan: region.gridColumnSpan,
            gridRow: region.gridRow,
            gridRowSpan: region.gridRowSpan,
          });
          return;
        }

        panels.forEach((panel, panelIndex) => {
          const fields = [...panel.fields]
            .sort((a, b) => a.order - b.order)
            .map((field, fieldIndex) => toPageField(field, fieldIndex, panel.columns));
          sections.push({
            id: `section-${region.id}-${panel.id}`,
            label: panel.label || region.label || `Section ${panelIndex + 1}`,
            columns: normalizePanelColumns(panel.columns),
            order: nextSectionOrder++,
            fields,
            ...(panelIndex === 0 && regionWidgets.length > 0 ? { widgets: regionWidgets } : {}),
            gridColumn: region.gridColumn,
            gridColumnSpan: region.gridColumnSpan,
            gridRow: region.gridRow + panelIndex,
            gridRowSpan: panelIndex === 0 ? region.gridRowSpan : 1,
          });
        });
      });

      return {
        id: tab.id,
        label: tab.label || `Tab ${tabIndex + 1}`,
        order: typeof tab.order === 'number' ? tab.order : tabIndex,
        sections,
      };
    });

  const formattingRules = [...editorLayout.formattingRules];
  const highlightFields = [...highlightSet];
  return {
    id: editorLayout.id,
    name: editorLayout.name,
    objectApi: editorLayout.objectApi,
    active: editorLayout.active,
    isDefault: editorLayout.isDefault,
    roles: [...editorLayout.roles],
    tabs,
    ...(highlightFields.length > 0 ? { highlightFields } : {}),
    formattingRules,
    extensions: {
      editorTabs: editorLayout.tabs,
      formattingRules,
      version: 1,
    },
  };
}

function toLayoutWidget(pageWidget: PageWidget, widgetIndex: number): LayoutWidget {
  return {
    id: pageWidget.id || `widget-${Date.now()}-${widgetIndex}`,
    widgetType: pageWidget.widgetType,
    order: typeof pageWidget.order === 'number' ? pageWidget.order : widgetIndex,
    config: parseWidgetConfig(pageWidget.widgetType, pageWidget.config),
  };
}

function toPanelField(pageField: PageField, fieldIndex: number): PanelField {
  const required = typeof pageField.required === 'boolean' ? pageField.required : false;
  const readOnly = typeof pageField.readOnly === 'boolean' ? pageField.readOnly : false;
  const behavior: PanelField['behavior'] = readOnly
    ? 'readOnly'
    : required
      ? 'required'
      : 'none';

  return {
    fieldApiName: pageField.apiName,
    colSpan: typeof pageField.colSpan === 'number' ? Math.max(1, pageField.colSpan) : 1,
    order: typeof pageField.order === 'number' ? pageField.order : fieldIndex,
    behavior,
    labelStyle: {},
    valueStyle: {},
  };
}

function toLayoutRegionFromSection(section: PageSection, sectionIndex: number): LayoutRegion {
  const sectionWidgets = Array.isArray(section.widgets) ? section.widgets : [];
  const sectionFields = Array.isArray(section.fields) ? section.fields : [];
  const fields = [...sectionFields]
    .sort((a, b) => a.order - b.order)
    .map((field, fieldIndex) => toPanelField(field, fieldIndex));

  return {
    id: `region-${section.id || sectionIndex + 1}`,
    label: section.label || `Region ${sectionIndex + 1}`,
    gridColumn: typeof section.gridColumn === 'number' ? section.gridColumn : 1,
    gridColumnSpan:
      typeof section.gridColumnSpan === 'number' ? Math.max(1, section.gridColumnSpan) : 12,
    gridRow: typeof section.gridRow === 'number' ? section.gridRow : sectionIndex + 1,
    gridRowSpan: typeof section.gridRowSpan === 'number' ? Math.max(1, section.gridRowSpan) : 1,
    style: {},
    panels: [
      {
        id: `panel-${section.id || sectionIndex + 1}`,
        label: section.label || `Panel ${sectionIndex + 1}`,
        order: 0,
        columns: normalizePanelColumns(section.columns),
        style: {},
        fields,
      },
    ],
    widgets: sectionWidgets.map((widget, widgetIndex) => toLayoutWidget(widget, widgetIndex)),
  };
}

function toLayoutRegionsFromLegacyTab(tab: PageTab): LayoutRegion[] {
  const sections = Array.isArray(tab.sections) ? tab.sections : [];
  const regions = [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, sectionIndex) => toLayoutRegionFromSection(section, sectionIndex));
  const tabWidgets = Array.isArray(tab.widgets) ? tab.widgets : [];

  tabWidgets.forEach((widget, widgetIndex) => {
    regions.push({
      id: `region-widget-${widget.id || widgetIndex + 1}`,
      label: `Widget ${widgetIndex + 1}`,
      gridColumn: typeof widget.gridColumn === 'number' ? widget.gridColumn : 1,
      gridColumnSpan: typeof widget.gridColumnSpan === 'number' ? Math.max(1, widget.gridColumnSpan) : 12,
      gridRow: typeof widget.gridRow === 'number' ? widget.gridRow : regions.length + 1,
      gridRowSpan: typeof widget.gridRowSpan === 'number' ? Math.max(1, widget.gridRowSpan) : 1,
      style: {},
      panels: [],
      widgets: [toLayoutWidget(widget, widgetIndex)],
    });
  });

  return regions;
}

function toEditorLayout(pageLayout: PageLayout, objectApi: string): EditorPageLayout {
  const extensions =
    pageLayout.extensions && typeof pageLayout.extensions === 'object'
      ? (pageLayout.extensions as Record<string, unknown>)
      : null;
  const extensionTabs = extensions && Array.isArray(extensions.editorTabs) ? extensions.editorTabs : [];
  const tabsSource =
    extensionTabs.length > 0
      ? extensionTabs
      : pageLayout.tabs.map((tab, tabIndex) => ({
          id: tab.id,
          label: tab.label,
          order: typeof tab.order === 'number' ? tab.order : tabIndex,
          regions: toLayoutRegionsFromLegacyTab(tab),
        }));
  const tabs = tabsSource.map((tab, index) => normalizeTab(tab, index));
  const topLevelFormattingRules = Array.isArray(pageLayout.formattingRules)
    ? pageLayout.formattingRules
    : [];
  const extensionFormattingRules =
    extensions && Array.isArray(extensions.formattingRules)
      ? (extensions.formattingRules as EditorPageLayout['formattingRules'])
      : [];
  const formattingRules =
    topLevelFormattingRules.length > 0 ? topLevelFormattingRules : extensionFormattingRules;

  return {
    id: pageLayout.id || '',
    name: pageLayout.name || 'Layout',
    objectApi:
      typeof pageLayout.objectApi === 'string' && pageLayout.objectApi.length > 0
        ? pageLayout.objectApi
        : objectApi,
    active: Boolean(pageLayout.active),
    isDefault: Boolean(pageLayout.isDefault),
    roles: Array.isArray(pageLayout.roles)
      ? pageLayout.roles.filter((role): role is string => typeof role === 'string')
      : [],
    tabs: tabs.length > 0 ? tabs : createBlankLayout(objectApi).tabs,
    formattingRules,
  };
}

function createDefaultRegion(regionCount: number): LayoutRegion {
  return {
    id: `region-${Date.now()}`,
    label: `Region ${regionCount + 1}`,
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
      label: region.label || `Region ${regionIndex + 1}`,
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

  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  const layout = useEditorStore((s) => s.layout);
  const activeTabId = useEditorStore((s) => s.activeTabId);
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const isDirty = useEditorStore((s) => s.isDirty);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const addRegion = useEditorStore((s) => s.addRegion);
  const loadLayout = useEditorStore((s) => s.loadLayout);
  const setFormattingRules = useEditorStore((s) => s.setFormattingRules);

  const [showFormattingRulesDialog, setShowFormattingRulesDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [rulesTargetFilter, setRulesTargetFilter] = useState<
    { type: 'field' | 'panel' | 'region'; id: string; panelId?: string } | undefined
  >(undefined);
  const [rulesInitialRuleId, setRulesInitialRuleId] = useState<string | undefined>(undefined);
  const [showTemplateGallery, setShowTemplateGallery] = useState(layoutId === 'new');
  const [paletteTab, setPaletteTab] = useState<'fields' | 'components'>('fields');
  const [isSaving, setIsSaving] = useState(false);
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
      loadLayout(toEditorLayout(existingLayout, objectApiName));
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
      alert('Please enter a layout name.');
      return false;
    }

    setIsSaving(true);

    const builtLayout = buildPageLayout(layout);
    const savedEditorLayout: EditorPageLayout = {
      ...builtLayout,
      id: builtLayout.id || (layoutId === 'new' ? generateId() : layoutId),
      objectApi: objectApiName,
    };
    const savedLayout = toPersistedLayout(savedEditorLayout);

    try {
      const existingLayouts = object.pageLayouts ?? [];
      const updatedLayouts = existingLayouts.some((item) => item.id === savedLayout.id)
        ? existingLayouts.map((item) => (item.id === savedLayout.id ? savedLayout : item))
        : [...existingLayouts, savedLayout];

      await updateObject(objectApiName, {
        pageLayouts: updatedLayouts,
      });

      loadLayout(toEditorLayout(savedLayout, objectApiName));

      if (layoutId === 'new') {
        router.replace(
          `/object-manager/${encodeURIComponent(objectApiName)}/page-editor/${encodeURIComponent(savedLayout.id)}`,
        );
      }
      return true;
    } catch (err) {
      console.error('Failed to save layout:', err);
      alert('Failed to save layout. Please try again.');
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
        const confirmed = window.confirm(
          'You have unsaved changes. Leave this page without saving?',
        );
        if (!confirmed) return;
      }
      router.push(href);
    },
    [router],
  );

  const handleAddRegion = useCallback(() => {
    if (!activeTab) return;
    const region = createDefaultRegion(activeTab.regions.length);
    addRegion(region, activeTab.id);
    setSelectedElement({ type: 'region', id: region.id });
  }, [activeTab, addRegion, setSelectedElement]);

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
        tabs: convertedTabs.length > 0 ? convertedTabs : createBlankLayout(state.layout.objectApi).tabs,
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
                    onClick={handleAddRegion}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Region
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600">
                  No tabs are available for this layout.
                </div>
              )}
            </div>
          </main>
        </div>
      </DndContextWrapper>

      <FloatingProperties
        open={selectedElement !== null}
        onClose={() => setSelectedElement(null)}
        availableFields={allFields}
      />

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
        rules={layout.formattingRules}
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

      {isSaving ? (
        <div className="pointer-events-none fixed bottom-4 right-4 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg">
          Saving...
        </div>
      ) : null}
    </div>
  );
}
