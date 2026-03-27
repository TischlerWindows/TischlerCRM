'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LayoutPanel, LayoutSection } from './types';
import { useEditorStore } from './editor-store';
import { CanvasPanel } from './canvas-panel';
import { CanvasWidgetCard } from './canvas-widget';

interface CanvasRegionProps {
  region: LayoutSection;
  tabId: string;
}

const REGION_RESIZE_STEP_PX = 28;

const REGION_RADIUS_PX: Record<'none' | 'sm' | 'lg', number> = {
  none: 0,
  sm: 8,
  lg: 14,
};

const REGION_SHADOW: Record<'none' | 'sm' | 'md', string> = {
  none: 'none',
  sm: '0 1px 3px rgba(15, 23, 42, 0.12)',
  md: '0 10px 24px rgba(15, 23, 42, 0.14)',
};

export function CanvasRegion({ region, tabId }: CanvasRegionProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const updateSection = useEditorStore((s) => s.updateSection);
  const addPanel = useEditorStore((s) => s.addPanel);
  const removeSection = useEditorStore((s) => s.removeSection);
  const resizeSection = useEditorStore((s) => s.resizeSection);

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(region.label);
  const [dragSpan, setDragSpan] = useState<number | null>(null);
  const { setNodeRef: setWidgetDropRef, isOver: isWidgetDropOver } = useDroppable({
    id: `region-drop-${region.id}`,
    data: { type: 'region-drop', regionId: region.id },
  });
  const resizeSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startSpan: number;
  } | null>(null);

  useEffect(() => {
    setDraftLabel(region.label);
  }, [region.label]);

  useEffect(() => {
    return () => {
      resizeSessionRef.current = null;
    };
  }, []);

  const sortedPanels = useMemo(
    () => [...region.panels].sort((a, b) => a.order - b.order),
    [region.panels],
  );

  const sortedWidgets = useMemo(
    () => [...region.widgets].sort((a, b) => a.order - b.order),
    [region.widgets],
  );

  const isRegionSelected =
    selectedElement?.type === 'region' && selectedElement.id === region.id;

  const wrapperStyle: React.CSSProperties = {
    gridColumn: `${region.gridColumn} / span ${dragSpan ?? region.gridColumnSpan}`,
    gridRow: `${region.gridRow} / span ${region.gridRowSpan}`,
    ...(region.style.background ? { backgroundColor: region.style.background } : {}),
    ...(region.style.borderColor ? { borderColor: region.style.borderColor } : {}),
    ...(region.style.borderStyle ? { borderStyle: region.style.borderStyle } : {}),
    ...(region.style.borderRadius ? { borderRadius: REGION_RADIUS_PX[region.style.borderRadius] } : {}),
    ...(region.style.shadow ? { boxShadow: REGION_SHADOW[region.style.shadow] } : {}),
  };

  if (region.style.borderStyle === 'none') {
    wrapperStyle.borderWidth = 0;
  }

  const selectRegion = () => {
    setSelectedElement({ type: 'region', id: region.id });
  };

  const commitLabel = () => {
    setIsEditingLabel(false);
    const next = draftLabel.trim();
    if (!next || next === region.label) return;
    updateSection(region.id, { label: next });
  };

  const addDefaultPanel = () => {
    const panel: LayoutPanel = {
      id: `panel-${Date.now()}`,
      label: `New Panel ${region.panels.length + 1}`,
      order: region.panels.length,
      columns: 2,
      style: {},
      fields: [],
    };
    addPanel(panel, region.id);
  };

  const getPointerStep = (dx: number) =>
    dx >= 0
      ? Math.floor(dx / REGION_RESIZE_STEP_PX)
      : Math.ceil(dx / REGION_RESIZE_STEP_PX);

  const endResizeGesture = (target: HTMLButtonElement) => {
    const session = resizeSessionRef.current;
    if (!session) return;
    if (target.releasePointerCapture) {
      try {
        if (target.hasPointerCapture(session.pointerId)) {
          target.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Ignore capture release errors from stale pointers.
      }
    }
    resizeSessionRef.current = null;
    setDragSpan(null);
  };

  const startResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startSpan: region.gridColumnSpan,
    };
    setDragSpan(region.gridColumnSpan);
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextSpan = Math.max(2, session.startSpan + getPointerStep(event.clientX - session.startX));
    setDragSpan(nextSpan);
  };

  const onResizePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextSpan = Math.max(2, session.startSpan + getPointerStep(event.clientX - session.startX));
    if (nextSpan !== session.startSpan) {
      resizeSection(region.id, nextSpan);
    }
    endResizeGesture(event.currentTarget);
  };

  const onResizePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    endResizeGesture(event.currentTarget);
  };

  const onResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    event.stopPropagation();
    const nextSpan =
      event.key === 'ArrowRight'
        ? region.gridColumnSpan + 1
        : Math.max(2, region.gridColumnSpan - 1);
    resizeSection(region.id, nextSpan);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-white transition-colors border-l-4 ${
        isRegionSelected
          ? 'border-brand-navy ring-1 ring-brand-navy/20 border-l-brand-navy'
          : 'border-gray-200 border-l-gray-300'
      }`}
      style={wrapperStyle}
      data-tab-id={tabId}
    >
      {region.hidden ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
        </div>
      ) : null}
      <div
        className="flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-100/80 px-3 py-2"
        onClick={selectRegion}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-gray-500" />
          {isEditingLabel ? (
            <input
              autoFocus
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  commitLabel();
                } else if (e.key === 'Escape') {
                  setDraftLabel(region.label);
                  setIsEditingLabel(false);
                }
              }}
              className="h-7 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              className="group/label flex items-center gap-1 truncate text-left text-sm font-medium text-gray-900"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingLabel(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectRegion();
              }}
              title="Double-click to rename"
            >
              {region.label}
              <Pencil className="h-3 w-3 text-gray-400 opacity-0 group-hover/label:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              removeSection(region.id);
            }}
            aria-label="Delete section"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        {sortedPanels.map((panel) => (
          <CanvasPanel key={panel.id} panel={panel} regionId={region.id} />
        ))}

        {(sortedWidgets.length > 0 || isRegionSelected) && (
          <div
            ref={setWidgetDropRef}
            className={`space-y-2 rounded-lg border bg-gray-50/60 p-2 transition-colors ${
              isWidgetDropOver ? 'border-brand-navy/35 bg-brand-navy/5' : 'border-gray-200'
            }`}
            aria-label="Section widget drop zone"
          >
            <SortableContext
              items={sortedWidgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedWidgets.length > 0 ? (
                sortedWidgets.map((widget) => (
                  <CanvasWidgetCard key={widget.id} widget={widget} />
                ))
              ) : isRegionSelected ? (
                <div className="rounded border border-dashed border-gray-300 py-3 text-center text-xs text-gray-500">
                  Drop a widget here
                </div>
              ) : null}
            </SortableContext>
          </div>
        )}

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-600 hover:border-brand-navy hover:text-brand-navy"
          onClick={addDefaultPanel}
        >
          <Plus className="h-3.5 w-3.5" />
          + Field Section
        </button>
      </div>

      <button
        type="button"
        className="absolute inset-y-0 right-0 w-6 cursor-col-resize border-0 bg-brand-navy/5 p-0 hover:bg-brand-navy/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 touch-none"
        onPointerDown={startResize}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerCancel}
        onKeyDown={onResizeKeyDown}
        onClick={(e) => e.stopPropagation()}
        aria-label="Resize section width"
        title="Resize section width"
      />
    </div>
  );
}
