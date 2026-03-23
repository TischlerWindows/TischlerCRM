'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useEditorStore } from './editor-store';
import { Sparkles } from 'lucide-react';

export const RECORD_HEADER_DROP_ID = 'record-header-drop';

export function RecordHeaderChrome({ objectLabel }: { objectLabel?: string }) {
  const highlightFields = useEditorStore((s) => s.highlightFields);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const selectedElement = useEditorStore((s) => s.selectedElement);

  const { setNodeRef, isOver } = useDroppable({
    id: RECORD_HEADER_DROP_ID,
    data: { kind: 'highlights' },
  });

  const selected = selectedElement?.type === 'highlights';

  return (
    <button
      type="button"
      ref={setNodeRef}
      data-record-header-chrome
      onClick={() => setSelectedElement({ type: 'highlights' })}
      className={`mb-4 w-full rounded-lg border-2 border-dashed px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-brand-navy bg-brand-navy/5'
          : isOver
            ? 'border-teal-400 bg-teal-50/80'
            : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <Sparkles className="h-4 w-4 text-amber-500 shrink-0" aria-hidden />
        Record header highlights
      </div>
      <p className="text-xs text-gray-500 mt-1">
        Click to edit in Properties, or drag fields here from the list. Shown under the record title
        {objectLabel ? ` for ${objectLabel}` : ''}.
      </p>
      {highlightFields.length > 0 ? (
        <p className="text-xs text-gray-600 mt-2">
          {highlightFields.length} field{highlightFields.length !== 1 ? 's' : ''} selected
        </p>
      ) : (
        <p className="text-xs text-gray-400 mt-2">None yet</p>
      )}
    </button>
  );
}
