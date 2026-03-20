import type { FieldType, ConditionExpr, PageFieldPresentation } from '@/lib/schema';

export type ColumnCount = 1 | 2 | 3;

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

export type SelectedElement =
  | { type: 'tab'; id: string }
  | { type: 'section'; id: string }
  | { type: 'field'; id: string }
  | null;
