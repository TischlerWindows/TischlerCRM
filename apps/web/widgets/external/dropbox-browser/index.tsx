'use client'

import type { WidgetProps } from '@/lib/widgets/types'
import { DropboxFileBrowser } from '@/components/dropbox-file-browser'

/**
 * Build a human-readable Dropbox folder name from record data.
 * Tries: "address (autoNumber)", then "address", then "autoNumber", then recordId.
 */
function deriveDropboxFolderName(record: Record<string, unknown>): string {
  const id = (record.id as string) || ''

  // Find the auto-number field (propertyNumber, contactNumber, etc.)
  const numberKey = Object.keys(record).find(
    (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k],
  )
  const autoNumber = numberKey ? (record[numberKey] as string) : ''

  // Find an address field and extract street text
  const addrKey = Object.keys(record).find(
    (k) => k.toLowerCase() === 'address' || k.toLowerCase().endsWith('__address'),
  )
  let addrStr = ''
  if (addrKey) {
    const raw = record[addrKey]
    if (typeof raw === 'string') {
      addrStr = raw
    } else if (raw && typeof raw === 'object') {
      const a = raw as Record<string, unknown>
      addrStr = [a.street, a.city, a.state].filter(Boolean).join(', ')
    }
  }

  if (addrStr && autoNumber) return `${addrStr} (${autoNumber})`
  if (addrStr) return addrStr
  if (autoNumber) return autoNumber
  return id
}

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

  // Use explicit config if set, otherwise derive from record data
  const folderName = (config.folderName as string) || deriveDropboxFolderName(record)

  return (
    <DropboxFileBrowser
      objectApiName={objectApiName}
      recordId={recordId}
      folderName={folderName}
      defaultSubPath={(config.defaultSubPath as string) || undefined}
      rootLabel={(config.rootLabel as string) || undefined}
    />
  )
}
