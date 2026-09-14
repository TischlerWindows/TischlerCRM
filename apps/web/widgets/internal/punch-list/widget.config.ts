import type { WidgetManifest } from '@/lib/widgets/types'

// Manifest id must match the 'punch-list' entry in packages/widgets/src/index.ts
// (INTERNAL_WIDGET_IDS) so the backend creates a WidgetSetting row for it and
// it shows up (enabled by default) in the page-editor palette.
export const config: WidgetManifest = {
  id: 'punch-list',
  name: 'Punch List',
  description: 'Punch list items for this Project — inline-editable grid with a New Punch List form',
  icon: 'ListChecks',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [],
}
