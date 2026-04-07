'use client'

import type { WidgetProps } from '@/lib/widgets/types'

/**
 * HeaderHighlights config is consumed by `record-detail-page.tsx` which renders
 * the header card directly. This widget returns null to avoid duplicate rendering
 * when `LayoutWidgetsInline` encounters it in the region widget list.
 */
export default function HeaderHighlightsWidget(_props: WidgetProps) {
  return null
}
