'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Eye, GripVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { LayoutPanel, LayoutSection } from './types';
import { useEditorStore } from './editor-store';
import { CanvasPanel } from './canvas-panel';
import { CanvasWidgetCard } from './canvas-widget';
import { CanvasErrorBoundary } from './canvas-error-boundary';
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

const EMPTY_RULES: never[] = [];

export function CanvasRegion({ region, tabId }: CanvasRegionProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const updateSection = useEditorStore((s) => s.updateSection);
  const addPanel = useEditorStore((s) => s.addPanel);
  const removeSection = useEditorStore((s) => s.removeSection);
  const resizeSection = useEditorStore((s) => s.resizeSection);
  const formattingRules = useEditorStore((s) => s.layout.formattingRules ?? EMPTY_RULES);

  const hasVisibilityRule = useMemo(
    () =>
      ((region as any).visibleIf?.length > 0) ||
      formattingRules.some(
        (r) =>
          r.active !== false &&
          r.target.kind === 'region' &&
          r.target.regionId === region.id &&
          r.when.length > 0,
      ),
    [formattingRules, region.id, (region as any).visibleIf],
  );

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(region.label);
  const [dragSpan, setDragSpan] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const { setNodeRef: setWidgetDropRef, isOver: isWidgetDropOver } = useDroppable({
    id: `region-drop-${region.id}`,
    data: { type: 'region-drop', regionId: region.id },
  });
  const { setNodeRef: setRegionDropRef } = useDroppable({
    id: `region-swap-${region.id}`,
    data: { type: 'region', regionId: region.id },
  });
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: region.id,
    data: { type: 'region', regionId: region.id },
    disabled: dragSpan !== null,
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

  const isEmpty = sortedPanels.length === 0 && sortedWidgets.length === 0;
  const showChrome = !isEmpty || isRegionSelected || isHovered;

  const wrapperStyle: React.CSSProperties = {
    gridColumn: `${region.gridColumn} / span ${dragSpan ?? region.gridColumnSpan}`,
    gridRow: `${region.gridRow} / span ${region.gridRowSpan}`,
    ...(region.style.background ? { backgroundColor: region.style.background } : {}),
    ...(region.style.borderColor ? { borderColor: region.style.borderColor } : {}),
    ...(region.style.borderStyle ? { borderStyle: region.style.borderStyle } : {}),
    ...(region.style.borderRadius ? { borderRadius: REGION_RADIUS_PX[region.style.borderRadius] ?? 0 } : {}),
    ...(region.style.shadow ? { boxShadow: REGION_SHADOW[region.style.shadow] ?? 'none' } : {}),
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
    const nextSpan = Math.min(12, Math.max(2, session.startSpan + getPointerStep(event.clientX - session.startX)));
    setDragSpan(nextSpan);
  };

  const onResizePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextSpan = Math.min(12, Math.max(2, session.startSpan + getPointerStep(event.clientX - session.startX)));
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

  /* ── Resize handle (shared between empty and populated states) ── */
  const resizeHandle = (
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
  );

  /* ── Empty region: Salesforce-style clean drop zone ── */
  if (isEmpty) {
    return (
      <CanvasErrorBoundary label="Section">
        <div
          ref={setWidgetDropRef}
          className={cn(
            'group/empty-region relative flex min-h-[120px] flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all',
            isWidgetDropOver
              ? 'border-brand-navy bg-brand-navy/5'
              : isRegionSelected
                ? 'border-brand-navy/60 bg-brand-navy/[0.03] ring-2 ring-brand-navy/25'
                : 'border-gray-300 bg-white hover:border-brand-navy/40 hover:bg-slate-50',
          )}
          style={wrapperStyle}
          data-tab-id={tabId}
          onClick={selectRegion}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {region.hidden ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
            </div>
          ) : null}

          {/* Compact header — only visible on hover or selection; also serves as region-swap drop target */}
          <div
            ref={setRegionDropRef}
            className={cn(
              'absolute inset-x-0 top-0 flex items-center justify-between gap-2 rounded-t-xl px-3 py-1.5 transition-opacity',
              showChrome ? 'opacity-100' : 'opacity-0',
            )}
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                ref={setDragRef}
                {...dragListeners}
                {...dragAttributes}
                className={cn(
                  'flex cursor-grab items-center text-gray-400 hover:text-brand-navy/60',
                  isDragging && 'cursor-grabbing opacity-50',
                )}
                title="Drag to swap region position"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-3.5 w-3.5 shrink-0" />
              </span>
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
                  className="h-6 rounded border border-gray-300 bg-white px-1.5 text-xs text-gray-900"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <button
                  type="button"
                  className="truncate text-left text-xs font-medium text-gray-500 hover:text-brand-navy"
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
                </button>
              )}
              <span className="shrink-0 rounded-full bg-gray-200 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-gray-500">
                {region.gridColumnSpan} cols
              </span>
              {hasVisibilityRule && (
                <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-semibold text-orange-600" title="Has visibility rule">
                  <Eye className="h-3 w-3" /> Conditional
                </span>
              )}
            </div>
            <button
              type="button"
              className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                removeSection(region.id);
              }}
              aria-label="Delete section"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Central drop prompt */}
          <div className="pointer-events-none flex flex-col items-center gap-1.5">
            <Plus className={cn(
              'h-6 w-6 transition-colors',
              isWidgetDropOver ? 'text-brand-navy' : 'text-gray-300',
            )} />
            <span className={cn(
              'text-sm font-medium transition-colors',
              isWidgetDropOver ? 'text-brand-navy' : 'text-gray-400',
            )}>
              Add Component(s) Here
            </span>
          </div>

          {resizeHandle}
        </div>
      </CanvasErrorBoundary>
    );
  }

  /* ── Populated region: full chrome with panels & widgets ── */
  return (
    <CanvasErrorBoundary label="Section">
    <div
      className={cn(
        'group/region relative overflow-hidden rounded-xl border bg-slate-50 transition-colors border-l-4 border-l-brand-navy/50',
        isRegionSelected
          ? 'border-brand-navy ring-2 ring-brand-navy/25 border-l-brand-navy'
          : 'border-gray-200',
      )}
      style={wrapperStyle}
      data-tab-id={tabId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {region.hidden ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
        </div>
      ) : null}

      {/* Section header */}
      <div
        ref={setRegionDropRef}
        className="flex items-center justify-between gap-2 border-b border-brand-navy/15 bg-brand-navy/10 px-3 py-2 cursor-pointer"
        onClick={selectRegion}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span
            ref={setDragRef}
            {...dragListeners}
            {...dragAttributes}
            className={cn(
              'flex cursor-grab items-center text-brand-navy/60',
              isDragging && 'cursor-grabbing opacity-50',
            )}
            title="Drag to swap region position"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 shrink-0" />
          </span>
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
          {hasVisibilityRule && (
            <span className="shrink-0 flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600" title="Has visibility rule">
              <Eye className="h-3 w-3" /> Conditional
            </span>
          )}
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

        {/* Widget drop zone */}
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

        {/* Add Panel — contextual, shown on hover or selection */}
        <div className={cn(
          'transition-opacity',
          (isHovered || isRegionSelected) ? 'opacity-100' : 'opacity-0',
        )}>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-brand-navy/25 py-2 text-xs font-medium text-brand-navy/60 hover:border-brand-navy hover:text-brand-navy hover:bg-brand-navy/5 transition-colors"
            onClick={addDefaultPanel}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Panel
          </button>
        </div>
      </div>

      {resizeHandle}
    </div>
    </CanvasErrorBoundary>
  );
}
