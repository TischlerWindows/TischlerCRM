'use client'

import {
  getGridSelectionBounds,
  isInGridSelection,
  type GridSelection,
} from '@/lib/cad-index-grid'

export function GridRangeDecoration({
  row,
  column,
  selection,
  copiedSelection,
}: {
  row: number
  column: number
  selection: GridSelection | null
  copiedSelection: GridSelection | null
}) {
  const selectedBounds = selection ? getGridSelectionBounds(selection) : null
  const copiedBounds = copiedSelection ? getGridSelectionBounds(copiedSelection) : null
  const selected = !!selection && isInGridSelection(row, column, selection)
  const copied = !!copiedBounds && row >= copiedBounds.top && row <= copiedBounds.bottom
    && column >= copiedBounds.left && column <= copiedBounds.right

  return (
    <>
      {selected && selectedBounds?.top === row && <span aria-hidden="true" className="grid-range-edge grid-range-solid grid-range-top" />}
      {selected && selectedBounds?.bottom === row && <span aria-hidden="true" className="grid-range-edge grid-range-solid grid-range-bottom" />}
      {selected && selectedBounds?.left === column && <span aria-hidden="true" className="grid-range-edge grid-range-solid grid-range-left" />}
      {selected && selectedBounds?.right === column && <span aria-hidden="true" className="grid-range-edge grid-range-solid grid-range-right" />}
      {copied && copiedBounds?.top === row && <span aria-hidden="true" className="grid-range-edge grid-range-copy grid-range-top" />}
      {copied && copiedBounds?.bottom === row && <span aria-hidden="true" className="grid-range-edge grid-range-copy grid-range-bottom" />}
      {copied && copiedBounds?.left === column && <span aria-hidden="true" className="grid-range-edge grid-range-copy grid-range-left" />}
      {copied && copiedBounds?.right === column && <span aria-hidden="true" className="grid-range-edge grid-range-copy grid-range-right" />}
    </>
  )
}

export function GridRangeStyles() {
  return (
    <style jsx global>{`
      .grid-range-edge {
        position: absolute;
        z-index: 20;
        display: block;
        pointer-events: none;
      }
      [aria-selected="true"] input:not(:disabled) { background-color: #e2f0d9; }
      .grid-range-solid { background: #217346; }
      .grid-range-copy {
        background-image: repeating-linear-gradient(90deg, #fff 0 3px, #217346 3px 6px);
        background-size: 6px 2px;
        animation: grid-range-march 0.35s linear infinite;
      }
      .grid-range-top, .grid-range-bottom { left: 0; right: 0; height: 2px; }
      .grid-range-top { top: -1px; }
      .grid-range-bottom { bottom: -1px; }
      .grid-range-left, .grid-range-right { top: 0; bottom: 0; width: 2px; }
      .grid-range-left { left: -1px; }
      .grid-range-right { right: -1px; }
      .grid-range-solid.grid-range-top { border-top: 2px solid #217346; }
      .grid-range-solid.grid-range-bottom { border-bottom: 2px solid #217346; }
      .grid-range-solid.grid-range-left { border-left: 2px solid #217346; }
      .grid-range-solid.grid-range-right { border-right: 2px solid #217346; }
      .grid-range-copy.grid-range-left, .grid-range-copy.grid-range-right {
        background-image: repeating-linear-gradient(180deg, #fff 0 3px, #217346 3px 6px);
        background-size: 2px 6px;
      }
      .grid-range-copy.grid-range-top, .grid-range-copy.grid-range-bottom {
        background-image: repeating-linear-gradient(90deg, #fff 0 3px, #217346 3px 6px);
      }
      td[data-summary-grid-selected="true"] { background-color: #e2f0d9 !important; }
      td[data-summary-grid-top="true"] { border-top: 2px solid #217346 !important; }
      td[data-summary-grid-bottom="true"] { border-bottom: 2px solid #217346 !important; }
      td[data-summary-grid-left="true"] { border-left: 2px solid #217346 !important; }
      td[data-summary-grid-right="true"] { border-right: 2px solid #217346 !important; }
      td.summary-grid-copied { animation: summary-grid-march 0.35s linear infinite; }
      @keyframes summary-grid-march {
        to { background-position: 6px 0, -6px 100%, 0 6px, 100% -6px; }
      }
      @keyframes grid-range-march { to { background-position: 6px 0; } }
      @media (prefers-reduced-motion: reduce) {
        .grid-range-copy, td.summary-grid-copied { animation: none; }
      }
    `}</style>
  )
}