'use client';

/**
 * Phase 3C — Widget palette cards (composed inside FieldPalette Widgets tab).
 */
import type { CSSProperties, ElementType } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { WidgetType } from '@/lib/schema';
import {
  LayoutGrid,
  Activity,
  FolderOpen,
  Component,
  Minus,
} from 'lucide-react';

export const WIDGET_PALETTE_TYPES: {
  type: WidgetType;
  label: string;
  icon: ElementType;
}[] = [
  { type: 'RelatedList', label: 'Related List', icon: LayoutGrid },
  { type: 'ActivityFeed', label: 'Activity Feed', icon: Activity },
  { type: 'FileFolder', label: 'File Folder', icon: FolderOpen },
  { type: 'CustomComponent', label: 'Custom Component', icon: Component },
  { type: 'Spacer', label: 'Spacer', icon: Minus },
];

export function DraggableWidgetPaletteCard({
  wt,
}: {
  wt: (typeof WIDGET_PALETTE_TYPES)[number];
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `widget-new-${wt.type}`,
    data: { widgetType: wt.type },
  });

  const Icon = wt.icon;
  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="p-3 border-2 border-dashed border-blue-300 rounded-lg bg-blue-50/50 cursor-grab active:cursor-grabbing hover:border-blue-500 hover:bg-blue-50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm font-medium text-blue-900">{wt.label}</span>
      </div>
    </div>
  );
}

export function WidgetPaletteGrid() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 mb-3">
        Drag widgets onto the canvas to add them to your layout.
      </p>
      {WIDGET_PALETTE_TYPES.map((wt) => (
        <DraggableWidgetPaletteCard key={wt.type} wt={wt} />
      ))}
    </div>
  );
}
