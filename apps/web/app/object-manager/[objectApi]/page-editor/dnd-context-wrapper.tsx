'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import type { FieldDef, WidgetType } from '@/lib/schema';
import type { CanvasField, CanvasWidget, DraggedItem } from './types';
import { useEditorStore } from './editor-store';

interface ResizeState {
  id: string;
  dir: 'col' | 'row' | 'both';
  startX: number;
  startY: number;
  startColSpan: number;
  startRowSpan: number;
  sectionCols: number;
}

const DEFAULT_WIDGET_CONFIGS: Record<string, any> = {
  RelatedList: { type: 'RelatedList', relatedObjectApiName: '', relationshipFieldApiName: '', displayColumns: [] },
  ActivityFeed: { type: 'ActivityFeed', maxItems: 10 },
  FileFolder: { type: 'FileFolder', provider: 'dropbox' },
  CustomComponent: { type: 'CustomComponent', componentId: '' },
};

export function DndContextWrapper({
  children,
  getFieldDef,
  onSave,
}: {
  children: React.ReactNode;
  getFieldDef: (apiName: string) => FieldDef | undefined;
  onSave: () => void;
}) {
  const fields = useEditorStore((s) => s.fields);
  const addField = useEditorStore((s) => s.addField);
  const setFields = useEditorStore((s) => s.setFields);
  const addWidget = useEditorStore((s) => s.addWidget);
  const updateField = useEditorStore((s) => s.updateField);
  const markDirty = useEditorStore((s) => s.markDirty);
  const deleteField = useEditorStore((s) => s.deleteField);
  const deleteWidget = useEditorStore((s) => s.deleteWidget);
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const undo = useEditorStore((s) => s.undo);

  const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'top' | 'bottom' | null>(null);
  const [resizingField, setResizingField] = useState<ResizeState | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ── Phase 0C: Resize handler using approximate viewport measurement ──
  useEffect(() => {
    if (!resizingField) return;
    // Approximate col width based on typical canvas width
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

  // Listen for custom resize events from canvas-field
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      pushUndo();
      setResizingField(detail);
    };
    window.addEventListener('field-resize-start', handler);
    return () => window.removeEventListener('field-resize-start', handler);
  }, [pushUndo]);

  // ── Phase 6E: Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+S → save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onSave();
      }
      // Ctrl+Z → undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      // Delete → remove selected element
      if (e.key === 'Delete' && selectedElement) {
        // Only delete if not focused in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (selectedElement.type === 'field') {
          deleteField(selectedElement.id);
          setSelectedElement(null);
        } else if (selectedElement.type === 'widget') {
          deleteWidget(selectedElement.id);
          setSelectedElement(null);
        }
      }
      // Escape → deselect
      if (e.key === 'Escape') {
        setSelectedElement(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onSave, undo, selectedElement, deleteField, deleteWidget, setSelectedElement]);

  // ── Drag handlers ──
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
      }
    },
    [fields, getFieldDef],
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
      pushUndo();

      const activeId = active.id.toString();
      const targetId = over.id.toString();

      // Drop into column zone
      if (targetId.includes('-col-')) {
        const colMatch = targetId.match(/^(.+)-col-(\d+)$/);
        if (!colMatch) return;
        const targetSectionId = colMatch[1];
        const targetColumn = parseInt(colMatch[2]);
        const columnFields = fields.filter(
          (f) => f.sectionId === targetSectionId && f.column === targetColumn,
        );
        const maxOrder = columnFields.length > 0 ? Math.max(...columnFields.map((f) => f.order)) : -1;

        if (activeId.startsWith('field-')) {
          const fieldApiName = activeId.replace('field-', '');
          addField({
            id: `placed-${Date.now()}-${fieldApiName}`,
            fieldApiName,
            sectionId: targetSectionId,
            column: targetColumn,
            order: maxOrder + 1,
            colSpan: 1,
            rowSpan: 1,
          });
        } else if (activeId.startsWith('placed-')) {
          setFields(
            fields.map((f) =>
              f.id === activeId
                ? { ...f, sectionId: targetSectionId, column: targetColumn, order: maxOrder + 1 }
                : f,
            ),
          );
          markDirty();
        } else if (activeId.startsWith('widget-new-')) {
          const widgetType = activeId.replace('widget-new-', '') as WidgetType;
          addWidget({
            id: `widget-${Date.now()}-${widgetType}`,
            widgetType,
            sectionId: targetSectionId,
            column: targetColumn,
            order: maxOrder + 1,
            colSpan: 1,
            rowSpan: 1,
            config: DEFAULT_WIDGET_CONFIGS[widgetType],
          });
        }
        return;
      }

      // Drop on existing placed field
      if (targetId.startsWith('placed-')) {
        const overField = fields.find((f) => f.id === targetId);
        if (!overField) return;

        const targetSectionId = overField.sectionId;
        const targetColumn = overField.column;
        const columnFields = fields
          .filter((f) => f.sectionId === targetSectionId && f.column === targetColumn && f.id !== activeId)
          .sort((a, b) => a.order - b.order);
        const overIdx = columnFields.findIndex((f) => f.id === targetId);

        let newOrder = overField.order;
        if (dropSide === 'bottom') {
          newOrder =
            overIdx < columnFields.length - 1
              ? (overField.order + columnFields[overIdx + 1].order) / 2
              : overField.order + 1;
        } else {
          newOrder =
            overIdx > 0
              ? (columnFields[overIdx - 1].order + overField.order) / 2
              : overField.order - 1;
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
        }
      }
    },
    [fields, dropSide, addField, setFields, addWidget, markDirty, pushUndo],
  );

  // Expose overId and dropSide to children via context
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      autoScroll
    >
      <DndOverlayDropSideTracker overId={overId} onDropSideChange={setDropSide} />
      {/* Pass overId/dropSide down via data attribute so children can read */}
      <div data-over-id={overId || ''} data-drop-side={dropSide || ''}>
        {children}
      </div>

      {/* Phase 6A: Semi-transparent drag overlay card */}
      <DragOverlay>
        {draggedItem ? (
          <div className="p-2 bg-white/90 border-2 border-brand-navy rounded-lg shadow-lg backdrop-blur-sm">
            <div className="font-medium text-sm">
              {'apiName' in draggedItem ? draggedItem.label : draggedItem.widgetType}
            </div>
            {'type' in draggedItem && (
              <div className="text-xs text-gray-500">{(draggedItem as any).type}</div>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/** Track which side of the hovered field the cursor is on */
function DndOverlayDropSideTracker({
  overId,
  onDropSideChange,
}: {
  overId: string | null;
  onDropSideChange: (side: 'top' | 'bottom' | null) => void;
}) {
  useEffect(() => {
    if (!overId || !overId.startsWith('placed-')) {
      onDropSideChange(null);
      return;
    }

    const handler = (e: MouseEvent) => {
      // Find the element being hovered by looking for the sortable node
      const el = document.querySelector(`[data-id="${overId}"]`) as HTMLElement | null;
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
