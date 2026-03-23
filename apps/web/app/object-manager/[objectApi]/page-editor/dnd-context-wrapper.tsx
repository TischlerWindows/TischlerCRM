'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { FieldDef, WidgetType } from '@/lib/schema';
import type { CanvasField, CanvasWidget, DraggedItem } from './types';
import { useEditorStore } from './editor-store';
import { EditorDragUiContext } from './editor-drag-ui-context';

interface ResizeState {
  id: string;
  dir: 'col' | 'row' | 'both';
  startX: number;
  startY: number;
  startColSpan: number;
  startRowSpan: number;
  sectionCols: number;
}

const DEFAULT_WIDGET_CONFIGS: Record<WidgetType, any> = {
  RelatedList: { type: 'RelatedList', relatedObjectApiName: '', relationshipFieldApiName: '', displayColumns: [] },
  ActivityFeed: { type: 'ActivityFeed', maxItems: 10 },
  FileFolder: { type: 'FileFolder', provider: 'dropbox' },
  CustomComponent: { type: 'CustomComponent', componentId: '' },
  Spacer: { type: 'Spacer', minHeightPx: 32 },
};

/** Placed canvas widget id: `widget-<timestamp>-<type>` — not palette `widget-new-*` */
function isCanvasWidgetId(id: string): boolean {
  return id.startsWith('widget-') && !id.startsWith('widget-new-');
}

/** New drops onto a column surface go above existing items (smaller order = higher in stack). */
function orderForDropIntoColumn(
  sectionId: string,
  column: number,
  fields: CanvasField[],
  widgets: CanvasWidget[],
): number {
  const orders = [
    ...fields.filter((f) => f.sectionId === sectionId && f.column === column).map((f) => f.order),
    ...widgets
      .filter((w) => w.sectionId && w.sectionId === sectionId && w.column === column)
      .map((w) => w.order),
  ];
  if (orders.length === 0) return 0;
  return Math.min(...orders) - 1;
}

type ColumnRow = { id: string; order: number };

/** Tab-level widgets: sectionId === '' */
function orderForDropIntoTabRoot(
  tabId: string,
  widgets: CanvasWidget[],
): number {
  const orders = widgets
    .filter((w) => w.tabId === tabId && !w.sectionId)
    .map((w) => w.order);
  if (orders.length === 0) return 0;
  return Math.min(...orders) - 1;
}

function tabRootWidgetsSorted(tabId: string, widgets: CanvasWidget[], excludeId: string): ColumnRow[] {
  const rows: ColumnRow[] = [];
  for (const w of widgets) {
    if (w.tabId === tabId && !w.sectionId && w.id !== excludeId) {
      rows.push({ id: w.id, order: w.order });
    }
  }
  return rows.sort((a, b) => a.order - b.order);
}

function columnRowsSorted(
  sectionId: string,
  column: number,
  fields: CanvasField[],
  widgets: CanvasWidget[],
  excludeId: string,
): ColumnRow[] {
  const rows: ColumnRow[] = [];
  for (const f of fields) {
    if (f.sectionId === sectionId && f.column === column && f.id !== excludeId) {
      rows.push({ id: f.id, order: f.order });
    }
  }
  for (const w of widgets) {
    if (w.sectionId && w.sectionId === sectionId && w.column === column && w.id !== excludeId) {
      rows.push({ id: w.id, order: w.order });
    }
  }
  return rows.sort((a, b) => a.order - b.order);
}

const TAB_ROOT_SUFFIX = '-tab-root';

/** Prefer highlights strip when pointer is inside it so drops are not stolen by the canvas. */
const pageEditorCollisionDetection: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  const hi = within.find((c) => String(c.id) === 'layout-highlight-drop');
  if (hi) return [hi];
  return closestCenter(args);
};

export function DndContextWrapper({
  children,
  getFieldDef,
}: {
  children: React.ReactNode;
  getFieldDef: (apiName: string) => FieldDef | undefined;
}) {
  const fields = useEditorStore((s) => s.fields);
  const widgets = useEditorStore((s) => s.widgets);
  const sections = useEditorStore((s) => s.sections);
  const addField = useEditorStore((s) => s.addField);
  const setFields = useEditorStore((s) => s.setFields);
  const setWidgets = useEditorStore((s) => s.setWidgets);
  const addWidget = useEditorStore((s) => s.addWidget);
  const addHighlightField = useEditorStore((s) => s.addHighlightField);
  const markDirty = useEditorStore((s) => s.markDirty);
  const pushUndo = useEditorStore((s) => s.pushUndo);

  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'top' | 'bottom' | null>(null);
  const [resizingField, setResizingField] = useState<ResizeState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (!resizingField) return;
    const canvasEl = document.querySelector('[data-editor-canvas]');
    const canvasWidth = canvasEl?.clientWidth ?? 800;
    const COL_WIDTH = (canvasWidth - 80) / (resizingField.sectionCols + resizingField.startColSpan);
    const ROW_HEIGHT = 72;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizingField.startX;
      const dy = e.clientY - resizingField.startY;
      let newColSpan = resizingField.startColSpan;
      let newRowSpan = resizingField.startRowSpan;

      if (resizingField.dir === 'col' || resizingField.dir === 'both') {
        newColSpan = Math.max(
          1,
          Math.min(resizingField.sectionCols, resizingField.startColSpan + Math.round(dx / COL_WIDTH)),
        );
      }
      if (resizingField.dir === 'row' || resizingField.dir === 'both') {
        newRowSpan = Math.max(1, Math.min(6, resizingField.startRowSpan + Math.round(dy / ROW_HEIGHT)));
      }

      setFields(
        fields.map((f) =>
          f.id === resizingField.id ? { ...f, colSpan: newColSpan, rowSpan: newRowSpan } : f,
        ),
      );
    };

    const handleMouseUp = () => {
      setResizingField(null);
      markDirty();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizingField, fields, setFields, markDirty]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      pushUndo();
      setResizingField(detail);
    };
    window.addEventListener('field-resize-start', handler);
    return () => window.removeEventListener('field-resize-start', handler);
  }, [pushUndo]);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const activeId = event.active.id.toString();

      if (activeId.startsWith('field-')) {
        const fieldApiName = activeId.replace('field-', '');
        const field = getFieldDef(fieldApiName);
        if (field) {
          setDraggedItem({
            id: field.apiName,
            label: field.label,
            apiName: field.apiName,
            type: field.type,
            required: field.required || false,
          });
        }
      } else if (activeId.startsWith('placed-')) {
        const placedField = fields.find((f) => f.id === activeId);
        if (placedField) {
          const fieldDef = getFieldDef(placedField.fieldApiName);
          if (fieldDef) {
            setDraggedItem({
              id: placedField.id,
              label: fieldDef.label,
              apiName: fieldDef.apiName,
              type: fieldDef.type,
              required: fieldDef.required || false,
            });
          }
        }
      } else if (activeId.startsWith('widget-new-')) {
        const widgetType = activeId.replace('widget-new-', '') as WidgetType;
        setDraggedItem({
          id: activeId,
          widgetType,
          label: widgetType,
        });
      } else if (isCanvasWidgetId(activeId)) {
        const w = widgets.find((x) => x.id === activeId);
        if (w) {
          setDraggedItem({
            id: w.id,
            widgetType: w.widgetType,
            label: w.widgetType,
          });
        }
      }
    },
    [fields, widgets, getFieldDef],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const id = event.over ? event.over.id.toString() : null;
    setOverId(id);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setDraggedItem(null);
      setOverId(null);
      setDropSide(null);

      if (!over) return;

      const activeId = active.id.toString();
      const targetId = over.id.toString();

      if (targetId === 'layout-highlight-drop') {
        if (activeId.startsWith('field-')) {
          pushUndo();
          const fieldApiName = activeId.replace('field-', '');
          addHighlightField(fieldApiName);
        } else if (activeId.startsWith('placed-')) {
          const pf = fields.find((f) => f.id === activeId);
          if (pf) {
            pushUndo();
            addHighlightField(pf.fieldApiName);
          }
        }
        return;
      }

      if (targetId.endsWith(TAB_ROOT_SUFFIX)) {
        const targetTabId = targetId.slice(0, -TAB_ROOT_SUFFIX.length);
        const topOrder = orderForDropIntoTabRoot(targetTabId, widgets);
        if (activeId.startsWith('widget-new-')) {
          pushUndo();
          const widgetType = activeId.replace('widget-new-', '') as WidgetType;
          addWidget({
            id: `widget-${Date.now()}-${widgetType}`,
            widgetType,
            tabId: targetTabId,
            sectionId: '',
            column: 0,
            order: topOrder,
            colSpan: 1,
            rowSpan: 1,
            config: DEFAULT_WIDGET_CONFIGS[widgetType],
          });
        } else if (isCanvasWidgetId(activeId)) {
          pushUndo();
          setWidgets(
            widgets.map((w) =>
              w.id === activeId
                ? {
                    ...w,
                    tabId: targetTabId,
                    sectionId: '',
                    column: 0,
                    order: topOrder,
                  }
                : w,
            ),
          );
          markDirty();
        }
        return;
      }

      if (targetId.includes('-col-')) {
        const colMatch = targetId.match(/^(.+)-col-(\d+)$/);
        if (!colMatch) return;
        pushUndo();
        const targetSectionId = colMatch[1];
        const targetColumn = parseInt(colMatch[2], 10);
        const targetTabId = sections.find((s) => s.id === targetSectionId)?.tabId ?? '';
        const topOrder = orderForDropIntoColumn(targetSectionId, targetColumn, fields, widgets);

        if (activeId.startsWith('field-')) {
          const fieldApiName = activeId.replace('field-', '');
          addField({
            id: `placed-${Date.now()}-${fieldApiName}`,
            fieldApiName,
            sectionId: targetSectionId,
            column: targetColumn,
            order: topOrder,
            colSpan: 1,
            rowSpan: 1,
          });
        } else if (activeId.startsWith('placed-')) {
          setFields(
            fields.map((f) =>
              f.id === activeId
                ? { ...f, sectionId: targetSectionId, column: targetColumn, order: topOrder }
                : f,
            ),
          );
          markDirty();
        } else if (activeId.startsWith('widget-new-')) {
          const widgetType = activeId.replace('widget-new-', '') as WidgetType;
          addWidget({
            id: `widget-${Date.now()}-${widgetType}`,
            widgetType,
            tabId: targetTabId,
            sectionId: targetSectionId,
            column: targetColumn,
            order: topOrder,
            colSpan: 1,
            rowSpan: 1,
            config: DEFAULT_WIDGET_CONFIGS[widgetType],
          });
        } else if (isCanvasWidgetId(activeId)) {
          setWidgets(
            widgets.map((w) =>
              w.id === activeId
                ? {
                    ...w,
                    tabId: targetTabId,
                    sectionId: targetSectionId,
                    column: targetColumn,
                    order: topOrder,
                  }
                : w,
            ),
          );
          markDirty();
        }
        return;
      }

      const overField = fields.find((f) => f.id === targetId);
      const overWidget = widgets.find((w) => w.id === targetId);
      if (!overField && !overWidget) return;

      if (overWidget && !overWidget.sectionId) {
        const targetTabId = overWidget.tabId;
        const columnItems = tabRootWidgetsSorted(targetTabId, widgets, activeId);
        const overIdx = columnItems.findIndex((r) => r.id === targetId);
        if (overIdx < 0) return;
        pushUndo();
        const overOrder = overWidget.order;
        let newOrder = overOrder;
        if (dropSide === 'bottom') {
          newOrder =
            overIdx < columnItems.length - 1
              ? (overOrder + columnItems[overIdx + 1].order) / 2
              : overOrder + 1;
        } else {
          newOrder =
            overIdx > 0 ? (columnItems[overIdx - 1].order + overOrder) / 2 : overOrder - 1;
        }
        if (isCanvasWidgetId(activeId)) {
          setWidgets(
            widgets.map((w) =>
              w.id === activeId
                ? {
                    ...w,
                    tabId: targetTabId,
                    sectionId: '',
                    column: 0,
                    order: newOrder,
                  }
                : w,
            ),
          );
          markDirty();
        } else if (activeId.startsWith('widget-new-')) {
          const widgetType = activeId.replace('widget-new-', '') as WidgetType;
          addWidget({
            id: `widget-${Date.now()}-${widgetType}`,
            widgetType,
            tabId: targetTabId,
            sectionId: '',
            column: 0,
            order: newOrder,
            colSpan: 1,
            rowSpan: 1,
            config: DEFAULT_WIDGET_CONFIGS[widgetType],
          });
        }
        return;
      }

      const targetSectionId = overField?.sectionId ?? overWidget!.sectionId;
      const targetColumn = overField?.column ?? overWidget!.column;
      const overOrder = overField?.order ?? overWidget!.order;
      const targetTabId = sections.find((s) => s.id === targetSectionId)?.tabId ?? '';

      const columnItems = columnRowsSorted(targetSectionId, targetColumn, fields, widgets, activeId);
      const overIdx = columnItems.findIndex((r) => r.id === targetId);
      if (overIdx < 0) return;

      pushUndo();

      let newOrder = overOrder;
      if (dropSide === 'bottom') {
        newOrder =
          overIdx < columnItems.length - 1
            ? (overOrder + columnItems[overIdx + 1].order) / 2
            : overOrder + 1;
      } else {
        newOrder =
          overIdx > 0 ? (columnItems[overIdx - 1].order + overOrder) / 2 : overOrder - 1;
      }

      if (activeId.startsWith('field-')) {
        const fieldApiName = activeId.replace('field-', '');
        addField({
          id: `placed-${Date.now()}-${fieldApiName}`,
          fieldApiName,
          sectionId: targetSectionId,
          column: targetColumn,
          order: newOrder,
          colSpan: 1,
          rowSpan: 1,
        });
      } else if (activeId.startsWith('placed-')) {
        setFields(
          fields.map((f) =>
            f.id === activeId
              ? { ...f, sectionId: targetSectionId, column: targetColumn, order: newOrder }
              : f,
          ),
        );
        markDirty();
      } else if (activeId.startsWith('widget-new-')) {
        const widgetType = activeId.replace('widget-new-', '') as WidgetType;
        addWidget({
          id: `widget-${Date.now()}-${widgetType}`,
          widgetType,
          tabId: targetTabId,
          sectionId: targetSectionId,
          column: targetColumn,
          order: newOrder,
          colSpan: 1,
          rowSpan: 1,
          config: DEFAULT_WIDGET_CONFIGS[widgetType],
        });
      } else if (isCanvasWidgetId(activeId)) {
        setWidgets(
          widgets.map((w) =>
            w.id === activeId
              ? {
                  ...w,
                  tabId: targetTabId,
                  sectionId: targetSectionId,
                  column: targetColumn,
                  order: newOrder,
                }
              : w,
          ),
        );
        markDirty();
      }
    },
    [
      fields,
      widgets,
      sections,
      dropSide,
      addField,
      setFields,
      setWidgets,
      addWidget,
      addHighlightField,
      markDirty,
      pushUndo,
    ],
  );

  const dragUiValue = React.useMemo(() => ({ overId, dropSide }), [overId, dropSide]);

  return (
    <EditorDragUiContext.Provider value={dragUiValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={pageEditorCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        autoScroll
      >
        <DndOverlayDropSideTracker overId={overId} onDropSideChange={setDropSide} />
        <div data-over-id={overId || ''} data-drop-side={dropSide || ''}>
          {children}
        </div>

        <DragOverlay>
          {draggedItem ? (
            <div className="p-2 bg-white/90 border-2 border-brand-navy rounded-lg shadow-lg backdrop-blur-sm">
              <div className="font-medium text-sm">
                {'apiName' in draggedItem ? draggedItem.label : draggedItem.widgetType}
              </div>
              {'type' in draggedItem && (
                <div className="text-xs text-gray-500">{(draggedItem as { type?: string }).type}</div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </EditorDragUiContext.Provider>
  );
}

function DndOverlayDropSideTracker({
  overId,
  onDropSideChange,
}: {
  overId: string | null;
  onDropSideChange: (side: 'top' | 'bottom' | null) => void;
}) {
  useEffect(() => {
    const isSortableTarget =
      !!overId &&
      (overId.startsWith('placed-') || isCanvasWidgetId(overId));
    if (!isSortableTarget) {
      onDropSideChange(null);
      return;
    }

    const handler = (e: MouseEvent) => {
      const safe =
        typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
          ? CSS.escape(overId)
          : overId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      const el = document.querySelector(
        `[data-editor-sortable-id="${safe}"]`,
      ) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const y = e.clientY - rect.top;
      onDropSideChange(y < rect.height / 2 ? 'top' : 'bottom');
    };

    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [overId, onDropSideChange]);

  return null;
}
