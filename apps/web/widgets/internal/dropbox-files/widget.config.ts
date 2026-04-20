import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'dropbox-files',
  name: 'Dropbox Files',
  description: 'Browse, upload, and manage files stored in Dropbox for this record',
  icon: 'Cloud',
  category: 'internal',
  integration: 'dropbox',
  defaultDisplayMode: 'full',
  configSchema: [
    { key: 'folderName', type: 'merge-text', label: 'Folder Name', description: 'Name of the folder in Dropbox (e.g. "Leads/{firstName} {lastName}")' },
  ],
}
