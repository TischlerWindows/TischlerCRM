import type { FieldType, ConditionExpr, PageFieldPresentation, WidgetType, WidgetConfig } from '@/lib/schema';

export type ColumnCount = 1 | 2 | 3 | 4;

export interface CanvasField {
  id: string;
  fieldApiName: string;
  sectionId: string;
  column: number;
  order: number;
  colSpan: number;
  rowSpan: number;
  presentation?: PageFieldPresentation;
}

export interface CanvasWidget {
  id: string;
  widgetType: WidgetType;
  /** Tab this widget belongs to */
  tabId: string;
  /**
   * Section containing the widget; empty string = tab-level (not inside a section).
   */
  sectionId: string;
  column: number;
  order: number;
  colSpan: number;
  rowSpan: number;
  config: WidgetConfig;
}

export interface CanvasSection {
  id: string;
  label: string;
  tabId: string;
  columns: ColumnCount;
  order: number;
  collapsed: boolean;
  description?: string;
  visibleIf?: ConditionExpr[];
  showInRecord: boolean;
  showInTemplate: boolean;
  /** Group sections with the same id into one horizontal row */
  layoutRowId?: string;
  /** Flex weight within row (default 1) */
  rowWeight?: number;
}

export interface CanvasTab {
  id: string;
  label: string;
  order: number;
}

export interface DraggedField {
  id: string;
  label: string;
  apiName: string;
  type: FieldType;
  required: boolean;
}

export interface DraggedWidget {
  id: string;
  widgetType: WidgetType;
  label: string;
}

export type DraggedItem = DraggedField | DraggedWidget;

export type SelectedElement =
  | { type: 'tab'; id: string }
  | { type: 'section'; id: string }
  | { type: 'field'; id: string }
  | { type: 'widget'; id: string }
  | null;
