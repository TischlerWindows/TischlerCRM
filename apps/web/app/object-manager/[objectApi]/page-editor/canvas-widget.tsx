'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CanvasWidget } from './types';
import { useEditorStore } from './editor-store';
import {
  GripVertical,
  Trash2,
  LayoutGrid,
  Activity,
  FolderOpen,
  Component,
  Minus,
} from 'lucide-react';

const WIDGET_ICONS: Record<string, React.ElementType> = {
  RelatedList: LayoutGrid,
  ActivityFeed: Activity,
  FileFolder: FolderOpen,
  CustomComponent: Component,
  Spacer: Minus,
};

const WIDGET_LABELS: Record<string, string> = {
  RelatedList: 'Related List',
  ActivityFeed: 'Activity Feed',
  FileFolder: 'File Folder',
  CustomComponent: 'Custom Component',
  Spacer: 'Spacer',
};

export function CanvasWidgetCard({
  widget,
  sectionColumns,
  gridRowStart,
  stackMode,
  isOver,
  dropSide,
}: {
  widget: CanvasWidget;
  sectionColumns: number;
  gridRowStart: number;
  stackMode?: boolean;
  isOver: boolean;
  dropSide: 'top' | 'bottom' | null;
}) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const deleteWidget = useEditorStore((s) => s.deleteWidget);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: widget.id,
    data: { widget },
  });

  const Icon = WIDGET_ICONS[widget.widgetType] || Component;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none',
    ...(stackMode
      ? {}
      : {
          gridColumn: `${widget.column + 1} / span ${Math.min(widget.colSpan, sectionColumns - widget.column)}`,
          gridRow: `${gridRowStart + 1} / span ${widget.rowSpan}`,
        }),
  };

  const isSelected =
    selectedElement?.type === 'widget' && selectedElement.id === widget.id;

  const configSummary = (() => {
    if (widget.config.type === 'RelatedList') {
      return widget.config.relatedObjectApiName || 'Not configured';
    }
    if (widget.config.type === 'FileFolder') {
      return widget.config.provider || 'Not configured';
    }
    if (widget.config.type === 'ActivityFeed') {
      return `Max ${widget.config.maxItems || 10} items`;
    }
    if (widget.config.type === 'CustomComponent') {
      return widget.config.componentId || 'Not configured';
    }
    if (widget.config.type === 'Spacer') {
      return widget.config.minHeightPx ? `${widget.config.minHeightPx}px tall` : 'Blank space';
    }
    return '';
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-editor-sortable-id={widget.id}
      {...attributes}
      {...listeners}
      className={`p-3 border-2 border-dashed rounded-lg relative group cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? 'cursor-grabbing z-10' : ''
      } ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-blue-300 bg-blue-50/30 hover:bg-blue-50/60'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedElement({ type: 'widget', id: widget.id });
      }}
    >
      {isOver && dropSide === 'top' && (
        <div className="absolute -top-1 left-0 right-0 h-1.5 bg-teal-400 rounded-full z-10 shadow-[0_0_6px_rgba(20,184,166,0.4)]" />
      )}
      {isOver && dropSide === 'bottom' && (
        <div className="absolute -bottom-1 left-0 right-0 h-1.5 bg-teal-400 rounded-full z-10 shadow-[0_0_6px_rgba(20,184,166,0.4)]" />
      )}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="text-blue-400 shrink-0 pointer-events-none" aria-hidden>
            <GripVertical className="w-4 h-4" />
          </div>
          <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-blue-900">
              {WIDGET_LABELS[widget.widgetType] || widget.widgetType}
            </div>
            <div className="text-xs text-blue-600">{configSummary}</div>
          </div>
        </div>
        <button
          type="button"
          className="opacity-0 group-hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            deleteWidget(widget.id);
          }}
        >
          <Trash2 className="h-3 w-3 text-red-500" />
        </button>
      </div>
    </div>
  );
}
