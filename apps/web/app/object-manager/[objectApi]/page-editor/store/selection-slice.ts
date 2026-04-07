import type { StateCreator } from 'zustand';
import type { SelectedElement } from '../types';

// ── Selection slice interface ────────────────────────────────────────────────

export interface SelectionSlice {
  selectedElement: SelectedElement;

  setSelectedElement: (el: SelectedElement) => void;
}

// ── Selection slice creator ──────────────────────────────────────────────────

export const createSelectionSlice: StateCreator<
  SelectionSlice,
  [],
  [],
  SelectionSlice
> = (set) => ({
  selectedElement: null,

  setSelectedElement: (el) => set({ selectedElement: el }),
});
