import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'header-highlights',
  name: 'Header Highlights',
  description: 'Highlight key fields in the record header',
  icon: 'Sparkles',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [{ key: 'fields', type: 'json', label: 'Highlighted Fields' }],
}
