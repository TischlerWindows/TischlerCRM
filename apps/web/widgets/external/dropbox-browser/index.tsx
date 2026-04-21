'use client'

import { useState, useEffect } from 'react'
import type { WidgetProps } from '@/lib/widgets/types'
import { DropboxFileBrowser } from '@/components/dropbox-file-browser'
import { apiClient } from '@/lib/api-client'

/**
 * Build a human-readable Dropbox folder name from record data.
 * Tries: "address (autoNumber)", then "address", then "autoNumber", then recordId.
 * Pass objectApiName to prefer the record's OWN auto-number over numbers from
 * linked entities (e.g. prefer projectNumber over opportunityNumber for a Project).
 */
function deriveDropboxFolderName(record: Record<string, unknown>, objectApiName?: string): string {
  const id = (record.id as string) || ''

  // Find the auto-number field, preferring the record's own entity number.
  const allNumberKeys = Object.keys(record).filter(
    (k) => k.toLowerCase().includes('number') && typeof record[k] === 'string' && record[k],
  )
  let numberKey: string | undefined
  if (objectApiName && allNumberKeys.length > 1) {
    const selfPrefix = objectApiName.toLowerCase()
    const stripped = (k: string) => k.replace(/^[A-Za-z]+__/, '').toLowerCase()
    // 1. Exact match: stripped key === `${objectApiName}number`
    numberKey = allNumberKeys.find(k => stripped(k) === selfPrefix + 'number')
    // 2. Key starts with the object's own name
    if (!numberKey) numberKey = allNumberKeys.find(k => stripped(k).startsWith(selfPrefix))
    // 3. Key doesn't contain any foreign entity name
    if (!numberKey) {
      const foreign = ['opportunity', 'property', 'lead', 'workorder', 'work_order', 'service', 'contact', 'account']
        .filter(p => p !== selfPrefix)
      numberKey = allNumberKeys.find(k => !foreign.some(p => stripped(k).includes(p)))
    }
  }
  if (!numberKey) numberKey = allNumberKeys[0]
  const autoNumber = numberKey ? (record[numberKey] as string) : ''

  // Find address — prefer address_search (LocationSearch blob) which always
  // has structured {street, city, state}, then fall back to legacy 'address'.
  let addrStr = ''

  // 1. Try address_search / *__address_search
  const searchKey = Object.keys(record).find(
    (k) => k.toLowerCase() === 'address_search' || k.toLowerCase().endsWith('__address_search'),
  )
  if (searchKey) {
    const raw = record[searchKey]
    if (raw && typeof raw === 'object') {
      const a = raw as Record<string, unknown>
      addrStr = [a.street, a.city, a.state].filter(Boolean).join(', ')
    } else if (typeof raw === 'string' && raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          addrStr = [parsed.street, parsed.city, parsed.state].filter(Boolean).join(', ')
        }
      } catch { addrStr = raw }
    }
  }

  // 2. Fall back to address / *__address
  if (!addrStr) {
    const addrKey = Object.keys(record).find(
      (k) => k.toLowerCase() === 'address' || k.toLowerCase().endsWith('__address'),
    )
    if (addrKey) {
      const raw = record[addrKey]
      if (typeof raw === 'string') {
        addrStr = raw
      } else if (raw && typeof raw === 'object') {
        const a = raw as Record<string, unknown>
        addrStr = [a.street, a.city, a.state].filter(Boolean).join(', ')
      }
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
  const folderName = (config.folderName as string) || deriveDropboxFolderName(record, objectApiName)

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

        if (objectApiName === 'Opportunity' && res.isRequote && (res.parentOpportunityFolderName || res.parentOpportunityNumber)) {
          // Requote → open requote folder inside parent OPP's 1. Estimation
          const parentFolder = res.parentOpportunityFolderName || res.parentOpportunityNumber
          subPath = `${res.subfolder}/${parentFolder}/1. Estimation/${res.childFolderName}`
        } else if (objectApiName === 'Opportunity') {
          // Opportunity → open the OPP#### folder inside 1. Estimation
          subPath = `${res.subfolder}/${res.childFolderName}/1. Estimation/${res.childFolderName}`
        } else if (objectApiName === 'Project' && res.linkedOpportunityFolderName) {
          // Project → open PRJ#### folder inside Opportunity's "4. Project Management"
          subPath = `${res.subfolder}/${res.linkedOpportunityFolderName}/4. Project Management/${res.childFolderName}`
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
