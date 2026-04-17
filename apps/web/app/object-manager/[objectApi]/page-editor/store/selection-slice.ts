import type { StateCreator } from 'zustand';
import type { SelectedElement } from '../types';

// ── Selection slice interface ────────────────────────────────────────────────

export type PreviewMode = 'new' | 'view' | 'edit';

export interface SelectionSlice {
  selectedElement: SelectedElement;
  previewMode: PreviewMode;

  setSelectedElement: (el: SelectedElement) => void;
  setPreviewMode: (mode: PreviewMode) => void;
}

// ── Selection slice creator ──────────────────────────────────────────────────

export const createSelectionSlice: StateCreator<
  SelectionSlice,
  [],
  [],
  SelectionSlice
> = (set) => ({
  selectedElement: null,
  previewMode: 'view',

  setSelectedElement: (el) => set({ selectedElement: el }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
});
