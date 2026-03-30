'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LayoutPanel } from './types';
import { useEditorStore } from './editor-store';
import { CanvasFieldCard } from './canvas-field';
import { cn } from '@/lib/utils';

interface CanvasPanelProps {
  panel: LayoutPanel;
  regionId: string;
}

export function CanvasPanel({ panel, regionId }: CanvasPanelProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const updatePanel = useEditorStore((s) => s.updatePanel);
  const removePanel = useEditorStore((s) => s.removePanel);

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [draftLabel, setDraftLabel] = useState(panel.label);

  // Sortable for panel drag-to-reorder within a section
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: panel.id,
    data: { type: 'panel', panelId: panel.id, regionId },
  });

  // Separate droppable for field drops into the panel body
  const { setNodeRef: setDropRef, isOver: isFieldDropOver } = useDroppable({
    id: `panel-drop-${panel.id}`,
    data: { type: 'panel-drop', panelId: panel.id },
  });

  useEffect(() => {
    setDraftLabel(panel.label);
  }, [panel.label]);

  const orderedFields = useMemo(
    () => [...panel.fields].sort((a, b) => a.order - b.order),
    [panel.fields],
  );

  const isPanelSelected =
    selectedElement?.type === 'panel' && selectedElement.id === panel.id;

  const headerStyle: React.CSSProperties = {
    ...(panel.style.headerBackground
      ? { backgroundColor: panel.style.headerBackground }
      : {}),
    ...(panel.style.headerTextColor ? { color: panel.style.headerTextColor } : {}),
    fontWeight: panel.style.headerBold ? 700 : undefined,
    fontStyle: panel.style.headerItalic ? 'italic' : undefined,
    textTransform: panel.style.headerUppercase ? 'uppercase' : undefined,
  };

  const bodyStyle: React.CSSProperties = {
    ...(panel.style.bodyBackground ? { backgroundColor: panel.style.bodyBackground } : {}),
  };

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const selectPanel = () => {
    setSelectedElement({ type: 'panel', id: panel.id });
  };

  const commitLabel = () => {
    setIsEditingLabel(false);
    const next = draftLabel.trim();
    if (!next || next === panel.label) return;
    updatePanel(panel.id, { label: next });
  };

  return (
    <div
      ref={setSortableRef}
      style={sortableStyle}
      className={cn(
        'relative rounded-lg border bg-white shadow-sm transition-colors',
        isPanelSelected ? 'border-brand-navy ring-1 ring-brand-navy/20' : 'border-gray-300',
        isDragging && 'z-20 shadow-lg',
      )}
      data-region-id={regionId}
    >
      {panel.hidden ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-white/70 pointer-events-none">
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Hidden</span>
        </div>
      ) : null}

      {/* Panel header — white/gray-50 to contrast with the section's navy-tinted header */}
      <div
        className={cn(
          'flex items-center justify-between gap-2 rounded-t-lg border-b border-gray-200 bg-gray-50 px-3 py-2 border-l-2',
          isPanelSelected ? 'border-l-brand-navy' : 'border-l-gray-300',
        )}
        onClick={selectPanel}
        style={headerStyle}
      >
        <div className="flex min-w-0 items-center gap-2">
          {/* Drag handle — now wired to sortable listeners */}
          <button
            type="button"
            className="shrink-0 cursor-grab rounded p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing focus-visible:outline-none"
            aria-label="Drag to reorder panel"
            title="Drag to reorder"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
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
                  setDraftLabel(panel.label);
                  setIsEditingLabel(false);
                }
              }}
              className="h-7 rounded border border-gray-300 bg-white px-2 text-sm text-gray-900"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <button
              type="button"
              className="group/label flex items-center gap-1 truncate text-left text-sm font-medium text-gray-700"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingLabel(true);
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectPanel();
              }}
              title="Double-click to rename"
            >
              {panel.label}
              <Pencil className="h-3 w-3 text-gray-400 opacity-0 transition-opacity group-hover/label:opacity-100" />
            </button>
          )}
          <span className="rounded-full bg-brand-navy/10 px-2 py-0.5 text-xs font-semibold text-brand-navy">
            {panel.columns} cols
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600"
            onClick={(e) => {
              e.stopPropagation();
              removePanel(panel.id);
            }}
            aria-label="Remove panel"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={setDropRef}
        className={cn(
          'grid gap-2 rounded-b-lg border border-transparent p-3 transition-colors',
          isFieldDropOver && 'border-brand-navy/30 bg-brand-navy/5',
        )}
        aria-label="Panel drop zone"
        style={{
          ...bodyStyle,
          gridTemplateColumns: `repeat(${panel.columns}, minmax(0, 1fr))`,
        }}
      >
        <SortableContext
          items={orderedFields.map((f) => `field-${f.fieldApiName}`)}
          strategy={rectSortingStrategy}
        >
          {orderedFields.length === 0 ? (
            <div className="col-span-full rounded border border-dashed border-gray-300 py-5 text-center text-xs text-gray-500">
              Drop fields here
            </div>
          ) : (
            orderedFields.map((field) => (
              <CanvasFieldCard
                key={field.fieldApiName}
                field={field}
                panelId={panel.id}
                panelColumns={panel.columns}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
