'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { LayoutWidget } from './types';
import { useEditorStore } from './editor-store';
import {
  Sparkles,
  Trash2,
  LayoutGrid,
  Activity,
  FolderOpen,
  Component,
  Minus,
  Rows3,
} from 'lucide-react';

interface CanvasWidgetCardProps {
  widget: LayoutWidget;
}

const WIDGET_ICONS: Record<LayoutWidget['widgetType'], React.ElementType> = {
  RelatedList: LayoutGrid,
  ActivityFeed: Activity,
  FileFolder: FolderOpen,
  CustomComponent: Component,
  Spacer: Minus,
  HeaderHighlights: Sparkles,
};

const WIDGET_LABELS: Record<LayoutWidget['widgetType'], string> = {
  RelatedList: 'Related List',
  ActivityFeed: 'Activity Feed',
  FileFolder: 'File Folder',
  CustomComponent: 'Custom Component',
  Spacer: 'Spacer',
  HeaderHighlights: 'Header Highlights',
};

function summarizeWidget(widget: LayoutWidget): string {
  switch (widget.config.type) {
    case 'RelatedList':
      return widget.config.relatedObjectApiName || 'No related object selected';
    case 'ActivityFeed':
      return widget.config.maxItems ? `Max ${widget.config.maxItems} items` : 'Recent activity';
    case 'FileFolder':
      return widget.config.provider || 'No provider selected';
    case 'CustomComponent':
      return widget.config.componentId || 'No component selected';
    case 'Spacer':
      return widget.config.minHeightPx ? `Min height ${widget.config.minHeightPx}px` : 'Flexible spacing';
    case 'HeaderHighlights': {
      const fields = Array.isArray(widget.config.fieldApiNames)
        ? widget.config.fieldApiNames
        : [];
      if (fields.length === 0) return 'No highlight fields selected';
      const preview = fields.slice(0, 3);
      const extraCount = fields.length - preview.length;
      return extraCount > 0 ? `${preview.join(', ')} +${extraCount}` : preview.join(', ');
    }
    default:
      return '';
  }
}

export function CanvasWidgetCard({ widget }: CanvasWidgetCardProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { type: 'widget', widgetId: widget.id },
  });

  const Icon = WIDGET_ICONS[widget.widgetType] || Rows3;

  const isSelected =
    selectedElement?.type === 'widget' && selectedElement.id === widget.id;
  const configSummary = summarizeWidget(widget);
  const widgetLabel = WIDGET_LABELS[widget.widgetType] || widget.widgetType;
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      aria-label={`Select ${widgetLabel} widget card`}
      data-editor-sortable-id={widget.id}
      className={`group rounded-lg border bg-white p-2.5 transition-all ${
        isSelected
          ? 'border-brand-navy/60 ring-1 ring-brand-navy/20'
          : 'border-gray-200 hover:border-brand-navy/30'
      } ${isDragging ? 'z-20' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedElement({ type: 'widget', id: widget.id });
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          setSelectedElement({ type: 'widget', id: widget.id });
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            className="mt-0.5 shrink-0 cursor-grab rounded px-1 text-sm leading-none text-gray-500 hover:bg-gray-100 hover:text-gray-700 active:cursor-grabbing"
            aria-label={`Drag ${widgetLabel} widget`}
            onPointerDown={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
          <Icon className="h-4 w-4 shrink-0 text-brand-navy" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-gray-900">
              {widgetLabel}
            </div>
            <div className="truncate text-xs text-gray-600">{configSummary}</div>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-gray-500 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeWidget(widget.id);
          }}
          aria-label="Delete widget"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
