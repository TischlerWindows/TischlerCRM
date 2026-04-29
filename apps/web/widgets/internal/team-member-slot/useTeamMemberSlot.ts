'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiClient } from '@/lib/api-client'
import type { TeamMemberSlotCriterion, TeamMemberFlag } from '@/lib/schema'
import {
  usePendingTeamMemberPool,
  type PendingTeamMemberRow,
} from '@/components/form/pending-team-member-pool'
import { notifyTeamMembersChanged, subscribeTeamMembersChanged } from './teamMemberEvents'

/** Plain field name on TeamMember for each parent object. */
const OBJECT_TO_FIELD: Record<string, string> = {
  Property: 'property',
  Opportunity: 'opportunity',
  Project: 'project',
  WorkOrder: 'workOrder',
  Installation: 'installation',
  Lead: 'lead',
}

/** Auto-generated lookup field (e.g. PropertyId) — fallback when plain field isn't present. */
const OBJECT_TO_LOOKUP_FIELD: Record<string, string> = {
  Property: 'PropertyId',
  Opportunity: 'OpportunityId',
  Project: 'ProjectId',
  WorkOrder: 'WorkOrderId',
  Installation: 'InstallationId',
  Lead: 'LeadId',
}

export interface TeamMemberRow {
  id: string
  isPending: boolean
  data: Record<string, unknown>
}

/** Reads a possibly-prefixed lookup id (`contact`, `ContactId`, `TeamMember__contact`, etc.). */
function getLookupId(row: Record<string, unknown>, plainKey: string): string | null {
  const variants = [
    plainKey,
    `${plainKey.charAt(0).toUpperCase()}${plainKey.slice(1)}Id`,
    `TeamMember__${plainKey}`,
  ]
  for (const v of variants) {
    const raw = row[v]
    if (typeof raw === 'string' && raw) return raw
    if (raw && typeof raw === 'object' && 'id' in raw && typeof (raw as { id: unknown }).id === 'string') {
      return (raw as { id: string }).id
    }
  }
  return null
}

/** Normalizes a TM record to its bare data fields. */
function dataOf(rec: Record<string, unknown>): Record<string, unknown> {
  const inner = rec.data
  if (inner && typeof inner === 'object') return inner as Record<string, unknown>
  return rec
}

/** Returns true if a row matches the slot's criterion. */
function rowMatches(data: Record<string, unknown>, criterion: TeamMemberSlotCriterion): boolean {
  if (criterion.kind === 'flag') {
    // The API may return Checkbox fields as either a boolean true or the string "true"; the
    // team-members-rollup widget has matched both since the TeamMember object was introduced.
    const v = data[criterion.flag]
    return v === true || v === 'true'
  }
  return data.role === criterion.role
}

/** Heuristic match for "API said this record doesn't exist". */
function isNotFoundError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return /Record not found|status:\s*404|\b404\b/i.test(msg)
}

interface UseTeamMemberSlotOptions {
  parentObjectApiName: string
  parentRecordId: string | null
  criterion: TeamMemberSlotCriterion
}

export interface UseTeamMemberSlotResult {
  rows: TeamMemberRow[]
  loading: boolean
  error: string | null
  /**
   * Fill / update the slot.
   * - Flag-bound: sets the flag on the matching person's row, or creates a new row.
   * - Role-bound: creates a new row.
   * Returns the resulting row id (for pending) or saved row id.
   */
  fillSlot: (input: {
    contactId?: string | null
    accountId?: string | null
    role?: string
  }) => Promise<TeamMemberRow>
  /**
   * Clear a specific row from this slot.
   * - Flag-bound: unsets the flag (row remains).
   * - Role-bound: deletes the row.
   */
  clearRow: (rowId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useTeamMemberSlot({
  parentObjectApiName,
  parentRecordId,
  criterion,
}: UseTeamMemberSlotOptions): UseTeamMemberSlotResult {
  const pool = usePendingTeamMemberPool()
  const [savedRows, setSavedRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCreateMode = !parentRecordId
  const criterionRef = useRef(criterion)
  criterionRef.current = criterion

  // ── Read ────────────────────────────────────────────────────────────
  const fetchRows = useCallback(async () => {
    if (!parentRecordId) {
      setSavedRows([])
      return
    }
    const parentField = OBJECT_TO_FIELD[parentObjectApiName]
    if (!parentField) {
      setSavedRows([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      // Try plain field first; many records reference parent via plain key.
      let data: Record<string, unknown>[] = []
      try {
        data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/TeamMember/records?filter[${parentField}]=${encodeURIComponent(parentRecordId)}&limit=500`,
        )
        if (!Array.isArray(data)) data = []
      } catch {
        data = []
      }
      // Fall back to the auto-generated lookup field if no rows came back.
      if (data.length === 0) {
        const lookupKey = OBJECT_TO_LOOKUP_FIELD[parentObjectApiName]
        if (lookupKey) {
          try {
            const alt = await apiClient.get<Record<string, unknown>[]>(
              `/objects/TeamMember/records?filter[${lookupKey}]=${encodeURIComponent(parentRecordId)}&limit=500`,
            )
            if (Array.isArray(alt)) data = alt
          } catch {
            /* ignore */
          }
        }
      }
      setSavedRows(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load connections')
      setSavedRows([])
    } finally {
      setLoading(false)
    }
  }, [parentRecordId, parentObjectApiName])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  // Stay in sync with TeamMember writes anywhere in the app (rollup deletes,
  // other slots, etc.) so we don't try to PUT/DELETE a stale row id.
  useEffect(() => {
    return subscribeTeamMembersChanged(() => {
      void fetchRows()
    })
  }, [fetchRows])

  // Filter to matching rows (saved + pending) by criterion.
  const matchingSaved: TeamMemberRow[] = savedRows
    .filter(r => rowMatches(dataOf(r), criterion))
    .map(r => ({ id: String(r.id), isPending: false, data: dataOf(r) }))

  const matchingPending: TeamMemberRow[] = pool
    ? pool.rows
        .filter((r: PendingTeamMemberRow) => rowMatches(r.data, criterion))
        .map(r => ({ id: r.id, isPending: true, data: r.data }))
    : []

  const rows = [...matchingSaved, ...matchingPending]

  // ── Write ───────────────────────────────────────────────────────────
  const fillSlot = useCallback(
    async ({
      contactId,
      accountId,
      role,
    }: {
      contactId?: string | null
      accountId?: string | null
      role?: string
    }): Promise<TeamMemberRow> => {
      const cur = criterionRef.current
      const parentField = OBJECT_TO_FIELD[parentObjectApiName]

      // Flag-bound: try to set the flag on an existing row that matches contact/account.
      if (cur.kind === 'flag') {
        const flagName: TeamMemberFlag = cur.flag
        // Pending-mode handling
        if (isCreateMode && pool) {
          const existing = pool.findByContactAccount(contactId, accountId)
          if (existing) {
            pool.updateRow(existing.id, { [flagName]: true })
            return { id: existing.id, isPending: true, data: { ...existing.data, [flagName]: true } }
          }
          if (!role) throw new Error('Role is required when adding a new connection to a flag-bound slot.')
          const data: Record<string, unknown> = {
            role,
            [flagName]: true,
          }
          if (contactId) data.contact = contactId
          if (accountId) data.account = accountId
          const id = pool.addRow(data)
          return { id, isPending: true, data }
        }

        // Saved-mode: look for an existing TM row on this parent record matching contact+account
        const existingSaved = savedRows.find(r => {
          const d = dataOf(r)
          const c = getLookupId(d, 'contact')
          const a = getLookupId(d, 'account')
          return c === (contactId ?? null) && a === (accountId ?? null)
        })
        if (existingSaved) {
          try {
            await apiClient.put(`/objects/TeamMember/records/${String(existingSaved.id)}`, {
              data: { [flagName]: true },
            })
            await fetchRows()
            pool?.bumpVersion()
            notifyTeamMembersChanged()
            return {
              id: String(existingSaved.id),
              isPending: false,
              data: { ...dataOf(existingSaved), [flagName]: true },
            }
          } catch (err) {
            // Row was deleted out from under us (e.g. via the rollup widget).
            // Refetch and fall through to create a new row.
            if (!isNotFoundError(err)) throw err
            await fetchRows()
          }
        }

        // Create new
        if (!role) throw new Error('Role is required when adding a new connection to a flag-bound slot.')
        const payload: Record<string, unknown> = {
          role,
          [flagName]: true,
        }
        if (contactId) payload.contact = contactId
        if (accountId) payload.account = accountId
        if (parentRecordId && parentField) payload[parentField] = parentRecordId

        const created = await apiClient.post<Record<string, unknown>>('/objects/TeamMember/records', {
          data: payload,
        })
        await fetchRows()
        pool?.bumpVersion()
        notifyTeamMembersChanged()
        return { id: String(created.id), isPending: false, data: dataOf(created) }
      }

      // Role-bound: always create a new row (multiple rows per person allowed).
      const roleValue = cur.role
      const payload: Record<string, unknown> = { role: roleValue }
      if (contactId) payload.contact = contactId
      if (accountId) payload.account = accountId

      if (isCreateMode && pool) {
        const id = pool.addRow(payload)
        return { id, isPending: true, data: payload }
      }

      if (parentRecordId && parentField) payload[parentField] = parentRecordId
      const created = await apiClient.post<Record<string, unknown>>('/objects/TeamMember/records', {
        data: payload,
      })
      await fetchRows()
      pool?.bumpVersion()
      return { id: String(created.id), isPending: false, data: dataOf(created) }
    },
    [isCreateMode, pool, parentObjectApiName, parentRecordId, savedRows, fetchRows],
  )

  const clearRow = useCallback(
    async (rowId: string) => {
      const cur = criterionRef.current
      const target = rows.find(r => r.id === rowId)
      if (!target) return

      // Pending row: either unset flag or remove entirely
      if (target.isPending && pool) {
        if (cur.kind === 'flag') {
          pool.updateRow(rowId, { [cur.flag]: false })
        } else {
          pool.removeRow(rowId)
        }
        return
      }

      // Saved row — tolerate 404 (already deleted via another widget / tab).
      try {
        if (cur.kind === 'flag') {
          await apiClient.put(`/objects/TeamMember/records/${rowId}`, {
            data: { [cur.flag]: false },
          })
        } else {
          await apiClient.delete(`/objects/TeamMember/records/${rowId}`)
        }
      } catch (err) {
        if (!isNotFoundError(err)) throw err
      }
      await fetchRows()
      pool?.bumpVersion()
      notifyTeamMembersChanged()
    },
    [pool, rows, fetchRows],
  )

  return {
    rows,
    loading,
    error,
    fillSlot,
    clearRow,
    refresh: fetchRows,
  }
}
