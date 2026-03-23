'use client';

import React, { createContext, useContext } from 'react';

export type EditorDragUiState = {
  overId: string | null;
  dropSide: 'top' | 'bottom' | null;
};

const defaultState: EditorDragUiState = { overId: null, dropSide: null };

export const EditorDragUiContext = createContext<EditorDragUiState>(defaultState);

export function useEditorDragUi() {
  return useContext(EditorDragUiContext);
}
