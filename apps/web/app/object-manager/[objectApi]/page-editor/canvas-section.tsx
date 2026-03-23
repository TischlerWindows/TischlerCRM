'use client';

import React, { useMemo } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import type { FieldDef } from '@/lib/schema';
import type { CanvasField, CanvasSection as CanvasSectionType, CanvasWidget } from './types';
import { CanvasFieldCard } from './canvas-field';
import { CanvasWidgetCard } from './canvas-widget';
import { useEditorStore } from './editor-store';
import { SectionColumnDropTarget } from './section-column-drop-target';
import { useEditorDragUi } from './editor-drag-ui-context';
import {
  ChevronRight,
  ChevronDown,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
} from 'lucide-react';

type ColumnEntry =
  | { kind: 'field'; field: CanvasField }
  | { kind: 'widget'; widget: CanvasWidget };

function entriesForColumn(
  colIdx: number,
  sectionFields: CanvasField[],
  sectionWidgets: CanvasWidget[],
): ColumnEntry[] {
  const fields = sectionFields
    .filter((f) => f.column === colIdx)
    .sort((a, b) => a.order - b.order)
    .map((field) => ({ kind: 'field' as const, field }));
  const widgets = sectionWidgets
    .filter((w) => w.column === colIdx)
    .sort((a, b) => a.order - b.order)
    .map((widget) => ({ kind: 'widget' as const, widget }));
  return [...fields, ...widgets].sort((a, b) => {
    const oa = a.kind === 'field' ? a.field.order : a.widget.order;
    const ob = b.kind === 'field' ? b.field.order : b.widget.order;
    return oa - ob;
  });
}

/** First grid row reserved for per-column drop targets when using packed layout */
const PACK_DROP_ROW = 1;
const PACK_CONTENT_START_ROW = 2;

type PackEntry = {
  kind: 'field' | 'widget';
  id: string;
  column: number;
  order: number;
  colSpan: number;
  rowSpan: number;
  field?: CanvasField;
  widget?: CanvasWidget;
  fieldDef?: FieldDef;
};

type PackedPlaced =
  | {
      kind: 'field';
      field: CanvasField;
      fieldDef: FieldDef;
      gridRow: number;
      colSpan: number;
      rowSpan: number;
    }
  | {
      kind: 'widget';
      widget: CanvasWidget;
      gridRow: number;
      colSpan: number;
      rowSpan: number;
    };

function computePackedPlacements(
  sectionFields: CanvasField[],
  sectionWidgets: CanvasWidget[],
  sectionColumns: number,
  getFieldDef: (apiName: string) => FieldDef | undefined,
): PackedPlaced[] {
  const list: PackEntry[] = [];
  for (const f of sectionFields) {
    const fieldDef = getFieldDef(f.fieldApiName);
    if (!fieldDef) continue;
    list.push({
      kind: 'field',
      id: f.id,
      column: f.column,
      order: f.order,
      colSpan: Math.max(1, f.colSpan),
      rowSpan: Math.max(1, f.rowSpan),
      field: f,
      fieldDef,
    });
  }
  for (const w of sectionWidgets) {
    list.push({
      kind: 'widget',
      id: w.id,
      column: w.column,
      order: w.order,
      colSpan: Math.max(1, w.colSpan),
      rowSpan: Math.max(1, w.rowSpan),
      widget: w,
    });
  }
  const colGroups: PackEntry[][] = [];
  for (let c = 0; c < sectionColumns; c++) {
    colGroups[c] = list.filter((e) => e.column === c).sort((a, b) => a.order - b.order);
  }
  const occupied = new Set<string>();
  const placed: PackedPlaced[] = [];
  for (let c = 0; c < sectionColumns; c++) {
    for (const entry of colGroups[c]) {
      const cs = Math.min(entry.colSpan, sectionColumns - entry.column);
      const rs = entry.rowSpan;
      let row = PACK_CONTENT_START_ROW;
      search: while (true) {
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (occupied.has(`${row + dr},${entry.column + dc}`)) {
              row++;
              continue search;
            }
          }
        }
        break;
      }
      if (entry.kind === 'field' && entry.field && entry.fieldDef) {
        placed.push({
          kind: 'field',
          field: entry.field,
          fieldDef: entry.fieldDef,
          gridRow: row,
          colSpan: cs,
          rowSpan: rs,
        });
      } else if (entry.kind === 'widget' && entry.widget) {
        placed.push({
          kind: 'widget',
          widget: entry.widget,
          gridRow: row,
          colSpan: cs,
          rowSpan: rs,
        });
      }
      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          occupied.add(`${row + dr},${entry.column + dc}`);
        }
      }
    }
  }
  return placed;
}

export function CanvasSectionComponent({
  section,
  sectionFields,
  sectionWidgets,
  getFieldDef,
  isFirst,
  isLast,
}: {
  section: CanvasSectionType;
  sectionFields: CanvasField[];
  sectionWidgets: CanvasWidget[];
  getFieldDef: (apiName: string) => FieldDef | undefined;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { overId, dropSide } = useEditorDragUi();
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const deleteSection = useEditorStore((s) => s.deleteSection);
  const moveSection = useEditorStore((s) => s.moveSection);
  const toggleSectionCollapsed = useEditorStore((s) => s.toggleSectionCollapsed);

  const allItemIds = [...sectionFields.map((f) => f.id), ...sectionWidgets.map((w) => w.id)];

  const hasContent = sectionFields.length > 0 || sectionWidgets.length > 0;

  const needsPackedGrid =
    sectionFields.some((f) => f.colSpan > 1 || f.rowSpan > 1) ||
    sectionWidgets.some((w) => w.colSpan > 1 || w.rowSpan > 1);

  const packedPlaced = useMemo(
    () =>
      needsPackedGrid
        ? computePackedPlacements(sectionFields, sectionWidgets, section.columns, getFieldDef)
        : [],
    [needsPackedGrid, sectionFields, sectionWidgets, section.columns, getFieldDef],
  );

  return (
    <div
      className="group border rounded-xl bg-white shadow-sm overflow-hidden"
      onClick={() => setSelectedElement({ type: 'section', id: section.id })}
    >
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

      {!section.collapsed && (
        <div className="p-4">
          <SortableContext
            items={allItemIds}
            strategy={needsPackedGrid ? rectSortingStrategy : verticalListSortingStrategy}
          >
            {needsPackedGrid ? (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: section.columns }, (_, colIdx) => {
                  const colDropId = `${section.id}-col-${colIdx}`;
                  return (
                    <SectionColumnDropTarget key={colDropId} sectionId={section.id} columnIndex={colIdx}>
                      {({ setNodeRef, isOver }) => (
                        <div
                          ref={setNodeRef}
                          style={{ gridColumn: colIdx + 1, gridRow: PACK_DROP_ROW }}
                          className={`flex min-h-[52px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-2 py-2 text-center text-[10px] text-gray-400 transition-colors ${
                            isOver
                              ? 'border-teal-400 bg-teal-50/90'
                              : 'border-gray-200/90 bg-gray-50/40'
                          }`}
                        >
                          <Plus className="mb-0.5 h-4 w-4 opacity-50" />
                          Drop
                        </div>
                      )}
                    </SectionColumnDropTarget>
                  );
                })}

                {!hasContent && (
                  <div
                    className="flex flex-col items-center justify-center py-8 text-center text-gray-400 text-xs"
                    style={{ gridColumn: `1 / -1`, gridRow: PACK_CONTENT_START_ROW }}
                  >
                    <Plus className="h-5 w-5 mx-auto mb-1 opacity-60" />
                    Drag fields or widgets into a column above
                  </div>
                )}

                {packedPlaced.map((p) => {
                  if (p.kind === 'field') {
                    return (
                      <CanvasFieldCard
                        key={p.field.id}
                        field={p.field}
                        fieldDef={p.fieldDef}
                        sectionColumns={section.columns}
                        gridRowStart={p.gridRow - 1}
                        stackMode={false}
                        isOver={overId === p.field.id}
                        dropSide={overId === p.field.id ? dropSide : null}
                      />
                    );
                  }
                  return (
                    <CanvasWidgetCard
                      key={p.widget.id}
                      widget={p.widget}
                      sectionColumns={section.columns}
                      gridRowStart={p.gridRow - 1}
                      stackMode={false}
                      isOver={overId === p.widget.id}
                      dropSide={overId === p.widget.id ? dropSide : null}
                    />
                  );
                })}
              </div>
            ) : (
              <div
                className="grid gap-3"
                style={{
                  gridTemplateColumns: `repeat(${section.columns}, minmax(0, 1fr))`,
                }}
              >
                {Array.from({ length: section.columns }, (_, colIdx) => {
                  const entries = entriesForColumn(colIdx, sectionFields, sectionWidgets);
                  const colDropId = `${section.id}-col-${colIdx}`;

                  return (
                    <SectionColumnDropTarget key={colDropId} sectionId={section.id} columnIndex={colIdx}>
                      {({ setNodeRef, isOver }) => (
                        <div
                          ref={setNodeRef}
                          className={`flex flex-col gap-3 min-h-[200px] rounded-lg p-2 border-2 border-dashed transition-colors ${
                            isOver
                              ? 'border-teal-400 bg-teal-50/90 shadow-[inset_0_0_0_1px_rgba(20,184,166,0.25)]'
                              : 'border-gray-200/90 bg-gray-50/40 hover:border-gray-300'
                          }`}
                        >
                          {entries.map((entry) => {
                            if (entry.kind === 'field') {
                              const { field } = entry;
                              const fieldDef = getFieldDef(field.fieldApiName);
                              if (!fieldDef) return null;
                              return (
                                <CanvasFieldCard
                                  key={field.id}
                                  field={field}
                                  fieldDef={fieldDef}
                                  sectionColumns={section.columns}
                                  gridRowStart={0}
                                  stackMode
                                  isOver={overId === field.id}
                                  dropSide={overId === field.id ? dropSide : null}
                                />
                              );
                            }
                            const { widget } = entry;
                            return (
                              <CanvasWidgetCard
                                key={widget.id}
                                widget={widget}
                                sectionColumns={section.columns}
                                gridRowStart={0}
                                stackMode
                                isOver={overId === widget.id}
                                dropSide={overId === widget.id ? dropSide : null}
                              />
                            );
                          })}

                          {!hasContent && (
                            <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-400 text-xs min-h-[80px] py-4">
                              <Plus className="h-5 w-5 mx-auto mb-1 opacity-60" />
                              Drag fields or widgets here
                            </div>
                          )}

                          {hasContent && entries.length === 0 && (
                            <div className="flex-1 flex items-center justify-center text-xs text-gray-400 min-h-[100px] border border-dashed border-gray-200 rounded-md bg-white/50">
                              Drop into this column
                            </div>
                          )}
                        </div>
                      )}
                    </SectionColumnDropTarget>
                  );
                })}
              </div>
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
