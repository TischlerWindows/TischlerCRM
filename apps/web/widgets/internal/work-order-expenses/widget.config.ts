import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'work-order-expenses',
  name: 'Work Order Expenses',
  description: 'Track expenses for a work order',
  icon: 'Receipt',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
