'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Active,
  type DragEndEvent,
  type DragStartEvent,
  type Over,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { WidgetType } from '@/lib/schema';
import type { LayoutPanel, LayoutRegion, LayoutWidget, PanelField } from './types';
import { useEditorStore } from './editor-store';

type DragSource =
  | { kind: 'palette-field'; fieldApiName: string; label: string }
  | { kind: 'existing-field'; fieldApiName: string; fromPanelId: string; label: string }
  | { kind: 'palette-widget'; widgetType: WidgetType; label: string }
  | { kind: 'existing-widget'; widgetId: string; label: string }
  | { kind: 'panel'; panelId: string; regionId?: string; label: string }
  | { kind: 'region'; regionId: string; label: string }
  | null;

type DropTarget =
  | { kind: 'panel-drop'; panelId: string }
  | { kind: 'region-drop'; regionId: string }
  | { kind: 'field-item'; panelId: string; index: number }
  | { kind: 'widget-item'; regionId: string; index: number }
  | { kind: 'panel-item'; panelId: string; regionId: string; index: number }
  | { kind: 'region-item'; regionId: string }
  | null;

const DEFAULT_WIDGET_CONFIGS: Record<WidgetType, LayoutWidget['config']> = {
  RelatedList: {
    type: 'RelatedList',
    relatedObjectApiName: '',
    relationshipFieldApiName: '',
    displayColumns: [],
  },
  ActivityFeed: { type: 'ActivityFeed', maxItems: 10 },
  FileFolder: { type: 'FileFolder', provider: 'local' },
  CustomComponent: { type: 'CustomComponent', componentId: '' },
  Spacer: { type: 'Spacer', minHeightPx: 32 },
  HeaderHighlights: { type: 'HeaderHighlights', fieldApiNames: [] },
};

function sortedFields(panel: LayoutPanel): PanelField[] {
  return [...panel.fields].sort((a, b) => a.order - b.order);
}

function sortedWidgets(region: LayoutRegion): LayoutWidget[] {
  return [...region.widgets].sort((a, b) => a.order - b.order);
}

function findRegion(layout: ReturnType<typeof useEditorStore.getState>['layout'], regionId: string) {
  for (const tab of layout.tabs) {
    const region = tab.regions.find((candidate) => candidate.id === regionId);
    if (region) return region;
  }
  return undefined;
}

function findPanel(layout: ReturnType<typeof useEditorStore.getState>['layout'], panelId: string) {
  for (const tab of layout.tabs) {
    for (const region of tab.regions) {
      const panel = region.panels.find((candidate) => candidate.id === panelId);
      if (panel) return { panel, region };
    }
  }
  return undefined;
}

function findWidget(
  layout: ReturnType<typeof useEditorStore.getState>['layout'],
  widgetId: string,
) {
  for (const tab of layout.tabs) {
    for (const region of tab.regions) {
      const widget = region.widgets.find((candidate) => candidate.id === widgetId);
      if (widget) return { widget, region };
    }
  }
  return undefined;
}

function buildField(fieldApiName: string, atIndex: number): PanelField {
  return {
    fieldApiName,
    colSpan: 1,
    behavior: 'none',
    labelStyle: {},
    valueStyle: {},
    order: atIndex,
  };
}

function buildWidget(widgetType: WidgetType, atIndex: number): LayoutWidget {
  return {
    id: `widget-${Date.now()}-${widgetType}`,
    widgetType,
    order: atIndex,
    config: DEFAULT_WIDGET_CONFIGS[widgetType],
  };
}

function isWidgetType(value: string): value is LayoutWidget['widgetType'] {
  return Object.prototype.hasOwnProperty.call(DEFAULT_WIDGET_CONFIGS, value);
}

function parseActiveDrag(
  active: Active,
  layout: ReturnType<typeof useEditorStore.getState>['layout'],
): DragSource {
  const activeId = String(active.id);
  const data = (active.data.current ?? {}) as Record<string, unknown>;

  if (data.type === 'field' && typeof data.panelId === 'string' && typeof data.fieldApiName === 'string') {
    return {
      kind: 'existing-field',
      fieldApiName: data.fieldApiName,
      fromPanelId: data.panelId,
      label: data.fieldApiName,
    };
  }

  if (activeId.startsWith('field-')) {
    const fieldApiName = activeId.replace(/^field-/, '');
    const label =
      typeof data.field === 'object' &&
      data.field !== null &&
      typeof (data.field as { label?: unknown }).label === 'string'
        ? ((data.field as { label: string }).label ?? fieldApiName)
        : fieldApiName;
    return { kind: 'palette-field', fieldApiName, label };
  }

  if (activeId.startsWith('widget-new-')) {
    const widgetType = activeId.replace(/^widget-new-/, '');
    if (!isWidgetType(widgetType)) return null;
    return { kind: 'palette-widget', widgetType, label: widgetType };
  }

  if (data.type === 'widget' && typeof data.widgetId === 'string') {
    const entry = findWidget(layout, data.widgetId);
    return {
      kind: 'existing-widget',
      widgetId: data.widgetId,
      label: entry?.widget.widgetType ?? data.widgetId,
    };
  }

  const widgetEntry = findWidget(layout, activeId);
  if (widgetEntry) {
    return {
      kind: 'existing-widget',
      widgetId: widgetEntry.widget.id,
      label: widgetEntry.widget.widgetType,
    };
  }

  if (data.type === 'panel' && typeof data.panelId === 'string') {
    const panelEntry = findPanel(layout, data.panelId);
    return {
      kind: 'panel',
      panelId: data.panelId,
      regionId: typeof data.regionId === 'string' ? data.regionId : panelEntry?.region.id,
      label: panelEntry?.panel.label ?? data.panelId,
    };
  }

  if (activeId.startsWith('panel-')) {
    const panelEntry = findPanel(layout, activeId);
    if (panelEntry) {
      return {
        kind: 'panel',
        panelId: panelEntry.panel.id,
        regionId: panelEntry.region.id,
        label: panelEntry.panel.label,
      };
    }
  }

  if (data.type === 'region' && typeof data.regionId === 'string') {
    const regionEntry = findRegion(layout, data.regionId);
    return {
      kind: 'region',
      regionId: data.regionId,
      label: regionEntry?.label ?? data.regionId,
    };
  }

  if (activeId.startsWith('region-')) {
    const regionEntry = findRegion(layout, activeId);
    if (regionEntry) return { kind: 'region', regionId: regionEntry.id, label: regionEntry.label };
  }

  return null;
}

function parseDropTarget(
  over: Over,
  layout: ReturnType<typeof useEditorStore.getState>['layout'],
): DropTarget {
  const overId = String(over.id);
  const data = (over.data.current ?? {}) as Record<string, unknown>;

  if (overId.startsWith('panel-drop-')) {
    return { kind: 'panel-drop', panelId: overId.replace(/^panel-drop-/, '') };
  }
  if (data.type === 'panel-drop' && typeof data.panelId === 'string') {
    return { kind: 'panel-drop', panelId: data.panelId };
  }

  if (overId.startsWith('region-drop-')) {
    return { kind: 'region-drop', regionId: overId.replace(/^region-drop-/, '') };
  }
  if (data.type === 'region-drop' && typeof data.regionId === 'string') {
    return { kind: 'region-drop', regionId: data.regionId };
  }

  if (data.type === 'field' && typeof data.panelId === 'string' && typeof data.fieldApiName === 'string') {
    const panelEntry = findPanel(layout, data.panelId);
    if (!panelEntry) return null;
    const ordered = sortedFields(panelEntry.panel);
    const index = ordered.findIndex((field) => field.fieldApiName === data.fieldApiName);
    if (index < 0) return null;
    return { kind: 'field-item', panelId: data.panelId, index };
  }

  if (data.type === 'widget' && typeof data.widgetId === 'string') {
    const widgetEntry = findWidget(layout, data.widgetId);
    if (!widgetEntry) return null;
    const ordered = sortedWidgets(widgetEntry.region);
    const index = ordered.findIndex((widget) => widget.id === data.widgetId);
    if (index < 0) return null;
    return { kind: 'widget-item', regionId: widgetEntry.region.id, index };
  }

  if (data.type === 'panel' && typeof data.panelId === 'string') {
    const panelEntry = findPanel(layout, data.panelId);
    if (!panelEntry) return null;
    const ordered = [...panelEntry.region.panels].sort((a, b) => a.order - b.order);
    const index = ordered.findIndex((panel) => panel.id === data.panelId);
    if (index < 0) return null;
    return {
      kind: 'panel-item',
      panelId: data.panelId,
      regionId: panelEntry.region.id,
      index,
    };
  }

  if (data.type === 'region' && typeof data.regionId === 'string') {
    return { kind: 'region-item', regionId: data.regionId };
  }

  if (overId.startsWith('region-') && findRegion(layout, overId)) {
    return { kind: 'region-item', regionId: overId };
  }

  return null;
}

export function DndContextWrapper({
  children,
  getFieldDef,
}: {
  children: React.ReactNode;
  getFieldDef?: (apiName: string) => unknown;
}) {
  void getFieldDef;

  const layout = useEditorStore((s) => s.layout);
  const addField = useEditorStore((s) => s.addField);
  const moveField = useEditorStore((s) => s.moveField);
  const addWidget = useEditorStore((s) => s.addWidget);
  const moveWidget = useEditorStore((s) => s.moveWidget);
  const movePanel = useEditorStore((s) => s.movePanel);
  const updateRegion = useEditorStore((s) => s.updateRegion);

  const [overlayLabel, setOverlayLabel] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const parsed = parseActiveDrag(event.active, layout);
      setOverlayLabel(parsed?.label ?? String(event.active.id));
    },
    [layout],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setOverlayLabel(null);
      if (!event.over) return;

      const active = parseActiveDrag(event.active, layout);
      const target = parseDropTarget(event.over, layout);
      if (!active || !target) return;

      if (active.kind === 'palette-field' || active.kind === 'existing-field') {
        let targetPanelId: string | null = null;
        let targetIndex = 0;

        if (target.kind === 'panel-drop') {
          const entry = findPanel(layout, target.panelId);
          if (!entry) return;
          targetPanelId = target.panelId;
          targetIndex = sortedFields(entry.panel).length;
        } else if (target.kind === 'field-item') {
          targetPanelId = target.panelId;
          targetIndex = target.index;
        } else {
          return;
        }

        if (active.kind === 'palette-field') {
          addField(buildField(active.fieldApiName, targetIndex), targetPanelId, targetIndex);
          return;
        }

        const sourcePanel = findPanel(layout, active.fromPanelId);
        if (!sourcePanel) return;
        const sourceOrdered = sortedFields(sourcePanel.panel);
        const sourceIndex = sourceOrdered.findIndex(
          (field) => field.fieldApiName === active.fieldApiName,
        );
        if (sourceIndex < 0) return;

        let insertionIndex = targetIndex;
        if (active.fromPanelId === targetPanelId && sourceIndex < targetIndex) {
          insertionIndex -= 1;
        }
        if (active.fromPanelId === targetPanelId && sourceIndex === insertionIndex) {
          return;
        }

        moveField(active.fieldApiName, active.fromPanelId, targetPanelId, insertionIndex);
        return;
      }

      if (active.kind === 'palette-widget' || active.kind === 'existing-widget') {
        let targetRegionId: string | null = null;
        let targetIndex = 0;

        if (target.kind === 'region-drop') {
          const region = findRegion(layout, target.regionId);
          if (!region) return;
          targetRegionId = target.regionId;
          targetIndex = sortedWidgets(region).length;
        } else if (target.kind === 'widget-item') {
          targetRegionId = target.regionId;
          targetIndex = target.index;
        } else {
          return;
        }

        if (active.kind === 'palette-widget') {
          addWidget(buildWidget(active.widgetType, targetIndex), targetRegionId, targetIndex);
          return;
        }

        const source = findWidget(layout, active.widgetId);
        if (!source) return;
        const sourceOrdered = sortedWidgets(source.region);
        const sourceIndex = sourceOrdered.findIndex((widget) => widget.id === source.widget.id);
        if (sourceIndex < 0) return;

        let insertionIndex = targetIndex;
        if (source.region.id === targetRegionId && sourceIndex < targetIndex) {
          insertionIndex -= 1;
        }
        if (source.region.id === targetRegionId && sourceIndex === insertionIndex) {
          return;
        }

        moveWidget(source.widget.id, targetRegionId, insertionIndex);
        return;
      }

      if (active.kind === 'panel' && target.kind === 'panel-item') {
        const activeRegionId =
          active.regionId ?? findPanel(layout, active.panelId)?.region.id;
        if (!activeRegionId || activeRegionId !== target.regionId) return;
        if (active.panelId === target.panelId) return;
        movePanel(active.panelId, target.regionId, target.index);
        return;
      }

      if (active.kind === 'region' && target.kind === 'region-item') {
        if (active.regionId === target.regionId) return;
        const overRegion = findRegion(layout, target.regionId);
        if (!overRegion) return;
        updateRegion(active.regionId, {
          gridColumn: overRegion.gridColumn,
          gridRow: overRegion.gridRow,
        });
      }
    },
    [addField, addWidget, layout, moveField, movePanel, moveWidget, updateRegion],
  );

  const handleDragCancel = useCallback(() => {
    setOverlayLabel(null);
  }, []);

  const overlay = useMemo(
    () =>
      overlayLabel ? (
        <div className="rounded-full border border-brand-navy/20 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm">
          {overlayLabel}
        </div>
      ) : null,
    [overlayLabel],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay>{overlay}</DragOverlay>
    </DndContext>
  );
}
