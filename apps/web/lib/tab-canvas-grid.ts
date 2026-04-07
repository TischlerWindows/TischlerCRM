import type { CSSProperties } from 'react';

/**
 * Tab-level 12-column canvas for page layouts.
 *
 * - New layouts persist `gridColumn`, `gridColumnSpan`, `gridRow`, `gridRowSpan` on
 *   sections and on tab-level widgets (`PageWidget` entries under `PageTab.widgets`).
 * - Legacy layouts used only `layoutRowId` + `rowWeight` + flex at runtime; we infer
 *   grid coordinates on load and when rendering if explicit grid is incomplete.
 */

import type { PageSection, PageWidget } from '@/lib/schema';
import { groupSectionsIntoRows } from '@/lib/group-section-rows';

export const TAB_GRID_COLUMNS = 12;

export type TabCanvasItem =
  | { kind: 'section'; section: PageSection }
  | { kind: 'widget'; widget: PageWidget };

function sectionGridComplete(s: PageSection): boolean {
  return (
    s.gridColumn != null &&
    s.gridColumnSpan != null &&
    s.gridRow != null &&
    s.gridRowSpan != null
  );
}

function widgetGridComplete(w: PageWidget): boolean {
  return (
    w.gridColumn != null &&
    w.gridColumnSpan != null &&
    w.gridRow != null &&
    w.gridRowSpan != null
  );
}

/** Allocate N column spans that sum to TAB_GRID_COLUMNS using integer weights. */
export function allocateColumnSpans(weightPerSection: number[]): number[] {
  if (weightPerSection.length === 0) return [];
  const sum = weightPerSection.reduce((a, b) => a + b, 0);
  const spans = weightPerSection.map((w) => Math.max(1, Math.floor((TAB_GRID_COLUMNS * w) / sum)));
  let total = spans.reduce((a, b) => a + b, 0);
  let i = 0;
  while (total < TAB_GRID_COLUMNS && spans.length) {
    spans[i % spans.length] += 1;
    total += 1;
    i += 1;
  }
  while (total > TAB_GRID_COLUMNS && spans.length) {
    const idx = spans.findIndex((s) => s > 1);
    if (idx < 0) break;
    spans[idx] -= 1;
    total -= 1;
  }
  return spans;
}

/**
 * Infer grid coordinates from legacy `layoutRowId` / `rowWeight` (and order).
 * Mutates section objects in place (used during loadLayout on fresh objects).
 */
export function inferLegacyGridForSections(sections: PageSection[]): void {
  const sorted = [...sections].sort((a, b) => a.order - b.order);
  const rows = groupSectionsIntoRows(sorted);
  let rowNum = 1;
  for (const row of rows) {
    const weights = row.map((s) => s.rowWeight ?? 1);
    const spans = allocateColumnSpans(weights);
    let col = 1;
    row.forEach((s, i) => {
      (s as PageSection).gridRow = rowNum;
      (s as PageSection).gridColumn = col;
      (s as PageSection).gridColumnSpan = spans[i] ?? 1;
      (s as PageSection).gridRowSpan = 1;
      col += spans[i] ?? 1;
    });
    rowNum += 1;
  }
}

/**
 * Stack tab-level widgets full-width on rows below sections.
 * Mutates widget objects in place.
 */
export function inferLegacyGridForTabWidgets(
  widgets: PageWidget[],
  maxSectionRowEnd: number,
): void {
  let row = maxSectionRowEnd + 1;
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  for (const w of sorted) {
    (w as PageWidget).gridRow = row;
    (w as PageWidget).gridColumn = 1;
    (w as PageWidget).gridColumnSpan = TAB_GRID_COLUMNS;
    (w as PageWidget).gridRowSpan = 1;
    row += 1;
  }
}

function maxSectionRowEnd(sections: PageSection[]): number {
  let m = 0;
  for (const s of sections) {
    const end = (s.gridRow ?? 1) + (s.gridRowSpan ?? 1) - 1;
    if (end > m) m = end;
  }
  return m;
}

/**
 * Ensure all sections and tab widgets for a tab have grid coordinates.
 * Mutates canvas-style objects (loadLayout / preset application).
 */
export function normalizeCanvasTabGrids<
  S extends {
    tabId: string;
    order: number;
    layoutRowId?: string;
    rowWeight?: number;
    gridColumn?: number;
    gridColumnSpan?: number;
    gridRow?: number;
    gridRowSpan?: number;
  },
  W extends {
    tabId: string;
    sectionId: string;
    order: number;
    gridColumn?: number;
    gridColumnSpan?: number;
    gridRow?: number;
    gridRowSpan?: number;
  },
>(sections: S[], widgets: W[], tabId: string): void {
  const tabSecs = sections.filter((s) => s.tabId === tabId).sort((a, b) => a.order - b.order);
  const needSectionInfer = tabSecs.some(
    (s) => s.gridColumn == null || s.gridColumnSpan == null || s.gridRow == null,
  );
  if (needSectionInfer && tabSecs.length) {
    inferLegacyGridForSections(tabSecs as unknown as PageSection[]);
  }
  const tabWidgets = widgets.filter((w) => w.tabId === tabId && !w.sectionId).sort((a, b) => a.order - b.order);
  const needWidgetInfer = tabWidgets.some((w) => w.gridColumn == null || w.gridColumnSpan == null);
  if (needWidgetInfer && tabWidgets.length) {
    const maxEnd = maxSectionRowEnd(tabSecs as unknown as PageSection[]);
    inferLegacyGridForTabWidgets(tabWidgets as unknown as PageWidget[], maxEnd);
  }
}

/** Sorted placements for runtime (read-only PageTab). */
export function resolveTabCanvasItems(tab: {
  sections: PageSection[];
  widgets?: PageWidget[];
}): TabCanvasItem[] {
  const sections = [...tab.sections].sort((a, b) => a.order - b.order);
  const widgets = [...(tab.widgets || [])].sort((a, b) => a.order - b.order);

  const secComplete = sections.length === 0 || sections.every(sectionGridComplete);
  const widComplete = widgets.length === 0 || widgets.every(widgetGridComplete);

  let workSecs = sections.map((s) => ({ ...s }));
  let workWids = widgets.map((w) => ({ ...w }));

  if (!secComplete || !widComplete) {
    inferLegacyGridForSections(workSecs);
    const maxEnd = maxSectionRowEnd(workSecs);
    inferLegacyGridForTabWidgets(workWids, maxEnd);
  }

  const items: TabCanvasItem[] = [
    ...workSecs.map((section) => ({ kind: 'section' as const, section })),
    ...workWids.map((widget) => ({ kind: 'widget' as const, widget })),
  ];

  items.sort((a, b) => {
    const ar =
      a.kind === 'section'
        ? (a.section.gridRow ?? 1)
        : (a.widget.gridRow ?? 1);
    const br =
      b.kind === 'section'
        ? (b.section.gridRow ?? 1)
        : (b.widget.gridRow ?? 1);
    if (ar !== br) return ar - br;
    const ac =
      a.kind === 'section'
        ? (a.section.gridColumn ?? 1)
        : (a.widget.gridColumn ?? 1);
    const bc =
      b.kind === 'section'
        ? (b.section.gridColumn ?? 1)
        : (b.widget.gridColumn ?? 1);
    return ac - bc;
  });

  return items;
}

export function gridItemStyle(grid: {
  gridColumn: number;
  gridColumnSpan: number;
  gridRow: number;
  gridRowSpan: number;
}): CSSProperties {
  return {
    gridColumn: `${grid.gridColumn} / span ${grid.gridColumnSpan}`,
    gridRow: `${grid.gridRow} / span ${grid.gridRowSpan}`,
  };
}
