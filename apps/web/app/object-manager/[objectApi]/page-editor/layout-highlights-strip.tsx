'use client';

import React, { useMemo, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { FieldDef } from '@/lib/schema';
import { useEditorStore } from './editor-store';
import { X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LayoutHighlightsStrip({
  objectFields,
}: {
  objectFields: FieldDef[];
}) {
  const highlightFields = useEditorStore((s) => s.highlightFields);
  const removeHighlightField = useEditorStore((s) => s.removeHighlightField);
  const addHighlightField = useEditorStore((s) => s.addHighlightField);
  const [picker, setPicker] = useState('');

  const { setNodeRef, isOver } = useDroppable({
    id: 'layout-highlight-drop',
    data: { kind: 'highlights' },
  });

  const getLabel = (api: string) => objectFields.find((f) => f.apiName === api)?.label ?? api;

  const pickOptions = useMemo(() => {
    return objectFields
      .filter((f) => !highlightFields.includes(f.apiName))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [objectFields, highlightFields]);

  return (
    <div
      ref={setNodeRef}
      data-layout-highlight-drop
      className={`mb-5 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${
        isOver ? 'border-teal-400 bg-teal-50/80' : 'border-gray-200 bg-white/90'
      }`}
    >
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Record highlights</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Up to 6 fields shown at the top of the record page. Drag from the field list or add below.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 min-w-0">
          <label
            className="mb-1 block text-xs font-medium text-gray-600"
            htmlFor="highlight-field-picker"
          >
            Add a field
          </label>
          <select
            id="highlight-field-picker"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-sm"
            value={picker}
            onChange={(e) => setPicker(e.target.value)}
          >
            <option value="">Choose a field…</option>
            {pickOptions.map((f) => (
              <option key={f.apiName} value={f.apiName}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 sm:mb-0.5"
          disabled={!picker || highlightFields.length >= 6}
          onClick={() => {
            if (!picker) return;
            addHighlightField(picker);
            setPicker('');
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add to highlights
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
        {highlightFields.length === 0 ? (
          <p className="text-xs text-gray-500 w-full">
            No highlights yet — they appear as pills here when you add them.
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
                title={`Remove ${getLabel(api)} from highlights`}
                aria-label={`Remove ${getLabel(api)} from highlights`}
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
