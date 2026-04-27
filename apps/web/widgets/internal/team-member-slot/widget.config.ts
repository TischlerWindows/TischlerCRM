import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'team-member-slot',
  name: 'Team Member Slot',
  description: 'Compact, configurable single-slot team-member field (one role or flag) — feels like a basic lookup.',
  icon: 'UserCheck',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'column',
  configSchema: [],
}
