import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'team-members-rollup',
  name: 'Connections',
  description: 'All people and organizations connected to this record (and its child records)',
  icon: 'Users',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
