import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'installation-cost-grid',
  name: 'Installation Cost Grid',
  description: 'View and edit weekly installation costs and technician labor expenses',
  icon: 'Table',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
