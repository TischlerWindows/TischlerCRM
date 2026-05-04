'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useDndContext, useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, LayoutGrid, Search, Trash2, UserCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { FieldDef } from '@/lib/schema';
import { getFieldTypeLabel } from '@/lib/schema';
import { useEditorStore } from './editor-store';

export interface PaletteFieldsProps {
  availableFields: FieldDef[];
}

// ── Field Section tiles ──────────────────────────────────────────────────────

const FIELD_SECTION_TILES = [
  { columns: 1 as const, label: '1-Column Section' },
  { columns: 2 as const, label: '2-Column Section' },
  { columns: 3 as const, label: '3-Column Section' },
  { columns: 4 as const, label: '4-Column Section' },
] as const;

function ColumnIcon({ count }: { count: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-3 w-3 rounded-sm bg-gray-400" />
      ))}
    </div>
  );
}

function DraggableFieldSectionTile({ columns, label }: { columns: 1 | 2 | 3 | 4; label: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-panel-${columns}`,
    data: { type: 'palette-panel', columns, label },
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5 text-left text-xs transition-colors hover:border-gray-400 hover:bg-gray-50 active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{label}</span>
      <ColumnIcon count={columns} />
    </button>
  );
}

// ── Field chips ──────────────────────────────────────────────────────────────

function TeamMemberSlotTile() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'palette-team-member-slot',
    data: {
      type: 'palette-team-member-slot',
      label: 'Connection Slot',
    },
  });
  const style: CSSProperties = { opacity: isDragging ? 0 : 1 };
  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-purple-300 bg-purple-50/30 px-2 py-1.5 text-left text-xs transition-colors hover:border-purple-400 hover:bg-purple-50 active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-purple-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium text-purple-800">Connection Slot</span>
      <UserCheck className="h-3.5 w-3.5 shrink-0 text-purple-500" aria-hidden />
    </button>
  );
}

function ComponentSectionTile() {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'palette-panel-components',
    data: { type: 'palette-panel', columns: 1, label: 'Component Section', panelType: 'components' },
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className="flex w-full items-center gap-2 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5 text-left text-xs transition-colors hover:border-gray-400 hover:bg-gray-50 active:cursor-grabbing"
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">Component Section</span>
      <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
    </button>
  );
}

function DraggableFieldChip({
  field,
  isPlaced,
}: {
  field: FieldDef;
  isPlaced: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-field-${field.apiName}${isPlaced ? `-${Date.now()}` : ''}`,
    data: {
      type: 'palette-field',
      fieldApiName: field.apiName,
      label: field.label,
    },
  });

  const style: CSSProperties = {
    opacity: isDragging ? 0 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'flex w-full items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left text-xs transition-colors',
        'hover:bg-gray-50 active:cursor-grabbing',
      )}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium text-gray-700">{field.label}</span>
      <span
        className="shrink-0 rounded-full bg-brand-navy/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-navy"
        title={`Field type: ${getFieldTypeLabel(field.type)}`}
      >
        {getFieldTypeLabel(field.type)}
      </span>
      {isPlaced ? (
        <span className="text-[10px] text-gray-400" aria-label="Field already placed">✓</span>
      ) : null}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PaletteFields({ availableFields }: PaletteFieldsProps) {
  const [search, setSearch] = useState('');
  const layout = useEditorStore((s) => s.layout);

  // Derive drag-active state directly from the DnD context so it can't drift
  // out of sync with dnd-kit's actual lifecycle (e.g. if a callback misses a fire).
  const { active } = useDndContext();
  const isDraggingExistingField =
    (active?.data.current as { type?: unknown } | undefined)?.type === 'field';

  // Remove-field drop zone — covers the entire sidebar, but disabled unless an existing
  // canvas field is being dragged (prevents accidental removes from palette-field drags).
  const { setNodeRef: setPaletteDropRef, isOver: isPaletteOver } = useDroppable({
    id: 'palette-field-remove',
    data: { type: 'palette-remove' },
    disabled: !isDraggingExistingField,
  });

  const placedApiNames = useMemo(() => {
    const set = new Set<string>();
    for (const tab of layout.tabs) {
      for (const region of (tab as any).regions) {
        for (const panel of region.panels) {
          for (const field of panel.fields) {
            set.add(field.fieldApiName);
          }
        }
      }
    }
    return set;
  }, [layout]);

  const filteredFields = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return availableFields;
    return availableFields.filter((field) => {
      return (
        field.label.toLowerCase().includes(query) ||
        field.apiName.toLowerCase().includes(query)
      );
    });
  }, [availableFields, search]);

  return (
    <div
      ref={setPaletteDropRef}
      className={cn(
        'flex h-full min-h-0 flex-col gap-3 p-2 transition-colors',
        isDraggingExistingField && isPaletteOver && 'bg-red-50/60',
      )}
    >
      {/* Remove hint — visible while dragging an existing canvas field; whole sidebar is the drop target */}
      {isDraggingExistingField && (
        <div
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-lg border-2 border-dashed py-3 text-xs font-medium transition-colors',
            isPaletteOver
              ? 'border-red-400 bg-red-50 text-red-600'
              : 'border-gray-300 bg-gray-50/60 text-gray-400',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Drop anywhere here to remove
        </div>
      )}

      {/* Search — filters fields only, not section tiles */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search fields"
          placeholder="Search fields"
          className="h-8 border-gray-200 pl-7 text-xs"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* Field Section tiles — always visible, not filtered by search */}
        <section className="space-y-1.5">
          <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Field Sections
          </div>
          <div className="space-y-1">
            {FIELD_SECTION_TILES.map((tile) => (
              <DraggableFieldSectionTile key={tile.columns} columns={tile.columns} label={tile.label} />
            ))}
          </div>
        </section>

        {/* Component Section tile */}
        <section className="space-y-1.5">
          <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Component Sections
          </div>
          <div className="space-y-1">
            <ComponentSectionTile />
          </div>
        </section>

        {/* Divider */}
        <div className="border-t border-gray-200" />

        {/* Connection synthetic fields (drop into a Field Section like a regular field) */}
        <section className="space-y-1.5">
          <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Connection Fields
          </div>
          <div className="space-y-1">
            <TeamMemberSlotTile />
          </div>
        </section>

        {/* Flat fields list */}
        <section className="space-y-1.5">
          <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Fields
          </div>
          <div className="space-y-1">
            {filteredFields.length > 0 ? (
              filteredFields.map((field) => (
                <DraggableFieldChip
                  key={field.apiName}
                  field={field}
                  isPlaced={placedApiNames.has(field.apiName)}
                />
              ))
            ) : (
              <div className="rounded-md border border-dashed border-gray-200 px-2 py-2 text-xs text-gray-500">
                No fields match
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
