'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CanvasWidget } from './types';
import { CanvasWidgetCard } from './canvas-widget';
import { useEditorDragUi } from './editor-drag-ui-context';
import { LayoutGrid } from 'lucide-react';

const TAB_ROOT_SUFFIX = '-tab-root';

export function tabRootDroppableId(activeTabId: string): string {
  return `${activeTabId}${TAB_ROOT_SUFFIX}`;
}

export function TabRootWidgetArea({
  activeTabId,
  tabWidgets,
}: {
  activeTabId: string;
  tabWidgets: CanvasWidget[];
}) {
  const { overId, dropSide } = useEditorDragUi();
  const dropId = tabRootDroppableId(activeTabId);
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { kind: 'tab-root', tabId: activeTabId },
  });

  const ids = tabWidgets.map((w) => w.id);
  const isEmpty = tabWidgets.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={`mb-5 rounded-xl border-2 border-dashed px-3 py-3 transition-colors ${
        isOver ? 'border-teal-400 bg-teal-50/70' : 'border-gray-200 bg-white/80'
      }`}
    >
      <div className="mb-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <LayoutGrid className="h-4 w-4 shrink-0 text-gray-500" aria-hidden />
          Widgets for this tab
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Sits above sections on the record page. Drag from the Widgets tab in the left panel.
        </p>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-3 min-h-[48px]">
          {isEmpty ? (
            <p className="text-xs text-gray-500 py-3 text-center rounded-md bg-gray-50/80 border border-dashed border-gray-200">
              No widgets yet. Open the Widgets list on the left and drag one into this area.
            </p>
          ) : (
            tabWidgets.map((w) => (
              <CanvasWidgetCard
                key={w.id}
                widget={w}
                sectionColumns={1}
                gridRowStart={0}
                stackMode
                isOver={overId === w.id}
                dropSide={overId === w.id ? dropSide : null}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}
