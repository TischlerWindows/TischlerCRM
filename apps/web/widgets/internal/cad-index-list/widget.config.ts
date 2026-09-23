import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'cad-index-list',
  name: 'CAD Index List',
  description: 'Track 4 independent CAD index checklists for this Project: Installation Completion Sign Off, Pre-Installation Survey List, Installation Progress List, and Final Adjustment Check List',
  icon: 'ListChecks',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
