'use client';

import type { PageWidget } from '@/lib/schema';

/**
 * Renders tab-level or section-level layout widgets on record detail and forms.
 * Full widget implementations can replace placeholders over time.
 */
export function LayoutWidgetsInline({ widgets }: { widgets?: PageWidget[] }) {
  if (!widgets?.length) return null;
  const sorted = [...widgets].sort((a, b) => a.order - b.order);
  return (
    <div className="mb-4 flex flex-col gap-3">
      {sorted.map((w) =>
        w.widgetType === 'Spacer' && w.config?.type === 'Spacer' ? (
          <div
            key={w.id}
            className="rounded-md border border-dashed border-gray-300 bg-gray-50/80 text-xs text-gray-400 flex items-center justify-center"
            style={{ minHeight: w.config.minHeightPx ?? 32 }}
            aria-hidden
          >
            Spacer
          </div>
        ) : (
          <div
            key={w.id}
            className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900"
          >
            <span className="font-medium">Widget:</span> {w.widgetType}
            {w.config && 'label' in w.config && (w.config as { label?: string }).label
              ? ` — ${(w.config as { label?: string }).label}`
              : null}
          </div>
        ),
      )}
    </div>
  );
}
