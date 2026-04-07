import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'activity-feed',
  name: 'Activity Feed',
  description: 'Timeline of record activity and comments',
  icon: 'Activity',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [
    { key: 'maxItems', type: 'number', label: 'Max Items', default: 20, min: 1, max: 100 },
    { key: 'showAvatars', type: 'boolean', label: 'Show Avatars', default: true },
  ],
}
