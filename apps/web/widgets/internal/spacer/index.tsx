'use client'

import type { WidgetProps } from '@/lib/widgets/types'

/**
 * Same visual as the Spacer branch in `components/layout-widgets-inline.tsx`
 * (minHeightPx there maps to manifest `height` here).
 */
export default function SpacerWidget({ config }: WidgetProps) {
  const height =
    typeof config.height === 'number' && Number.isFinite(config.height) ? config.height : 32
  return (
    <div
      className="rounded-md border border-dashed border-gray-300 bg-gray-50/80 text-xs text-gray-400 flex items-center justify-center"
      style={{ minHeight: height }}
      aria-hidden
    >
      Spacer
    </div>
  )
}
