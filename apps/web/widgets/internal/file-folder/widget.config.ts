import type { WidgetManifest } from '@/lib/widgets/types'

export const config: WidgetManifest = {
  id: 'file-folder',
  name: 'File Folder',
  description: 'Browse files from a connected folder provider',
  icon: 'FolderOpen',
  category: 'internal',
  integration: null,
  defaultDisplayMode: 'full',
  configSchema: [
    {
      key: 'provider',
      type: 'select',
      label: 'Provider',
      options: [
        { value: 'dropbox', label: 'Dropbox' },
        { value: 'google-drive', label: 'Google Drive' },
        { value: 'local', label: 'Local' },
      ],
    },
    { key: 'path', type: 'merge-text', label: 'Folder Path' },
  ],
}
