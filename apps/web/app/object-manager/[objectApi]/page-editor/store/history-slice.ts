import type { StateCreator } from 'zustand';
import type { PageLayout } from '../types';
import type { LayoutSlice } from './layout-slice';
import type { SelectionSlice } from './selection-slice';

// ── History slice interface ──────────────────────────────────────────────────

export interface HistorySlice {
  undoStack: PageLayout[];
  redoStack: PageLayout[];

  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
}

// ── Selectors ───────────────────────────────────────────────────────────────

/** Number of available undo snapshots (0–30). */
export const selectUndoCount = (state: HistorySlice): number => state.undoStack.length;

/** Number of available redo snapshots. */
export const selectRedoCount = (state: HistorySlice): number => state.redoStack.length;

// ── History slice creator ────────────────────────────────────────────────────

export const createHistorySlice: StateCreator<
  HistorySlice & LayoutSlice & SelectionSlice,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  undoStack: [],
  redoStack: [],

  pushUndo: () => {
    const { layout, undoStack } = get();
    const snapshot = structuredClone(layout);
    set({
      undoStack: [...undoStack, snapshot].slice(-30),
      redoStack: [],
      isDirty: true,
    });
  },

  undo: () => {
    const { undoStack, redoStack, layout } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      layout: prev,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, structuredClone(layout)],
      isDirty: true,
    });
  },

  redo: () => {
    const { undoStack, redoStack, layout } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      layout: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, structuredClone(layout)].slice(-30),
      isDirty: true,
    });
  },
});
