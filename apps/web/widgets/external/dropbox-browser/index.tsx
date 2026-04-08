'use client'

import { useState, useEffect } from 'react'
import type { WidgetProps } from '@/lib/widgets/types'
import { DropboxFileBrowser } from '@/components/dropbox-file-browser'
import { apiClient } from '@/lib/api-client'

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
  const folderName = (config.folderName as string) || deriveDropboxFolderName(record)

  // For linked record types (Lead, Opportunity, etc.), resolve the path to
  // point inside the parent Property folder instead of a top-level folder.
  const [resolved, setResolved] = useState<{
    objectApiName: string
    recordId: string
    folderName: string
    defaultSubPath?: string
  } | null>(null)

  useEffect(() => {
    if (!recordId) return
    let cancelled = false

    apiClient.resolveDropboxPath(objectApiName, recordId).then((res) => {
      if (cancelled) return
      if (res.linked && res.parentObjectApiName && res.parentRecordId && res.parentFolderName && res.subfolder && res.childFolderName) {
        let subPath = `${res.subfolder}/${res.childFolderName}`

        if (objectApiName === 'Opportunity') {
          // Opportunity → open directly into 1. Estimation subfolder
          subPath = `${subPath}/1. Estimation`
        } else if (objectApiName === 'Project' && res.linkedOpportunityFolderName) {
          // Project → open the linked Opportunity's Project Management subfolder
          subPath = `${res.subfolder}/${res.linkedOpportunityFolderName}/4. Project Management`
        }

        setResolved({
          objectApiName: res.parentObjectApiName,
          recordId: res.parentRecordId,
          folderName: res.parentFolderName,
          defaultSubPath: subPath,
        })
      } else {
        setResolved({
          objectApiName,
          recordId,
          folderName,
        })
      }
    }).catch(() => {
      if (!cancelled) {
        setResolved({ objectApiName, recordId, folderName })
      }
    })

    return () => { cancelled = true }
  }, [objectApiName, recordId, folderName])

  if (!resolved) return null

  return (
    <DropboxFileBrowser
      objectApiName={resolved.objectApiName}
      recordId={resolved.recordId}
      folderName={resolved.folderName}
      defaultSubPath={resolved.defaultSubPath || (config.defaultSubPath as string) || undefined}
      rootLabel={(config.rootLabel as string) || undefined}
    />
  )
}
