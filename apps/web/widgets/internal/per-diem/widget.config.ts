import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'per-diem',
  name: 'Per Diem',
  description: 'Track per diem expenses for this Work Order',
  icon: 'WalletCards',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}