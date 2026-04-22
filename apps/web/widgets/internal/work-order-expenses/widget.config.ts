import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'work-order-expenses',
  name: 'Work Order Expenses',
  description: 'Expenses logged against this work order (scoped per user for techs)',
  icon: 'Receipt',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
