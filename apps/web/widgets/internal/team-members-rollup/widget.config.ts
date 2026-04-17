import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'team-members-rollup',
  name: 'Team Members',
  description: 'Consolidated view of contacts and accounts across related records',
  icon: 'Users',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
