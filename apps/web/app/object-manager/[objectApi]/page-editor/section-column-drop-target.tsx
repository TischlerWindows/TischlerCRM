'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

/**
 * One droppable per column. Must be a child component so `useDroppable` is not
 * called in a loop (Rules of Hooks).
 */
export function SectionColumnDropTarget({
  sectionId,
  columnIndex,
  children,
}: {
  sectionId: string;
  columnIndex: number;
  children: (args: {
    setNodeRef: (node: HTMLElement | null) => void;
    isOver: boolean;
  }) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${sectionId}-col-${columnIndex}`,
    data: { sectionId, columnIndex },
  });

  return <>{children({ setNodeRef, isOver })}</>;
}
