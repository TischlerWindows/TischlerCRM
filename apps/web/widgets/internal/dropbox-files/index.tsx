'use client'

import type { WidgetProps } from '@/lib/widgets/types'
import { DropboxFileBrowser } from '@/components/dropbox-file-browser'

export default function DropboxFilesWidget({
  config,
  record,
  object,
}: WidgetProps) {
  const objectApiName = object?.apiName || ''
  const recordId = String(record?.id || '')
  const folderName = typeof config.folderName === 'string' ? config.folderName : undefined

  if (!recordId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        <p className="font-medium">Dropbox Files</p>
        <p className="mt-1 text-xs">Unable to render: record ID is missing.</p>
      </div>
    )
  }

  return (
    <DropboxFileBrowser
      objectApiName={objectApiName}
      recordId={recordId}
      folderName={folderName}
    />
  )
}
