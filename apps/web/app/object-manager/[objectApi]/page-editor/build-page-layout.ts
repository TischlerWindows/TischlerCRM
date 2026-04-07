import type { EditorState } from './editor-store';
import type { PageLayout } from './types';

function stripNullish(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    if (obj[key] === undefined || obj[key] === null) {
      delete obj[key];
    }
  }
}

/**
 * Minimal cleanup before saving — strips undefined/null style fields from a layout.
 * Returns a new PageLayout safe to pass to updateObject().
 */
export function buildPageLayout(layout: PageLayout): PageLayout {
  const clone = structuredClone(layout);
  for (const tab of clone.tabs) {
    for (const region of tab.regions) {
      if (region.style) stripNullish(region.style as Record<string, unknown>);
      for (const panel of region.panels) {
        if (panel.style) stripNullish(panel.style as Record<string, unknown>);
        for (const field of panel.fields) {
          if (field.labelStyle) stripNullish(field.labelStyle as Record<string, unknown>);
          if (field.valueStyle) stripNullish(field.valueStyle as Record<string, unknown>);
        }
      }
    }
  }
  return clone;
}

/**
 * Initializes editor state from a loaded PageLayout.
 * Returns only the fields needed to hydrate the store.
 */
export function initEditorFromLayout(
  layout: PageLayout,
): Pick<EditorState, 'layout' | 'isDirty' | 'selectedElement' | 'undoStack' | 'redoStack'> {
  return { layout, isDirty: false, selectedElement: null, undoStack: [], redoStack: [] };
}
