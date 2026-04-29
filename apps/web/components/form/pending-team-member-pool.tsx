'use client'

import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { apiClient } from '@/lib/api-client'
import { usePendingWidget } from './pending-widget-context'

// ── Types ────────────────────────────────────────────────────────────────

/** Plain field name used in TeamMember data to reference each parent type. */
const OBJECT_TO_FIELD: Record<string, string> = {
  Property: 'property',
  Opportunity: 'opportunity',
  Project: 'project',
  WorkOrder: 'workOrder',
  Installation: 'installation',
  Lead: 'lead',
}

export interface PendingTeamMemberRow {
  /** Local-only temp id, e.g. "pending-tm-<rand>". Stable for the lifetime of the row. */
  id: string
  data: Record<string, unknown>
}

export interface PendingTeamMemberPoolValue {
  rows: PendingTeamMemberRow[]
  /** Adds a row and returns its temp id. */
  addRow: (data: Record<string, unknown>) => string
  /** Patches a row's data; merges shallowly. */
  updateRow: (id: string, patch: Record<string, unknown>) => void
  /** Removes a row by id. */
  removeRow: (id: string) => void
  /** Finds the first pending row matching the given contact/account ids (either may be omitted). */
  findByContactAccount: (
    contactId: string | null | undefined,
    accountId: string | null | undefined,
  ) => PendingTeamMemberRow | undefined
  /** Sets a boolean flag on a single row (by id) or unsets it on every row when value=false and id=null. */
  setFlag: (
    id: string | null,
    flag: 'primaryContact' | 'contractHolder' | 'quoteRecipient',
    value: boolean,
  ) => void
  /** Increments to signal listeners that the pool changed (e.g., for read-side caches). */
  version: number
  bumpVersion: () => void
}

// ── Context ──────────────────────────────────────────────────────────────

const PendingTeamMemberPoolContext = createContext<PendingTeamMemberPoolValue | null>(null)

// ── Provider ─────────────────────────────────────────────────────────────

interface ProviderProps {
  children: React.ReactNode
}

/**
 * Wraps a form so that all TeamMember-writing widgets (rollup + any number of
 * TeamMemberSlot widgets) share a single pending-rows pool during create mode.
 *
 * Registers ONCE with the surrounding PendingWidgetProvider so that all pooled
 * rows are flushed to the API after the parent record is created.
 */
export function PendingTeamMemberPoolProvider({ children }: ProviderProps) {
  const pendingCtx = usePendingWidget()
  const isCreateMode = pendingCtx?.isCreateMode === true
  const parentObjectApiName = pendingCtx?.parentObjectApiName ?? ''

  const [rows, setRows] = useState<PendingTeamMemberRow[]>([])
  const rowsRef = useRef(rows)
  rowsRef.current = rows

  const [version, setVersion] = useState(0)
  const bumpVersion = useCallback(() => setVersion(v => v + 1), [])

  const addRow = useCallback((data: Record<string, unknown>) => {
    const id = `pending-tm-${Date.now()}-${Math.random().toString(36).slice(2)}`
    setRows(prev => [...prev, { id, data }])
    return id
  }, [])

  const updateRow = useCallback((id: string, patch: Record<string, unknown>) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, data: { ...r.data, ...patch } } : r)))
  }, [])

  const removeRow = useCallback((id: string) => {
    setRows(prev => prev.filter(r => r.id !== id))
  }, [])

  const findByContactAccount = useCallback(
    (contactId: string | null | undefined, accountId: string | null | undefined) => {
      const cid = contactId ?? null
      const aid = accountId ?? null
      return rowsRef.current.find(r => {
        const rc = (r.data.contact as string | null | undefined) ?? null
        const ra = (r.data.account as string | null | undefined) ?? null
        return rc === cid && ra === aid
      })
    },
    [],
  )

  const setFlag = useCallback(
    (
      id: string | null,
      flag: 'primaryContact' | 'contractHolder' | 'quoteRecipient',
      value: boolean,
    ) => {
      setRows(prev =>
        prev.map(r => {
          if (id === null && !value) return { ...r, data: { ...r.data, [flag]: false } }
          if (r.id === id) return { ...r, data: { ...r.data, [flag]: value } }
          return r
        }),
      )
    },
    [],
  )

  // Register once with the surrounding pending-widget context so the pool flushes on save.
  useEffect(() => {
    if (!isCreateMode || !pendingCtx) return
    const widgetId = '__pending-team-member-pool__'

    pendingCtx.registerWidget({
      widgetId,
      hasPendingData: () => rowsRef.current.length > 0,
      savePendingData: async (parentRecordId: string) => {
        const parentField = OBJECT_TO_FIELD[parentObjectApiName]
        if (!parentField) throw new Error(`No TeamMember FK field for ${parentObjectApiName}`)

        for (const row of rowsRef.current) {
          await apiClient.post('/objects/TeamMember/records', {
            data: {
              ...row.data,
              [parentField]: parentRecordId,
            },
          })
        }
      },
      getPendingSummary: () => `${rowsRef.current.length} connection(s)`,
    })

    return () => pendingCtx.unregisterWidget(widgetId)
  }, [isCreateMode, pendingCtx, parentObjectApiName])

  const value = useMemo<PendingTeamMemberPoolValue>(
    () => ({
      rows,
      addRow,
      updateRow,
      removeRow,
      findByContactAccount,
      setFlag,
      version,
      bumpVersion,
    }),
    [rows, addRow, updateRow, removeRow, findByContactAccount, setFlag, version, bumpVersion],
  )

  return (
    <PendingTeamMemberPoolContext.Provider value={value}>
      {children}
    </PendingTeamMemberPoolContext.Provider>
  )
}

// ── Consumer hook ────────────────────────────────────────────────────────

/**
 * Access the pending TeamMember pool. Returns null when not inside a
 * PendingTeamMemberPoolProvider — widgets MUST handle the null fallback (use
 * private pending state) so they continue to work in older layouts.
 */
export function usePendingTeamMemberPool(): PendingTeamMemberPoolValue | null {
  return useContext(PendingTeamMemberPoolContext)
}
