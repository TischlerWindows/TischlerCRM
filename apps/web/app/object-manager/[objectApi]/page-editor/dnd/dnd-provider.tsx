'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Grid2x2, LayoutPanelLeft, Puzzle } from 'lucide-react';
import { useEditorStore } from '../editor-store';
import type { DragSource } from './types';
import { parseActiveDrag, parseDropTarget } from './drag-parser';
import { dispatchDragEnd } from './drop-handler';

export function DndContextWrapper({
  children,
  getFieldDef,
}: {
  children: React.ReactNode;
  getFieldDef?: (apiName: string) => unknown;
}) {
  void getFieldDef;

  const layout = useEditorStore((s) => s.layout);
  const addField = useEditorStore((s) => s.addField);
  const moveField = useEditorStore((s) => s.moveField);
  const removeField = useEditorStore((s) => s.removeField);
  const addWidget = useEditorStore((s) => s.addWidget);
  const moveWidget = useEditorStore((s) => s.moveWidget);
  const movePanel = useEditorStore((s) => s.movePanel);
  const swapSections = useEditorStore((s) => s.swapSections);

  const [activeDrag, setActiveDrag] = useState<DragSource>(null);

  // Composite collision detection: prefer exact pointer hits on specific field/widget
  // sortable items over container drop zones, then fall back to closest-center.
  // This fixes the "rightmost column" glitch where closestCenter would prefer the
  // panel-drop container instead of the field card the pointer was physically over.
  const collisionDetectionStrategy = useCallback<CollisionDetection>((args) => {
    const pointerHits = pointerWithin(args);
    if (pointerHits.length > 0) {
      // Among pointer hits, prefer individual field/widget sortable items over
      // broader container zones (panel-drop, region-drop, etc.)
      const specificHit = pointerHits.find(({ id }) => {
        const sid = String(id);
        return (
          sid.startsWith('field-') ||
          (sid.startsWith('widget-') && !sid.startsWith('widget-new-'))
        );
      });
      if (specificHit) return [specificHit];
      return pointerHits;
    }
    // Pointer is outside all registered droppables — fall back to closest center
    return closestCenter(args);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const parsed = parseActiveDrag(event.active, layout);
      setActiveDrag(parsed);
    },
    [layout],
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      if (!event.over) return;

      const active = parseActiveDrag(event.active, layout);
      const target = parseDropTarget(event.over, layout);

      const { addPanel } = useEditorStore.getState();

      dispatchDragEnd(active, target, layout, {
        addField,
        moveField,
        removeField,
        addWidget,
        moveWidget,
        movePanel,
        swapSections,
        addPanel,
      });
    },
    [addField, addWidget, layout, moveField, movePanel, moveWidget, removeField, swapSections],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
  }, []);

  const overlay = useMemo(() => {
    if (!activeDrag) return null;
    const { kind, label } = activeDrag;

    if (kind === 'palette-field' || kind === 'existing-field') {
      return (
        <div className="flex min-w-[160px] cursor-grabbing items-center gap-2 rounded-md border border-brand-navy/25 bg-white px-2 py-2 text-xs shadow-lg ring-1 ring-brand-navy/10">
          <span className="shrink-0 text-gray-400" aria-hidden>⠿</span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium text-gray-800">{label}</div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="rounded px-1.5 py-0.5 text-[10px] leading-none ring-1 ring-gray-200 text-gray-500">
                Value
              </span>
            </div>
          </div>
        </div>
      );
    }
    if (kind === 'palette-panel') {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-brand-navy/20 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-md">
          <Grid2x2 className="h-3.5 w-3.5 shrink-0 text-brand-navy/70" />
          {label}
        </div>
      );
    }
    if (kind === 'panel') {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-brand-navy/20 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-md">
          <LayoutPanelLeft className="h-3.5 w-3.5 shrink-0 text-brand-navy/70" />
          {label}
        </div>
      );
    }
    if (kind === 'palette-widget' || kind === 'existing-widget') {
      return (
        <div className="flex items-center gap-2 rounded-lg border border-brand-navy/20 bg-white px-3 py-2 text-xs font-medium text-gray-800 shadow-md">
          <Puzzle className="h-3.5 w-3.5 shrink-0 text-brand-navy/70" />
          {label}
        </div>
      );
    }
    return (
      <div className="rounded-full border border-brand-navy/20 bg-white px-3 py-1.5 text-xs font-medium text-gray-800 shadow-sm">
        {label}
      </div>
    );
  }, [activeDrag]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetectionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      <DragOverlay>{overlay}</DragOverlay>
    </DndContext>
  );
}
