import type { WidgetType } from '@/lib/schema';
import type { LayoutWidget, PanelField } from '../types';
import type { DragSource, DropTarget } from './types';
import type { EditorState } from '../editor-store';
import { getWidgetById } from '@/lib/widgets/registry-loader';
import { findPanel, findRegion, findWidget, sortedFields, sortedWidgets } from './drag-parser';

// ── Default widget configs ──────────────────────────────────────────────────

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
  TeamMembersRollup: { type: 'TeamMembersRollup' },
  TeamMemberAssociations: { type: 'TeamMemberAssociations' },
  ExternalWidget: { type: 'ExternalWidget', externalWidgetId: '', displayMode: 'full', config: {} },
  Path: { type: 'Path', pathId: '', showLabel: true, showGuidance: true, showKeyFields: true, compact: false },
  InstallationCostGrid: { type: 'InstallationCostGrid' },
  Summary: { type: 'Summary' },
};

// ── Builders ────────────────────────────────────────────────────────────────

export function buildField(fieldApiName: string, atIndex: number): PanelField {
  return {
    fieldApiName,
    colSpan: 1,
    behavior: 'none',
    labelStyle: {},
    valueStyle: {},
    order: atIndex,
  };
}

export function buildWidget(widgetType: WidgetType, atIndex: number, externalWidgetId?: string): LayoutWidget {
  if (widgetType === 'ExternalWidget') {
    const manifest = externalWidgetId ? getWidgetById(externalWidgetId) : undefined;
    const defaultConfig: Record<string, unknown> = Object.fromEntries(
      (manifest?.configSchema ?? [])
        .filter((f): f is Extract<typeof f, { key: string }> => 'key' in f)
        .map((f) => [f.key, f.default ?? '']),
    );
    return {
      id: `widget-${Date.now()}-ext-${externalWidgetId ?? 'unknown'}`,
      widgetType: 'ExternalWidget',
      order: atIndex,
      config: {
        type: 'ExternalWidget' as const,
        externalWidgetId: externalWidgetId ?? '',
        displayMode: manifest?.defaultDisplayMode ?? 'full',
        config: defaultConfig,
      },
    };
  }
  return {
    id: `widget-${Date.now()}-${widgetType}`,
    widgetType,
    order: atIndex,
    config: DEFAULT_WIDGET_CONFIGS[widgetType],
  };
}

// ── Store action types (subset of EditorState used by the handler) ──────────

interface DragEndActions {
  addField: EditorState['addField'];
  moveField: EditorState['moveField'];
  removeField: EditorState['removeField'];
  addWidget: EditorState['addWidget'];
  moveWidget: EditorState['moveWidget'];
  movePanel: EditorState['movePanel'];
  swapSections: EditorState['swapSections'];
  addPanel: EditorState['addPanel'];
}

// ── handleDragEnd dispatch logic ────────────────────────────────────────────

export function dispatchDragEnd(
  active: DragSource,
  target: DropTarget,
  layout: EditorState['layout'],
  actions: DragEndActions,
): void {
  if (!active || !target) return;

  const { addField, moveField, removeField, addWidget, moveWidget, movePanel, swapSections, addPanel } = actions;

  // Dragging an existing field back to the palette remove zone -> remove it
  if (active.kind === 'existing-field' && target.kind === 'palette-remove') {
    removeField(active.fieldApiName, active.fromPanelId);
    return;
  }

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
      addWidget(buildWidget(active.widgetType, targetIndex, active.externalWidgetId), targetRegionId, targetIndex);
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

  // palette-panel dropped onto a region -> add a new panel
  if (active.kind === 'palette-panel' && target.kind === 'region-drop') {
    addPanel(
      {
        id: `panel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: active.label,
        order: 0,
        columns: active.columns,
        style: {},
        fields: [],
      },
      target.regionId,
    );
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
    swapSections(active.regionId, target.regionId);
  }
}
