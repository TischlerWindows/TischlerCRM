'use client'

import type { WidgetProps } from '@/lib/widgets/types'
import { DropboxFileBrowser } from '@/components/dropbox-file-browser'

export default function DropboxBrowserWidget({ config, record, object }: WidgetProps) {
  const recordId = (record.id as string) || ''
  const objectApiName = object.apiName

  if (!recordId) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
        Save the record first to use Dropbox.
      </div>
    )
  }

  return (
    <DropboxFileBrowser
      objectApiName={objectApiName}
      recordId={recordId}
      folderName={(config.folderName as string) || undefined}
      defaultSubPath={(config.defaultSubPath as string) || undefined}
      rootLabel={(config.rootLabel as string) || undefined}
    />
  )
}
