'use client';

import type { CSSProperties, ElementType, JSX } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { WidgetType } from '@/lib/schema';
import {
  Activity,
  Component,
  FolderOpen,
  ListTree,
  Sparkles,
  StretchHorizontal,
} from 'lucide-react';

const WIDGET_ITEMS: Array<{
  widgetType: WidgetType;
  label: string;
  helperText: string;
  icon: ElementType;
}> = [
  {
    widgetType: 'HeaderHighlights',
    label: 'Header Highlights',
    helperText: 'Show key record values in a compact summary strip.',
    icon: Sparkles,
  },
  {
    widgetType: 'RelatedList',
    label: 'Related List',
    helperText: 'Display related records with selectable columns.',
    icon: ListTree,
  },
  {
    widgetType: 'ActivityFeed',
    label: 'Activity Feed',
    helperText: 'Surface timeline activity and recent interactions.',
    icon: Activity,
  },
  {
    widgetType: 'FileFolder',
    label: 'Files & Folders',
    helperText: 'Expose file uploads and folder-style organization.',
    icon: FolderOpen,
  },
  {
    widgetType: 'CustomComponent',
    label: 'Custom Component',
    helperText: 'Embed a custom module by component identifier.',
    icon: Component,
  },
  {
    widgetType: 'Spacer',
    label: 'Spacer',
    helperText: 'Add vertical breathing room between layout blocks.',
    icon: StretchHorizontal,
  },
];

function DraggableComponentCard({
  widgetType,
  label,
  helperText,
  icon: Icon,
}: (typeof WIDGET_ITEMS)[number]) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget-new-${widgetType}`,
    data: {
      type: 'palette-widget',
      widgetType,
      label,
    },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-navy/30 hover:bg-brand-navy/[0.03] active:cursor-grabbing"
    >
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 rounded-md border border-gray-200 bg-gray-50 p-1.5 text-gray-700">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-gray-900">{label}</span>
          <span className="mt-0.5 block text-xs leading-4 text-gray-500">{helperText}</span>
        </span>
      </div>
    </button>
  );
}

export function PaletteComponents(): JSX.Element {
  return (
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {WIDGET_ITEMS.map((item) => (
          <DraggableComponentCard key={item.widgetType} {...item} />
        ))}
      </div>
    </div>
  );
}
