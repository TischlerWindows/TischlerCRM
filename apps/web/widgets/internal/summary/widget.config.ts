import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'summary',
  name: 'Summary',
  description: 'Create and view estimation summaries linked to this record',
  icon: 'LayoutGrid',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
  hideFromPalette: true,
}
