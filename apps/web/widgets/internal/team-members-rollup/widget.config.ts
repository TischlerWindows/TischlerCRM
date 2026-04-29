import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'team-members-rollup',
  name: 'Connections (record-side)',
  description: 'Use on Property/Project/Opportunity/etc. detail pages — all people and organizations connected to THIS record, including those rolled up from child records',
  icon: 'Users',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
