import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'time-entries',
  name: 'Time Entries',
  description: 'Track hours per technician for a work order',
  icon: 'Clock',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
