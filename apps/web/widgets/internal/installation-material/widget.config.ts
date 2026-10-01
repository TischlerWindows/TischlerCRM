import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'installation-material',
  name: 'Installation Material',
  description: 'Prepare ACQ, Non-ACQ, or US supplied installation material orders on Projects.',
  icon: 'PackageCheck',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}