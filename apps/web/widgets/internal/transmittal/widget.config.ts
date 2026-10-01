import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'transmittal',
  name: 'Transmittal',
  description: 'Prepare a paint sample transmittal and preview its PDF on a Project.',
  icon: 'Send',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}