import type { WidgetType } from '@/lib/schema';

// ── Drag source ─────────────────────────────────────────────────────────────

export type DragSource =
  | { kind: 'palette-field'; fieldApiName: string; label: string }
  | { kind: 'palette-team-member-slot'; label: string }
  | { kind: 'palette-panel'; columns: 1 | 2 | 3 | 4; label: string; panelType?: 'components' }
  | { kind: 'existing-field'; fieldApiName: string; fromPanelId: string; label: string }
  | { kind: 'palette-widget'; widgetType: WidgetType; label: string; externalWidgetId?: string }
  | { kind: 'existing-widget'; widgetId: string; label: string }
  | { kind: 'panel'; panelId: string; regionId?: string; label: string }
  | { kind: 'region'; regionId: string; label: string }
  | null;

// ── Drop target ─────────────────────────────────────────────────────────────

export type DropTarget =
  | { kind: 'panel-drop'; panelId: string }
  | { kind: 'region-drop'; regionId: string }
  | { kind: 'field-item'; panelId: string; index: number }
  | { kind: 'widget-item'; regionId: string; index: number }
  | { kind: 'panel-item'; panelId: string; regionId: string; index: number }
  | { kind: 'region-item'; regionId: string }
  | { kind: 'palette-remove' }
  | null;
