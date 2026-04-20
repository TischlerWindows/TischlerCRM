import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'time-entries',
  name: 'Time Entries',
  description: 'Hours logged against this work order (scoped per user for techs)',
  icon: 'Clock',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
