/**
 * Re-export shim — the store has been decomposed into slices under ./store/.
 * This file exists so that existing imports of `./editor-store` continue to work.
 */
export { useEditorStore } from './store/editor-store';
export type { EditorState } from './store/editor-store';
