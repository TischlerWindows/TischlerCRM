'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LayoutPanel, LayoutSection } from './types';
import { useEditorStore } from './editor-store';
import { CanvasPanel } from './canvas-panel';
import { CanvasWidgetCard } from './canvas-widget';
import { cn } from '@/lib/utils';

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
      className={cn(
        'relative overflow-hidden rounded-xl border bg-slate-50 transition-colors border-l-4 border-l-brand-navy/50',
        isRegionSelected
          ? 'border-brand-navy ring-2 ring-brand-navy/25 border-l-brand-navy'
          : 'border-gray-200',
      )}
      style={wrapperStyle}
      data-tab-id={tabId}
    >
      {region.hidden ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
        </div>
      ) : null}

      {/* Section header — tinted navy to distinguish from panel headers */}
      <div
        className="flex items-center justify-between gap-2 border-b border-brand-navy/15 bg-brand-navy/10 px-3 py-2 cursor-pointer"
        onClick={selectRegion}
      >
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-brand-navy/60" />
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
              className="group/label flex items-center gap-1 truncate text-left text-sm font-semibold text-brand-navy"
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
              <Pencil className="h-3 w-3 text-brand-navy/40 opacity-0 group-hover/label:opacity-100 transition-opacity" />
            </button>
          )}
          <span className="shrink-0 rounded-full bg-brand-navy/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-navy">
            {region.gridColumnSpan} cols
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
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
        <SortableContext
          items={sortedPanels.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          {sortedPanels.map((panel) => (
            <CanvasPanel key={panel.id} panel={panel} regionId={region.id} />
          ))}
        </SortableContext>

        {/* Widget drop zone — always visible so users know they can drop here */}
        <div
          ref={setWidgetDropRef}
          className={cn(
            'space-y-2 rounded-lg border p-2 transition-colors',
            isWidgetDropOver
              ? 'border-brand-navy/40 bg-brand-navy/5'
              : 'border-dashed border-gray-200 bg-transparent',
          )}
          aria-label="Section widget drop zone"
        >
          <SortableContext
            items={sortedWidgets.map((w) => w.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedWidgets.map((widget) => (
              <CanvasWidgetCard key={widget.id} widget={widget} />
            ))}
            {sortedWidgets.length === 0 && (
              <div className="py-1.5 text-center text-[10px] text-gray-400">
                Drop widgets here
              </div>
            )}
          </SortableContext>
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-brand-navy/25 py-2 text-xs font-medium text-brand-navy/60 hover:border-brand-navy hover:text-brand-navy hover:bg-brand-navy/5 transition-colors"
          onClick={addDefaultPanel}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Panel
        </button>
      </div>

      {/* Resize handle — visible stripe on the right edge */}
      <button
        type="button"
        className="absolute inset-y-0 right-0 flex w-4 cursor-col-resize flex-col items-center justify-center gap-1 border-0 bg-brand-navy/10 p-0 hover:bg-brand-navy/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 touch-none transition-colors"
        onPointerDown={startResize}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerCancel}
        onKeyDown={onResizeKeyDown}
        onClick={(e) => e.stopPropagation()}
        aria-label="Resize section width"
        title="Drag to resize section"
      >
        <span className="h-1 w-1 rounded-full bg-brand-navy/50" />
        <span className="h-1 w-1 rounded-full bg-brand-navy/50" />
        <span className="h-1 w-1 rounded-full bg-brand-navy/50" />
      </button>
    </div>
  );
}
