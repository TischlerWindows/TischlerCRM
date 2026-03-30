import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'related-list',
  name: 'Related List',
  description: 'Show related records from any object',
  icon: 'List',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [], // all config is handled by ConfigPanel.tsx (see Task 16)
}
