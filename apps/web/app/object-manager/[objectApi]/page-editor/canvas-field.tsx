'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { labelPresentationClassName } from '@/lib/layout-presentation';
import type { FieldDef } from '@/lib/schema';
import type { CanvasField } from './types';
import { useEditorStore } from './editor-store';
import { GripVertical, Trash2, Eye, List } from 'lucide-react';

export function CanvasFieldCard({
  field,
  fieldDef,
  sectionColumns,
  gridRowStart,
  stackMode,
  isOver,
  dropSide,
}: {
  field: CanvasField;
  fieldDef: FieldDef;
  sectionColumns: number;
  /** 0-based row from packing algorithm (CSS grid mode only) */
  gridRowStart: number;
  /** Vertical column stack in section editor (no CSS grid placement) */
  stackMode?: boolean;
  isOver: boolean;
  dropSide: 'top' | 'bottom' | null;
}) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const deleteField = useEditorStore((s) => s.deleteField);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: field.id,
    data: { field, fieldDef },
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
    ...(stackMode
      ? {}
      : {
          gridColumn: `${field.column + 1} / span ${Math.min(field.colSpan, sectionColumns - field.column)}`,
          gridRow: `${gridRowStart + 1} / span ${field.rowSpan}`,
        }),
  };

  const isSelected =
    selectedElement?.type === 'field' && selectedElement.id === field.id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-editor-sortable-id={field.id}
      {...attributes}
      {...listeners}
      className={`p-3 border rounded-lg bg-white relative group cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging ? 'cursor-grabbing z-10' : ''
      } ${
        isSelected
          ? 'border-brand-navy border-2 shadow-md ring-1 ring-brand-navy/20'
          : 'border-gray-200 hover:shadow-sm'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedElement({ type: 'field', id: field.id });
      }}
    >
      {/* Drop indicators */}
      {isOver && dropSide === 'top' && (
        <div className="absolute -top-1 left-0 right-0 h-1.5 bg-teal-400 rounded-full z-10 shadow-[0_0_6px_rgba(20,184,166,0.4)]" />
      )}
      {isOver && dropSide === 'bottom' && (
        <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-teal-400 rounded-full z-10 shadow-[0_0_6px_rgba(20,184,166,0.4)]" />
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="text-gray-400 shrink-0 pointer-events-none" aria-hidden>
            <GripVertical className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className={`text-sm flex items-center gap-1 ${labelPresentationClassName(field.presentation)}`}
            >
              {fieldDef.label}
              {fieldDef.required && <span className="text-red-500">*</span>}
            </div>
            <div className="text-xs text-gray-500">{fieldDef.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(field.colSpan > 1 || field.rowSpan > 1) && (
            <span className="text-xs text-blue-600 font-medium whitespace-nowrap">
              {field.colSpan}&times;{field.rowSpan}
            </span>
          )}
          {fieldDef.visibleIf && fieldDef.visibleIf.length > 0 && (
            <div
              className="p-1 bg-orange-500 rounded flex-shrink-0"
              title={`Visibility filter: ${fieldDef.visibleIf.map((f: any) => `${f.fieldApiName} ${f.operator} ${f.value}`).join(', ')}`}
            >
              <Eye className="w-3 h-3" fill="white" stroke="black" strokeWidth="0.5px" />
            </div>
          )}
          {fieldDef.picklistDependencies && fieldDef.picklistDependencies.length > 0 && (
            <div
              className="p-1 bg-amber-500 rounded flex-shrink-0"
              title={`Value dependencies: ${fieldDef.picklistDependencies.length} rule${fieldDef.picklistDependencies.length !== 1 ? 's' : ''}`}
            >
              <List className="w-3 h-3" stroke="white" strokeWidth="2.5px" />
            </div>
          )}
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              deleteField(field.id);
            }}
          >
            <Trash2 className="h-3 w-3 text-red-500" />
          </button>
        </div>
      </div>

      {/* Right-edge resize handle (colSpan) */}
      {sectionColumns > 1 && (
        <div
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize opacity-0 group-hover:opacity-100 bg-gray-200/80 hover:bg-brand-navy/15 border-r border-dashed border-gray-300/90 rounded-r transition-opacity"
          title="Drag to stretch columns"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const event = new CustomEvent('field-resize-start', {
              detail: {
                id: field.id,
                dir: 'col',
                startX: e.clientX,
                startY: e.clientY,
                startColSpan: field.colSpan,
                startRowSpan: field.rowSpan,
                sectionCols: sectionColumns - field.column,
              },
            });
            window.dispatchEvent(event);
          }}
        />
      )}
      {/* Bottom-edge resize handle (rowSpan) */}
      <div
        className="absolute bottom-0 left-0 h-1.5 w-full cursor-row-resize opacity-0 group-hover:opacity-100 bg-gray-200/80 hover:bg-brand-navy/15 border-t border-dashed border-gray-300/90 rounded-b transition-opacity"
        title="Drag to stretch rows"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          const event = new CustomEvent('field-resize-start', {
            detail: {
              id: field.id,
              dir: 'row',
              startX: e.clientX,
              startY: e.clientY,
              startColSpan: field.colSpan,
              startRowSpan: field.rowSpan,
              sectionCols: sectionColumns - field.column,
            },
          });
          window.dispatchEvent(event);
        }}
      />
      {/* Corner resize handle */}
      {sectionColumns > 1 && (
        <div
          className="absolute bottom-0 right-0 w-2.5 h-2.5 cursor-nwse-resize opacity-0 group-hover:opacity-100 bg-gray-200/90 hover:bg-brand-navy/20 border border-dashed border-gray-400/70 rounded-br transition-opacity z-10"
          title="Drag to stretch both"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const event = new CustomEvent('field-resize-start', {
              detail: {
                id: field.id,
                dir: 'both',
                startX: e.clientX,
                startY: e.clientY,
                startColSpan: field.colSpan,
                startRowSpan: field.rowSpan,
                sectionCols: sectionColumns - field.column,
              },
            });
            window.dispatchEvent(event);
          }}
        />
      )}
    </div>
  );
}
