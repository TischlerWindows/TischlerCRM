import type { Active, Over } from '@dnd-kit/core';
import type { WidgetType } from '@/lib/schema';
import type { LayoutPanel, LayoutSection, LayoutWidget, PanelField } from '../types';
import type { DragSource, DropTarget } from './types';
import type { EditorState } from '../editor-store';

// ── Layout lookup helpers ───────────────────────────────────────────────────

export function findRegion(layout: EditorState['layout'], regionId: string) {
  for (const tab of layout.tabs) {
    const region = tab.regions.find((candidate) => candidate.id === regionId);
    if (region) return region;
  }
  return undefined;
}

export function findPanel(layout: EditorState['layout'], panelId: string) {
  for (const tab of layout.tabs) {
    for (const region of tab.regions) {
      const panel = region.panels.find((candidate) => candidate.id === panelId);
      if (panel) return { panel, region };
    }
  }
  return undefined;
}

export function findWidget(layout: EditorState['layout'], widgetId: string) {
  for (const tab of layout.tabs) {
    for (const region of tab.regions) {
      const widget = region.widgets.find((candidate) => candidate.id === widgetId);
      if (widget) return { widget, region };
    }
  }
  return undefined;
}

export function sortedFields(panel: LayoutPanel): PanelField[] {
  return [...panel.fields].sort((a, b) => a.order - b.order);
}

export function sortedWidgets(region: LayoutSection): LayoutWidget[] {
  return [...region.widgets].sort((a, b) => a.order - b.order);
}

// ── Widget type guard ───────────────────────────────────────────────────────

// IMPORTANT: Add every WidgetType value here when registering a new widget.
// This set validates drag ids at runtime. A missing entry causes the widget
// to silently fail to drop from the palette.
const WIDGET_TYPES: ReadonlySet<string> = new Set<string>([
  'RelatedList',
  'CustomComponent',
  'ActivityFeed',
  'FileFolder',
  'Spacer',
  'HeaderHighlights',
  'TeamMembersRollup',
  'TeamMemberAssociations',
  'ExternalWidget',
  'Path',
  'InstallationCostGrid',
  'Summary',
]);

export function isWidgetType(value: string): value is WidgetType {
  return WIDGET_TYPES.has(value);
}

// ── Active drag parser ──────────────────────────────────────────────────────

export function parseActiveDrag(active: Active, layout: EditorState['layout']): DragSource {
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

  if (data.type === 'palette-field' && typeof data.fieldApiName === 'string') {
    return {
      kind: 'palette-field',
      fieldApiName: data.fieldApiName,
      label: typeof data.label === 'string' ? data.label : data.fieldApiName,
    };
  }

  if (activeId.startsWith('palette-field-') || activeId.startsWith('field-')) {
    const fieldApiName = activeId.replace(/^(?:palette-)?field-/, '');
    const label =
      typeof data.field === 'object' &&
      data.field !== null &&
      typeof (data.field as { label?: unknown }).label === 'string'
        ? ((data.field as { label: string }).label ?? fieldApiName)
        : fieldApiName;
    return { kind: 'palette-field', fieldApiName, label };
  }

  if (data.type === 'palette-panel') {
    const cols = data.columns;
    if (cols !== 1 && cols !== 2 && cols !== 3 && cols !== 4) return null;
    return {
      kind: 'palette-panel',
      columns: cols,
      label: typeof data.label === 'string' ? data.label : 'New Section',
      ...(data.panelType === 'components' ? { panelType: 'components' as const } : {}),
    };
  }

  // External widget palette drag (data-driven, detected before ID-based fallback)
  if (data.type === 'palette-widget' && data.widgetType === 'ExternalWidget') {
    return {
      kind: 'palette-widget',
      widgetType: 'ExternalWidget',
      externalWidgetId: typeof data.externalWidgetId === 'string' ? data.externalWidgetId : undefined,
      label: typeof data.label === 'string' ? data.label : 'External Widget',
    };
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

// ── Drop target parser ──────────────────────────────────────────────────────

export function parseDropTarget(over: Over, layout: EditorState['layout']): DropTarget {
  const overId = String(over.id);
  const data = (over.data.current ?? {}) as Record<string, unknown>;

  if (overId === 'palette-field-remove' || data.type === 'palette-remove') {
    return { kind: 'palette-remove' };
  }

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
