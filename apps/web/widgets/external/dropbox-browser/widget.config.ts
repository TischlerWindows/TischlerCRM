import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'dropbox-browser',
  name: 'Dropbox File Browser',
  description: 'Browse, upload, and manage Dropbox files linked to the current record.',
  icon: 'FolderOpen',
  category: 'external',
  integration: 'dropbox',
  defaultDisplayMode: 'full',
  configSchema: [
    {
      key: 'folderName',
      type: 'merge-text',
      label: 'Folder Name',
      placeholder: '{record.Name}',
      helpText: 'Dropbox folder name for this record. Supports merge fields.',
    },
    {
      key: 'defaultSubPath',
      type: 'merge-text',
      label: 'Default Sub-Path',
      placeholder: 'e.g. Leads/{record.Name}',
      helpText: 'Pre-navigate into a subfolder when the widget loads.',
    },
    {
      key: 'rootLabel',
      type: 'text',
      label: 'Root Label',
      placeholder: 'Root',
      helpText: 'Label for the root breadcrumb.',
    },
  ],
}
