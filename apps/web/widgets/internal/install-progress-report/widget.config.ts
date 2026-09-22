import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'install-progress-report',
  name: 'Install Progress Report',
  description: 'Shop-drawing/unit install progress tracker for this Installation, with configurable progress-stage columns',
  icon: 'ClipboardCheck',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
