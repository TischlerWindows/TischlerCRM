/**
 * Re-export shim — the DnD logic has been decomposed into modules under ./dnd/.
 * This file exists so that existing imports of `./dnd-context-wrapper` continue to work.
 */
export { DndContextWrapper } from './dnd';
export type { DragSource, DropTarget } from './dnd';
