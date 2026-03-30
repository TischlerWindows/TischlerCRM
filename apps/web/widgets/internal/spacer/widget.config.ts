import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'spacer',
  name: 'Spacer',
  description: 'Vertical spacing between layout regions',
  icon: 'Minus',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [
    { key: 'height', type: 'number', label: 'Height (px)', default: 32, min: 8, max: 200 },
  ],
}
