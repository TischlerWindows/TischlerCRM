'use client'

import type { WidgetProps } from '@/lib/widgets/types'

export default function ActivityFeedWidget({ config, record }: WidgetProps) {
  const maxItems = typeof config.maxItems === 'number' ? config.maxItems : 20
  const showAvatars = config.showAvatars !== false
  return (
    <div className="text-xs text-brand-gray p-3">
      Activity Feed — {String(record.id)} (max {maxItems}
      {showAvatars ? ', avatars on' : ', avatars off'})
    </div>
  )
}
