'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ObjectDef, PageLayout } from '@/lib/schema';
import { getFormattingEffectsForTab } from '@/lib/layout-formatting';
import { collectDefaultCollapsedWidgetIds } from '@/lib/widget-collapse-defaults';
import { RecordTabRenderer } from './record-tab-renderer';

export interface PreviewDetailViewProps {
  layout: PageLayout;
  record: Record<string, any> | null;
  objectDef: ObjectDef | undefined;
}

/**
 * Lightweight view-mode renderer for the page-editor preview modal.
 *
 * Owns only the state `RecordTabRenderer` requires. Intentionally does NOT
 * pull in the orchestration from `record-detail-page.tsx` (edit/delete
 * buttons, breadcrumbs, routing) — this is a read-only preview.
 */
export function PreviewDetailView({ layout, record, objectDef }: PreviewDetailViewProps) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [sectionToggles, setSectionToggles] = useState<Record<string, boolean>>({});
  const [collapsedPanelIds, setCollapsedPanelIds] = useState<Set<string>>(new Set());
  const [collapsedWidgetIds, setCollapsedWidgetIds] = useState<Set<string>>(
    () => collectDefaultCollapsedWidgetIds(layout),
  );

  const togglePanelCollapse = (panelId: string) => {
    setCollapsedPanelIds((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) next.delete(panelId);
      else next.add(panelId);
      return next;
    });
  };

  const toggleWidgetCollapse = (widgetId: string) => {
    setCollapsedWidgetIds((prev) => {
      const next = new Set(prev);
      if (next.has(widgetId)) next.delete(widgetId);
      else next.add(widgetId);
      return next;
    });
  };

  useEffect(() => {
    setCollapsedWidgetIds(collectDefaultCollapsedWidgetIds(layout));
  }, [layout]);

  const visibleTabs = useMemo(() => {
    return [...layout.tabs]
      .filter((tab: any) => {
        // Detail page is "view" mode — check hideOnView (with legacy hideOnExisting fallback)
        if (tab.hideOnView || tab.hideOnExisting) return false;
        const tabFx = getFormattingEffectsForTab(layout, tab.id, record as any);
        if (tabFx?.hidden) return false;
        return true;
      })
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  }, [layout, record]);

  if (!layout) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
        No page layout configured.
      </div>
    );
  }

  if (visibleTabs.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-500">
        All tabs are hidden on View mode. Uncheck &quot;Hide on View&quot; on at least one tab to preview.
      </div>
    );
  }

  const activeTab = visibleTabs[Math.min(activeTabIdx, visibleTabs.length - 1)];

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
      {visibleTabs.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {visibleTabs.map((tab: any, idx: number) => (
            <button
              key={tab.id ?? idx}
              type="button"
              onClick={() => setActiveTabIdx(idx)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTabIdx === idx
                  ? 'border-brand-navy bg-brand-navy text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label || `Tab ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Active tab content */}
      <RecordTabRenderer
        tab={activeTab}
        tabIndex={activeTabIdx}
        pageLayout={layout}
        record={record ?? null}
        objectDef={objectDef}
        formulaValues={{}}
        isLookupLoaded={true}
        sectionToggles={sectionToggles}
        setSectionToggles={setSectionToggles}
        collapsedPanelIds={collapsedPanelIds}
        togglePanelCollapse={togglePanelCollapse}
        collapsedWidgetIds={collapsedWidgetIds}
        toggleWidgetCollapse={toggleWidgetCollapse}
      />
    </div>
  );
}
