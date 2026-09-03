import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'clock-in',
  name: 'Clock In',
  description: 'Clock in/out on this record with a geo- and time-stamped log',
  icon: 'Clock',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'column',
  configSchema: [],
}
