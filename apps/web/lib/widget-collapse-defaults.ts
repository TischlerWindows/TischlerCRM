import type { PageLayout } from './schema';

/**
 * Walk a page layout and return the IDs of widgets configured with
 * `collapsedAsDefault === true`. Covers widgets at both region level and
 * panel level (panels can nest widgets in the new layout model).
 */
export function collectDefaultCollapsedWidgetIds(
  layout: PageLayout | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!layout?.tabs) return ids;
  for (const tab of layout.tabs) {
    for (const region of tab.regions ?? []) {
      for (const w of region.widgets ?? []) {
        if (w.collapsedAsDefault) ids.add(w.id);
      }
      for (const panel of region.panels ?? []) {
        for (const w of panel.widgets ?? []) {
          if (w.collapsedAsDefault) ids.add(w.id);
        }
      }
    }
  }
  return ids;
}
