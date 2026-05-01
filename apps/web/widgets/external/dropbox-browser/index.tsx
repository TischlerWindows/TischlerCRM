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

  // Special case for Contact: format as "FirstName LastName (CT####)"
  if (objectApiName?.toLowerCase() === 'contact') {
    const stripSubPrefix = (k: string) => k.replace(/^[A-Za-z]+__[A-Za-z]+_/, '').toLowerCase()
    const stripObjPrefix = (k: string) => k.replace(/^[A-Za-z]+__/, '').toLowerCase()
    const getNamePart = (obj: Record<string, unknown>, field: string): string => {
      for (const [k, v] of Object.entries(obj)) {
        if (
          (stripSubPrefix(k) === field || stripObjPrefix(k) === field) &&
          typeof v === 'string' && v && !/^n\/a$/i.test(v.trim())
        ) return v
      }
      return ''
    }

    // CompositeText name may be a nested object under a key ending in '__name'
    const nameKey = Object.keys(record).find(
      (k) => k.toLowerCase() === 'name' || k.toLowerCase().endsWith('__name'),
    )
    const nameObj =
      nameKey && record[nameKey] && typeof record[nameKey] === 'object'
        ? (record[nameKey] as Record<string, unknown>)
        : null

    const firstName =
      getNamePart(record, 'firstname') || (nameObj ? getNamePart(nameObj, 'firstname') : '')
    const lastName =
      getNamePart(record, 'lastname') || (nameObj ? getNamePart(nameObj, 'lastname') : '')

    const personName = [firstName, lastName].filter(Boolean).join(' ').trim()

    // Directly resolve the contact number — prefer the generic autoNumber already
    // computed above, but also do a targeted scan for 'contactnumber' keys in case
    // the generic path came up empty (e.g. the key wasn't found before disambiguation).
    let contactNum = autoNumber
    if (!contactNum) {
      const sk = (k: string) => k.replace(/^[A-Za-z]+__/, '').toLowerCase()
      const cnKey = Object.keys(record).find(
        (k) => sk(k) === 'contactnumber' && typeof record[k] === 'string' && record[k],
      )
      if (cnKey) contactNum = record[cnKey] as string
    }

    if (contactNum && personName) return `${contactNum} (${personName})`
    if (contactNum) return contactNum
    if (personName) return personName
    return id
  }

  // Special case for Lead: format as "Lead#### (Contact Name) M-D-YY"
  if (objectApiName?.toLowerCase() === 'lead') {
    // Reformat number: LEAD0001 → Lead0001
    const leadNumber = autoNumber ? autoNumber.replace(/^LEAD/i, (m) => 'Lead' + m.slice(4)) : ''
    // Use record's createdAt if available, otherwise today
    const rawDate = (record.createdAt || record.CreatedDate) as string | undefined
    const dt = rawDate ? new Date(rawDate) : new Date()
    // Format: M-D-YY (no leading zeros, 2-digit year)
    const dateStr = `${dt.getMonth() + 1}-${dt.getDate()}-${String(dt.getFullYear()).slice(-2)}`
    // Contact name: try resolved display name (injected by backend), skip UUID values
    const sk = (k: string) => k.replace(/^[A-Za-z]+__/, '').toLowerCase()
    const contactNameKey = Object.keys(record).find(k => sk(k) === 'contactname' || sk(k) === 'contactdisplayname')
    const rawContactName = contactNameKey ? (record[contactNameKey] as string) : ''
    // Only use if it looks like a real name (not a UUID or "N/A")
    const isUuid = (v: string) => /^[0-9a-f-]{30,}$/i.test(v)
    const contactName = rawContactName && !isUuid(rawContactName) && !/^N\/A$/i.test(rawContactName.trim())
      ? rawContactName.trim()
      : ''
    if (leadNumber && contactName) return `${leadNumber} (${contactName}) ${dateStr}`
    if (leadNumber) return `${leadNumber} ${dateStr}`
    if (contactName) return `${contactName} ${dateStr}`
    return id
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

    // Run path resolution and folder-ensure in parallel.
    // The ensure call regenerates any deleted subfolder (e.g. a deleted
    // Opportunity folder inside its parent Property) before the browser loads.
    const resolvePromise = apiClient.resolveDropboxPath(objectApiName, recordId)
    const ensurePromise = apiClient.ensureDropboxFolder(objectApiName, recordId, folderName).catch(() => null)

    Promise.all([resolvePromise, ensurePromise]).then(([res]) => {
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
          // Project → open the linked Opportunity's folder
          subPath = `${res.subfolder}/${res.linkedOpportunityFolderName}`
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
