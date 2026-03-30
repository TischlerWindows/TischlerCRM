'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import type { PageWidget } from '@/lib/schema';
import type { WidgetProps } from '@/lib/widgets/types';
import { getWidgetById } from '@/lib/widgets/registry-loader';
import { externalWidgets } from '@/widgets/external/registry';

const ActivityFeedWidget = dynamic(() => import('@/widgets/internal/activity-feed/index'));
const HeaderHighlightsWidget = dynamic(() => import('@/widgets/internal/header-highlights/index'));
const FileFolderWidget = dynamic(() => import('@/widgets/internal/file-folder/index'));
const SpacerWidget = dynamic(() => import('@/widgets/internal/spacer/index'));

const EXTERNAL_WIDGET_COMPONENTS: Record<string, React.ComponentType<WidgetProps>> = {
  'demo-widget': dynamic(() => import('@/widgets/external/demo-widget/index')),
};

function WidgetDisabledPlaceholder({ widgetId }: { widgetId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
      Widget &ldquo;{widgetId}&rdquo; is not enabled for this organization.
    </div>
  );
}

function WidgetUnavailablePlaceholder({ widgetId }: { widgetId: string }) {
  return (
    <div className="rounded-lg border border-dashed border-red-100 bg-red-50/50 px-3 py-4 text-center text-xs text-red-400">
      Widget &ldquo;{widgetId}&rdquo; is unavailable.
    </div>
  );
}

function WidgetLoadingPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-xs text-gray-400 animate-pulse">
      Loading widget…
    </div>
  );
}

const STUB_RECORD: Record<string, unknown> = {};
const STUB_OBJECT = { apiName: '', label: '', fields: [] as Array<{ apiName: string; label: string; type: string }> };

interface LayoutWidgetsInlineProps {
  widgets?: PageWidget[];
  enabledIds?: string[];
}

/**
 * Renders tab-level or section-level layout widgets on record detail and forms.
 */
export function LayoutWidgetsInline({ widgets, enabledIds }: LayoutWidgetsInlineProps) {
  if (!widgets?.length) return null;

  const effectiveEnabledIds = enabledIds ?? externalWidgets.map((w) => w.id);
  const sorted = [...widgets].sort((a, b) => a.order - b.order);

  return (
    <div className="mb-4 flex flex-col gap-3">
      {sorted.map((w) => {
        const config = w.config;

        if (config.type === 'Spacer') {
          return <SpacerWidget key={w.id} config={{ height: config.minHeightPx ?? 32 }} record={STUB_RECORD} object={STUB_OBJECT} integration={null} displayMode="full" orgId="" />;
        }

        if (config.type === 'ActivityFeed') {
          return <ActivityFeedWidget key={w.id} config={config as unknown as Record<string, unknown>} record={STUB_RECORD} object={STUB_OBJECT} integration={null} displayMode="full" orgId="" />;
        }

        if (config.type === 'HeaderHighlights') {
          return <HeaderHighlightsWidget key={w.id} config={config as unknown as Record<string, unknown>} record={STUB_RECORD} object={STUB_OBJECT} integration={null} displayMode="full" orgId="" />;
        }

        if (config.type === 'FileFolder') {
          return <FileFolderWidget key={w.id} config={config as unknown as Record<string, unknown>} record={STUB_RECORD} object={STUB_OBJECT} integration={null} displayMode="full" orgId="" />;
        }

        if (config.type === 'ExternalWidget') {
          const { externalWidgetId, displayMode, config: widgetConfig } = config;
          const manifest = getWidgetById(externalWidgetId);

          if (!manifest) {
            return <WidgetUnavailablePlaceholder key={w.id} widgetId={externalWidgetId} />;
          }

          if (!effectiveEnabledIds.includes(externalWidgetId)) {
            return <WidgetDisabledPlaceholder key={w.id} widgetId={externalWidgetId} />;
          }

          const WidgetComponent = EXTERNAL_WIDGET_COMPONENTS[externalWidgetId];
          if (!WidgetComponent) {
            return <WidgetUnavailablePlaceholder key={w.id} widgetId={externalWidgetId} />;
          }

          return (
            <React.Suspense key={w.id} fallback={<WidgetLoadingPlaceholder />}>
              <WidgetComponent
                config={widgetConfig}
                record={STUB_RECORD}
                object={STUB_OBJECT}
                integration={null}
                displayMode={displayMode}
                orgId=""
              />
            </React.Suspense>
          );
        }

        // Fallback for RelatedList, CustomComponent, and any unhandled widget types
        return (
          <div
            key={w.id}
            className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900"
          >
            <span className="font-medium">Widget:</span> {w.widgetType}
            {config && 'label' in config && (config as { label?: string }).label
              ? ` — ${(config as { label?: string }).label}`
              : null}
          </div>
        );
      })}
    </div>
  );
}
