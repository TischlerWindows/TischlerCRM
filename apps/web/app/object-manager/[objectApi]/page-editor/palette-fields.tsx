'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { FieldDef } from '@/lib/schema';
import { useEditorStore } from './editor-store';

export interface PaletteFieldsProps {
  availableFields: FieldDef[];
}

type ChipTone = 'standard' | 'custom';

function DraggableFieldChip({
  field,
  tone,
  isPlaced,
}: {
  field: FieldDef;
  tone: ChipTone;
  isPlaced: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `field-${field.apiName}`,
    data: {
      type: 'palette-field',
      fieldApiName: field.apiName,
      label: field.label,
    },
  });

  const style: CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.55 : 1,
  };

  const toneClass =
    tone === 'custom'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
      : 'border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100';

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...listeners}
      {...attributes}
      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-xs transition-colors active:cursor-grabbing ${toneClass}`}
    >
      <span className="select-none text-gray-400" aria-hidden>
        ⠿
      </span>
      <span className="min-w-0 flex-1 truncate font-medium">{field.label}</span>
      {isPlaced ? (
        <span className="text-[10px] text-gray-400" aria-label="Field already placed">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function FieldGroup({
  title,
  tone,
  fields,
  placedApiNames,
}: {
  title: string;
  tone: ChipTone;
  fields: FieldDef[];
  placedApiNames: ReadonlySet<string>;
}) {
  return (
    <section className="space-y-1.5">
      <div className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="space-y-1">
        {fields.length > 0 ? (
          fields.map((field) => (
            <DraggableFieldChip
              key={field.apiName}
              field={field}
              tone={tone}
              isPlaced={placedApiNames.has(field.apiName)}
            />
          ))
        ) : (
          <div className="rounded-md border border-dashed border-gray-200 px-2 py-2 text-xs text-gray-500">
            No fields
          </div>
        )}
      </div>
    </section>
  );
}

export function PaletteFields({ availableFields }: PaletteFieldsProps) {
  const [search, setSearch] = useState('');
  const layout = useEditorStore((s) => s.layout);

  const placedApiNames = useMemo(() => {
    const set = new Set<string>();
    for (const tab of layout.tabs) {
      for (const region of tab.regions) {
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
      const label = field.label.toLowerCase();
      const apiName = field.apiName.toLowerCase();
      return label.includes(query) || apiName.includes(query);
    });
  }, [availableFields, search]);

  const standardFields = useMemo(
    () => filteredFields.filter((field) => !field.custom),
    [filteredFields],
  );
  const customFields = useMemo(
    () => filteredFields.filter((field) => Boolean(field.custom)),
    [filteredFields],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-2">
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
        <FieldGroup
          title="Standard Fields"
          tone="standard"
          fields={standardFields}
          placedApiNames={placedApiNames}
        />
        <FieldGroup
          title="Custom Fields"
          tone="custom"
          fields={customFields}
          placedApiNames={placedApiNames}
        />
      </div>
    </div>
  );
}
