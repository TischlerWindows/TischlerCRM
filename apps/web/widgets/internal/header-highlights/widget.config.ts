import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'header-highlights',
  name: 'Header Highlights',
  description: 'Highlight key fields in the record header',
  icon: 'Sparkles',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [], // all config handled by ConfigPanel.tsx
}
