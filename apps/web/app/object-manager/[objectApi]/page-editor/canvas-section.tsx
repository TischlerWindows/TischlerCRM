'use client';

import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { FieldDef } from '@/lib/schema';
import type { CanvasField, CanvasSection as CanvasSectionType, CanvasWidget } from './types';
import { CanvasFieldCard } from './canvas-field';
import { CanvasWidgetCard } from './canvas-widget';
import { useEditorStore } from './editor-store';
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
  GripVertical,
} from 'lucide-react';

export function CanvasSectionComponent({
  section,
  sectionFields,
  sectionWidgets,
  getFieldDef,
  isFirst,
  isLast,
  overId,
  dropSide,
}: {
  section: CanvasSectionType;
  sectionFields: CanvasField[];
  sectionWidgets: CanvasWidget[];
  getFieldDef: (apiName: string) => FieldDef | undefined;
  isFirst: boolean;
  isLast: boolean;
  overId: string | null;
  dropSide: 'top' | 'bottom' | null;
}) {
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const deleteSection = useEditorStore((s) => s.deleteSection);
  const moveSection = useEditorStore((s) => s.moveSection);
  const toggleSectionCollapsed = useEditorStore((s) => s.toggleSectionCollapsed);

  // Droppable for each column
  const columnDroppables = Array.from({ length: section.columns }, (_, i) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `${section.id}-col-${i}`,
      data: { sectionId: section.id, columnIndex: i },
    });
    return { setNodeRef, isOver };
  });

  // Sort fields by order
  const sortedFields = [...sectionFields].sort((a, b) => a.order - b.order);

  // Build occupied-cell map for CSS grid placement
  const occupied = new Set<string>();
  const fieldGridRow = new Map<string, number>();
  const columnArrays: CanvasField[][] = [];
  for (let c = 0; c < section.columns; c++) {
    columnArrays[c] = sortedFields.filter((f) => f.column === c);
  }

  for (let c = 0; c < section.columns; c++) {
    for (const f of columnArrays[c]) {
      const cs = Math.min(f.colSpan, section.columns - f.column);
      const rs = f.rowSpan;
      let row = 0;
      search: while (true) {
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (occupied.has(`${row + dr},${f.column + dc}`)) {
              row++;
              continue search;
            }
          }
        }
        break;
      }
      fieldGridRow.set(f.id, row);
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          occupied.add(`${row + dr},${f.column + dc}`);
        }
      }
    }
  }

  // All item IDs for SortableContext
  const allItemIds = [...sortedFields.map((f) => f.id), ...sectionWidgets.map((w) => w.id)];

  return (
    <div
      className="border rounded-xl bg-white shadow-sm overflow-hidden"
      onClick={() => setSelectedElement({ type: 'section', id: section.id })}
    >
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-l-4 border-l-brand-navy">
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); toggleSectionCollapsed(section.id); }}>
            {section.collapsed ? (
              <ChevronRight className="h-4 w-4 text-gray-600" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-600" />
            )}
          </button>
          <span className="font-medium text-gray-900">{section.label}</span>
          <span className="text-xs text-gray-500">
            ({section.columns} col{section.columns > 1 ? 's' : ''})
          </span>
          {section.visibleIf && section.visibleIf.length > 0 && (
            <div
              className="p-1 bg-orange-500 rounded flex-shrink-0"
              title={`Section visibility: ${section.visibleIf.length} rule${section.visibleIf.length !== 1 ? 's' : ''}`}
            >
              <Eye className="w-3 h-3" fill="white" stroke="black" strokeWidth="0.5px" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'up'); }}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 p-1"
            disabled={isFirst}
            title="Move section up"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); moveSection(section.id, 'down'); }}
            className="text-gray-400 hover:text-gray-700 disabled:opacity-30 p-1"
            disabled={isLast}
            title="Move section down"
          >
            <ArrowDown className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
            className="text-red-400 hover:text-red-600 p-1"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Section body — CSS Grid */}
      {!section.collapsed && (
        <div className="p-4">
          <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: `repeat(${section.columns}, 1fr)`,
                gridAutoRows: 'minmax(60px, auto)',
              }}
            >
              {/* Render fields with grid placement */}
              {sortedFields.map((field) => {
                const fieldDef = getFieldDef(field.fieldApiName);
                if (!fieldDef) return null;
                return (
                  <CanvasFieldCard
                    key={field.id}
                    field={field}
                    fieldDef={fieldDef}
                    sectionColumns={section.columns}
                    isOver={overId === field.id}
                    dropSide={overId === field.id ? dropSide : null}
                  />
                );
              })}

              {/* Render widgets */}
              {sectionWidgets.map((widget) => (
                <CanvasWidgetCard
                  key={widget.id}
                  widget={widget}
                  sectionColumns={section.columns}
                />
              ))}

              {/* Empty column drop zones */}
              {sortedFields.length === 0 && sectionWidgets.length === 0 && (
                <>
                  {Array.from({ length: section.columns }, (_, colIdx) => (
                    <div
                      key={`empty-${section.id}-col-${colIdx}`}
                      ref={columnDroppables[colIdx]?.setNodeRef}
                      className={`min-h-[80px] p-4 rounded-lg border-2 border-dashed transition-colors flex items-center justify-center ${
                        columnDroppables[colIdx]?.isOver
                          ? 'border-teal-400 bg-teal-50'
                          : 'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className="text-center text-gray-400 text-xs">
                        <Plus className="h-5 w-5 mx-auto mb-1" />
                        Drop here
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Column drop zones when there ARE fields (hidden behind grid) */}
            {(sortedFields.length > 0 || sectionWidgets.length > 0) && (
              <div className="grid gap-3 mt-2" style={{ gridTemplateColumns: `repeat(${section.columns}, 1fr)` }}>
                {Array.from({ length: section.columns }, (_, colIdx) => (
                  <div
                    key={`drop-${section.id}-col-${colIdx}`}
                    ref={columnDroppables[colIdx]?.setNodeRef}
                    className={`min-h-[40px] rounded-lg border-2 border-dashed transition-colors flex items-center justify-center ${
                      columnDroppables[colIdx]?.isOver
                        ? 'border-teal-400 bg-teal-50'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    {columnDroppables[colIdx]?.isOver && (
                      <span className="text-xs text-teal-600">Drop here</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
