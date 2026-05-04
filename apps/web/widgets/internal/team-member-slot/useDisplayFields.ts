'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import type { TeamMemberRow } from './useTeamMemberSlot'

interface DisplayFieldValues {
  Contact?: Record<string, unknown>
  Account?: Record<string, unknown>
}

export type DisplayFieldMap = Record<string, DisplayFieldValues>

interface UseDisplayFieldsOptions {
  rows: TeamMemberRow[]
  displayFields?: {
    Contact?: string[]
    Account?: string[]
  }
  enabled: boolean
}

function getLookupId(row: Record<string, unknown>, plainKey: string): string | null {
  const variants = [
    plainKey,
    `${plainKey.charAt(0).toUpperCase()}${plainKey.slice(1)}Id`,
    `TeamMember__${plainKey}`,
  ]
  for (const v of variants) {
    const raw = row[v]
    if (typeof raw === 'string' && raw) return raw
    if (
      raw &&
      typeof raw === 'object' &&
      'id' in raw &&
      typeof (raw as { id: unknown }).id === 'string'
    ) {
      return (raw as { id: string }).id
    }
  }
  return null
}

export function useDisplayFields({
  rows,
  displayFields,
  enabled,
}: UseDisplayFieldsOptions): { fieldMap: DisplayFieldMap; loading: boolean } {
  const [fieldMap, setFieldMap] = useState<DisplayFieldMap>({})
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Record<string, Record<string, unknown>>>({})

  const contactFields = displayFields?.Contact
  const accountFields = displayFields?.Account
  const hasContactFields = (contactFields?.length ?? 0) > 0
  const hasAccountFields = (accountFields?.length ?? 0) > 0
  const hasAnyFields = hasContactFields || hasAccountFields

  const rowKey = useMemo(() => rows.map((r) => r.id).join(','), [rows])
  const fieldKey = useMemo(
    () => JSON.stringify({ c: contactFields, a: accountFields }),
    [contactFields, accountFields],
  )

  useEffect(() => {
    if (!enabled || !hasAnyFields || rows.length === 0) {
      setFieldMap({})
      return
    }

    let cancelled = false

    async function fetchAll() {
      setLoading(true)
      try {
        const result: DisplayFieldMap = {}

        await Promise.all(
          rows.map(async (row) => {
            const entry: DisplayFieldValues = {}

            if (hasContactFields) {
              const contactId = getLookupId(row.data, 'contact')
              if (contactId) {
                if (cacheRef.current[contactId]) {
                  entry.Contact = cacheRef.current[contactId]
                } else {
                  try {
                    const record = await apiClient.get<Record<string, unknown>>(
                      `/objects/Contact/records/${contactId}`,
                    )
                    cacheRef.current[contactId] = record
                    entry.Contact = record
                  } catch {
                    /* record may have been deleted */
                  }
                }
              }
            }

            if (hasAccountFields) {
              const accountId = getLookupId(row.data, 'account')
              if (accountId) {
                if (cacheRef.current[accountId]) {
                  entry.Account = cacheRef.current[accountId]
                } else {
                  try {
                    const record = await apiClient.get<Record<string, unknown>>(
                      `/objects/Account/records/${accountId}`,
                    )
                    cacheRef.current[accountId] = record
                    entry.Account = record
                  } catch {
                    /* record may have been deleted */
                  }
                }
              }
            }

            result[row.id] = entry
          }),
        )

        if (!cancelled) {
          setFieldMap(result)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchAll()
    return () => {
      cancelled = true
    }
  }, [rowKey, fieldKey, enabled, hasAnyFields])

  return { fieldMap, loading }
}
