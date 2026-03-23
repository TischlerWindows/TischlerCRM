'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { FieldDef } from '@/lib/schema';
import { useEditorStore } from './editor-store';
import { X } from 'lucide-react';

export function LayoutHighlightsStrip({
  objectFields,
}: {
  objectFields: FieldDef[];
}) {
  const highlightFields = useEditorStore((s) => s.highlightFields);
  const removeHighlightField = useEditorStore((s) => s.removeHighlightField);

  const { setNodeRef, isOver } = useDroppable({
    id: 'layout-highlight-drop',
    data: { kind: 'highlights' },
  });

  const getLabel = (api: string) => objectFields.find((f) => f.apiName === api)?.label ?? api;

  return (
    <div
      ref={setNodeRef}
      className={`mb-5 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
        isOver ? 'border-teal-400 bg-teal-50/80' : 'border-gray-200 bg-white/90'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 w-full sm:w-auto sm:mr-2">
          Highlights
        </span>
        <span className="text-xs text-gray-400 hidden sm:inline">
          Drag fields here (max 6) — shown on record header
        </span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {highlightFields.length === 0 ? (
          <p className="text-xs text-gray-400 py-1">
            Drop field cards from the palette to pin key values at the top of the record page.
          </p>
        ) : (
          highlightFields.map((api) => (
            <span
              key={api}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-brand-navy/10 text-brand-navy text-xs font-medium border border-brand-navy/20"
            >
              {getLabel(api)}
              <button
                type="button"
                className="p-0.5 rounded-full hover:bg-brand-navy/20 text-brand-navy"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  removeHighlightField(api);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
