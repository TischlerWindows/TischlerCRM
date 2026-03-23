'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { FieldDef } from '@/lib/schema';
import { TAB_GRID_COLUMNS, gridItemStyle } from '@/lib/tab-canvas-grid';
import type { CanvasField, CanvasSection, CanvasWidget } from './types';
import { CanvasSectionComponent } from './canvas-section';
import { CanvasWidgetCard } from './canvas-widget';
import { SectionRowWeightHandle } from './section-row-weight-handle';
import { useEditorDragUi } from './editor-drag-ui-context';

type Placement = { kind: 'section'; id: string } | { kind: 'widget'; id: string };

export function TabCanvasGridEditor({
  tabId,
  placements,
  sections,
  widgets,
  fields,
  getFieldDef,
  activeSectionsOrdered,
}: {
  tabId: string;
  placements: Placement[];
  sections: CanvasSection[];
  widgets: CanvasWidget[];
  fields: CanvasField[];
  getFieldDef: (apiName: string) => FieldDef | undefined;
  /** Same tab sections sorted by `order` */
  activeSectionsOrdered: CanvasSection[];
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `tab-canvas-${tabId}`,
    data: { kind: 'tab-canvas', tabId },
  });
  const { overId, dropSide } = useEditorDragUi();

  const sortableWidgetIds = placements.filter((p) => p.kind === 'widget').map((p) => p.id);

  return (
    <SortableContext items={sortableWidgetIds} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className={`min-h-[160px] rounded-lg border-2 border-dashed p-3 transition-colors ${
          isOver ? 'border-teal-400 bg-teal-50/40' : 'border-gray-200 bg-white/60'
        }`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${TAB_GRID_COLUMNS}, minmax(0, 1fr))`,
          gap: '0.75rem',
          alignItems: 'stretch',
        }}
      >
        <p className="col-span-full text-xs text-gray-500 mb-1 -mt-1">
          Tab canvas — drag widgets here to place them alongside field sections. Drop on empty canvas
          to add a row.
        </p>
        {placements.map((p, i) => {
          const next = i < placements.length - 1 ? placements[i + 1] : null;
          let showResizeAfter = false;
          let rightNeighborId = '';
          if (p.kind === 'section' && next?.kind === 'section') {
            const cs = sections.find((s) => s.id === p.id);
            const ns = sections.find((s) => s.id === next.id);
            if (
              cs &&
              ns &&
              (cs.gridRow ?? 1) === (ns.gridRow ?? 1) &&
              (cs.gridColumn ?? 1) + (cs.gridColumnSpan ?? TAB_GRID_COLUMNS) === (ns.gridColumn ?? 1)
            ) {
              showResizeAfter = true;
              rightNeighborId = ns.id;
            }
          }

          const gridProps =
            p.kind === 'section'
              ? sections.find((s) => s.id === p.id)!
              : (widgets.find((w) => w.id === p.id)! as CanvasWidget);

          const style = gridItemStyle({
            gridColumn: gridProps.gridColumn ?? 1,
            gridColumnSpan: gridProps.gridColumnSpan ?? TAB_GRID_COLUMNS,
            gridRow: gridProps.gridRow ?? 1,
            gridRowSpan: gridProps.gridRowSpan ?? 1,
          });

          const sectionIdx =
            p.kind === 'section'
              ? activeSectionsOrdered.findIndex((s) => s.id === p.id)
              : -1;

          return (
            <div key={`${p.kind}-${p.id}`} className="relative min-w-0 min-h-[80px]" style={style}>
              {p.kind === 'section' ? (
                (() => {
                  const section = sections.find((s) => s.id === p.id)!;
                  return (
                    <>
                      <CanvasSectionComponent
                        section={section}
                        sectionFields={fields.filter((f) => f.sectionId === section.id)}
                        sectionWidgets={widgets.filter(
                          (w) => w.sectionId && w.sectionId === section.id,
                        )}
                        getFieldDef={getFieldDef}
                        isFirst={sectionIdx === 0}
                        isLast={sectionIdx === activeSectionsOrdered.length - 1}
                      />
                      {showResizeAfter ? (
                        <div className="absolute top-0 bottom-0 right-0 z-20 flex w-0 justify-center pointer-events-auto">
                          <div className="translate-x-1/2">
                            <SectionRowWeightHandle
                              leftSectionId={section.id}
                              rightSectionId={rightNeighborId}
                            />
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()
              ) : (
                (() => {
                  const w = widgets.find((x) => x.id === p.id)!;
                  return (
                    <CanvasWidgetCard
                      widget={w}
                      sectionColumns={1}
                      gridRowStart={0}
                      stackMode
                      isOver={overId === w.id}
                      dropSide={overId === w.id ? dropSide : null}
                    />
                  );
                })()
              )}
            </div>
          );
        })}
      </div>
    </SortableContext>
  );
}
