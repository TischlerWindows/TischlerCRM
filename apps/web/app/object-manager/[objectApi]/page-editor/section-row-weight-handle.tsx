'use client';

import React, { useCallback, useRef } from 'react';
import { useEditorStore } from './editor-store';
import { GripVertical } from 'lucide-react';

const MOVE_PX = 28;

/**
 * Drag horizontally to change the shared border between two sections on the same grid row (12-col canvas).
 */
export function SectionRowWeightHandle({
  leftSectionId,
  rightSectionId,
}: {
  leftSectionId: string;
  rightSectionId: string;
}) {
  const adjustAdjacentGridSpans = useEditorStore((s) => s.adjustAdjacentGridSpans);
  const pushUndo = useEditorStore((s) => s.pushUndo);
  const accRef = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      pushUndo();
      accRef.current = 0;
      const onMove = (ev: MouseEvent) => {
        accRef.current += ev.movementX;
        while (accRef.current >= MOVE_PX) {
          adjustAdjacentGridSpans(leftSectionId, rightSectionId, 1);
          accRef.current -= MOVE_PX;
        }
        while (accRef.current <= -MOVE_PX) {
          adjustAdjacentGridSpans(leftSectionId, rightSectionId, -1);
          accRef.current += MOVE_PX;
        }
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        accRef.current = 0;
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [adjustAdjacentGridSpans, pushUndo, leftSectionId, rightSectionId],
  );

  return (
    <button
      type="button"
      title="Drag left or right to change how much space each section uses"
      aria-label="Resize width between these two sections"
      onMouseDown={onMouseDown}
      className="flex h-full min-h-[100px] w-6 shrink-0 cursor-col-resize flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-gray-500 hover:border-brand-navy/35 hover:bg-brand-navy/[0.06] hover:text-brand-navy"
    >
      <GripVertical className="h-5 w-5" aria-hidden />
    </button>
  );
}
