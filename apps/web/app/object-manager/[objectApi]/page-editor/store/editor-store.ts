import { create } from 'zustand';
import { createLayoutSlice, type LayoutSlice } from './layout-slice';
import { createSelectionSlice, type SelectionSlice } from './selection-slice';
import { createHistorySlice, type HistorySlice } from './history-slice';

// ── Combined state ───────────────────────────────────────────────────────────

export type EditorState = LayoutSlice & SelectionSlice & HistorySlice;

// ── Store ────────────────────────────────────────────────────────────────────

export const useEditorStore = create<EditorState>()((...a) => ({
  ...createLayoutSlice(...a),
  ...createSelectionSlice(...a),
  ...createHistorySlice(...a),
}));
