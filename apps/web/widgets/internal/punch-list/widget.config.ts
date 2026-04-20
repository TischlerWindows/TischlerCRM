import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'punch-list',
  name: 'Punch List',
  description: 'Work items for this work order with inline status + PDF print',
  icon: 'ListChecks',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
