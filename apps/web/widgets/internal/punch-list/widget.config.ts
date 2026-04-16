import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'punch-list',
  name: 'Punch List',
  description: 'Manage punch list items for a work order with PDF printing',
  icon: 'ClipboardList',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
