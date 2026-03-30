'use client'

import type { WidgetProps } from '@/lib/widgets/types'

/**
 * Mirrors the non-Spacer branch in `LayoutWidgetsInline` until dedicated
 * header highlights rendering is wired through this entry point.
 */
export default function HeaderHighlightsWidget({ config, record }: WidgetProps) {
  return (
    <div className="p-3 rounded-lg border border-dashed border-blue-200 bg-blue-50/50 text-sm text-blue-900">
      <span className="font-medium">Widget:</span> HeaderHighlights
      {config.fields != null ? ` — fields configured` : null}
      <span className="block text-xs text-blue-800/80 mt-1">Record: {String(record.id)}</span>
    </div>
  )
}
