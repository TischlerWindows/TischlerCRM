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
} from 'lucide-react';

const WIDGET_ICONS: Record<string, React.ElementType> = {
  RelatedList: LayoutGrid,
  ActivityFeed: Activity,
  FileFolder: FolderOpen,
  CustomComponent: Component,
};

const WIDGET_LABELS: Record<string, string> = {
  RelatedList: 'Related List',
  ActivityFeed: 'Activity Feed',
  FileFolder: 'File Folder',
  CustomComponent: 'Custom Component',
};

export function CanvasWidgetCard({
  widget,
  sectionColumns,
}: {
  widget: CanvasWidget;
  sectionColumns: number;
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
    gridColumn: `${widget.column + 1} / span ${Math.min(widget.colSpan, sectionColumns - widget.column)}`,
    gridRow: `span ${widget.rowSpan}`,
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
    return '';
  })();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 border-2 border-dashed rounded-lg relative group cursor-move transition-all ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-blue-300 bg-blue-50/30 hover:bg-blue-50/60'
      }`}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedElement({ type: 'widget', id: widget.id });
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-4 h-4 text-blue-400" />
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
          className="opacity-0 group-hover:opacity-100"
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
