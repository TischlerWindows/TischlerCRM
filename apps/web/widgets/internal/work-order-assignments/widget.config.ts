import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'work-order-assignments',
  name: 'Work Order Assignments',
  description: 'Technicians assigned to this work order',
  icon: 'Users',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
