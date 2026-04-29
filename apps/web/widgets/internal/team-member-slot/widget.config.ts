import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'team-member-slot',
  name: 'Connection Slot',
  description: 'A pinned single-slot connection field (one role or flag) — feels like a basic lookup.',
  icon: 'UserCheck',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'column',
  configSchema: [],
}
