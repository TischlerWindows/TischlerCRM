'use client'

import React, { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { preloadLookupRecords, resolveLookupDisplayName } from '@/lib/utils'
import type { PanelField, TeamMemberSlotConfig, TeamMemberSlotCriterion } from '@/lib/schema'
import { recordUrl } from '@/lib/record-url'
import { useSchemaStore } from '@/lib/schema-store'
import { useToast } from '@/components/toast'
import { apiClient } from '@/lib/api-client'
import { SlotInput } from './SlotInput'
import {
  useTeamMemberSlot,
  type TeamMemberRow,
  fetchFreshRows,
  rowMatches,
  dataOf,
  OBJECT_TO_FIELD,
} from './useTeamMemberSlot'
import { notifyTeamMembersChanged } from './teamMemberEvents'
import { useDisplayFields } from './useDisplayFields'

/** Imperative handle exposed when `staged={true}` so the parent form can apply or discard changes. */
export interface TeamMemberSlotHandle {
  /** Apply all buffered staged changes to the backend. Call on form Save. */
  applyChanges: () => Promise<void>
}

function extractId(row: Record<string, unknown>, plainKey: string): string | null {
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

function resolveRowDisplay(row: TeamMemberRow): {
  contact: string
  account: string
  contactId: string | null
  accountId: string | null
} {
  const contactId = extractId(row.data, 'contact')
  const accountId = extractId(row.data, 'account')
  const denormContact =
    (row.data.contactName as string | undefined) ||
    (row.data.TeamMember__contactName as string | undefined) ||
    ''
  const denormAccount =
    (row.data.accountName as string | undefined) ||
    (row.data.TeamMember__accountName as string | undefined) ||
    ''
  const contact =
    denormContact || (contactId ? resolveLookupDisplayName(contactId, 'Contact') : '')
  const account =
    denormAccount || (accountId ? resolveLookupDisplayName(accountId, 'Account') : '')
  return {
    contact: contact && contact !== '-' ? contact : '',
    account: account && account !== '-' ? account : '',
    contactId,
    accountId,
  }
}

function DisplayFieldRows({
  fields,
  record,
  objectApiName,
}: {
  fields: string[]
  record: Record<string, unknown> | undefined
  objectApiName: string
}) {
  const schema = useSchemaStore((s) => s.schema)
  if (!record || fields.length === 0) return null

  const objectDef = schema?.objects.find((o) => o.apiName === objectApiName)

  // Records are stored with field values as bare keys (the API strips
  // "ObjectName__" prefixes on write). However, some legacy records and
  // some endpoints may still surface prefixed keys, so check both.
  const readField = (apiName: string): unknown => {
    const bare = apiName.replace(/^[A-Za-z]+__/, '')
    return (
      record[apiName] ??
      record[bare] ??
      record[`${objectApiName}__${bare}`]
    )
  }

  return (
    <div className="mt-1 grid gap-x-3 gap-y-0.5 text-xs text-gray-500" style={{ gridTemplateColumns: 'auto 1fr' }}>
      {fields.map((apiName) => {
        const fieldDef = objectDef?.fields.find((f) => f.apiName === apiName)
        const label = fieldDef?.label ?? apiName
        const value = readField(apiName)
        const display = value == null || value === '' ? '—' : String(value)
        return (
          <React.Fragment key={apiName}>
            <span className="text-gray-400 font-medium truncate">{label}:</span>
            <span className="truncate">{display}</span>
          </React.Fragment>
        )
      })}
    </div>
  )
}

interface TeamMemberSlotFieldProps {
  /** Parent record's object api name (e.g. 'Opportunity'). */
  parentObjectApiName: string
  /** Parent record id, or null in create mode. */
  parentRecordId: string | null
  /** The TeamMemberSlot config (criterion, mode, cardinality, etc.) inlined on the panel field. */
  slotConfig: TeamMemberSlotConfig
  /** The panel field's label/style overrides — same shape used by regular fields. */
  panelField?: Pick<PanelField, 'labelOverride' | 'labelStyle' | 'valueStyle' | 'behavior'>
  /**
   * When true, render the slot value(s) as plain read-only text — no inputs,
   * no clear buttons, no add buttons. Used in view mode (record detail page)
   * so accidental clicks can't delete linked TeamMember rows. Edits go through
   * Edit mode like regular fields.
   */
  readOnly?: boolean
  /**
   * When true, changes are buffered locally and NOT sent to the API until
   * `applyChanges()` is called on the forwarded ref. Use inside edit-mode
   * dialogs so "Discard" abandons changes without side-effects.
   */
  staged?: boolean
  /** Roles from single-cardinality role-bound sibling slots — only these are blocked when occupied. */
  singleCardinalityRoles?: Set<string>
}

function defaultLabel(config: TeamMemberSlotConfig): string {
  if (config.label) return config.label
  if (config.criterion.kind === 'flag') {
    switch (config.criterion.flag) {
      case 'primaryContact': return 'Primary Contact'
      case 'contractHolder': return 'Contract Holder'
      case 'quoteRecipient': return 'Quote Recipient'
    }
  }
  return config.criterion.role
}

/**
 * Renders a TeamMemberSlot inside a field section so it visually matches the
 * surrounding form fields. The label respects the panel field's labelOverride
 * and labelStyle so admins can tune it via the same properties sidebar that
 * styles other fields.
 */
export const TeamMemberSlotField = React.forwardRef<TeamMemberSlotHandle, TeamMemberSlotFieldProps>(
function TeamMemberSlotField({
  parentObjectApiName,
  parentRecordId,
  slotConfig,
  panelField,
  readOnly,
  staged,
  singleCardinalityRoles,
}: TeamMemberSlotFieldProps, ref) {
  const { showToast } = useToast()

  // ── STAGED MODE ─────────────────────────────────────────────────────
  // Buffer all changes locally; no API calls until applyChanges() is invoked.
  const [stagedRows, setStagedRows] = useState<TeamMemberRow[]>([])
  const [stagedLoading, setStagedLoading] = useState(false)
  const initialRowsRef = useRef<TeamMemberRow[]>([])
  // True once the user has made any staged edit (fill/clear) before the
  // initial-rows fetch below resolves. Without this guard, a user who
  // clicks the pencil icon and immediately picks a connection (faster than
  // the network round-trip) would have their edit silently overwritten the
  // moment the fetch's .then() ran and called setStagedRows(matched) with
  // the stale pre-edit rows — the UI showed a "Connection saved" toast
  // (the local staged update succeeded), but Save's applyChanges() would
  // then diff against rows that no longer included the edit, producing
  // zero adds/clears and silently persisting nothing.
  const hasStagedEditRef = useRef(false)

  useEffect(() => {
    if (!staged || !parentRecordId) {
      setStagedRows([])
      hasStagedEditRef.current = false
      return
    }
    hasStagedEditRef.current = false
    setStagedLoading(true)
    fetchFreshRows(parentObjectApiName, parentRecordId)
      .then(rawRows => {
        const matched = rawRows
          .filter(r => rowMatches(dataOf(r), slotConfig.criterion))
          .map(r => ({ id: String(r.id), isPending: false, data: dataOf(r) } as TeamMemberRow))
        initialRowsRef.current = matched
        // Only adopt the fetched rows as the live staged state if the user
        // hasn't already edited in the meantime — applyChanges() always has
        // the correct baseline via initialRowsRef regardless.
        if (!hasStagedEditRef.current) {
          setStagedRows(matched)
        }
      })
      .catch(err => console.error('[staged slot] fetch failed:', err))
      .finally(() => setStagedLoading(false))
  // Re-run only when the key identifiers change, not on criterion object identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staged, parentRecordId, parentObjectApiName])

  const stagedFillSlot = useCallback(async (input: {
    contactId?: string | null
    accountId?: string | null
    role?: string
  }) => {
    hasStagedEditRef.current = true
    const cur: TeamMemberSlotCriterion = slotConfig.criterion
    const tempId = `staged-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const contactName = input.contactId ? resolveLookupDisplayName(input.contactId, 'Contact') : null
    const accountName = input.accountId ? resolveLookupDisplayName(input.accountId, 'Account') : null
    const data: Record<string, unknown> = {}
    if (input.contactId) data.contact = input.contactId
    if (input.accountId) data.account = input.accountId
    if (contactName && contactName !== '-') data.contactName = contactName
    if (accountName && accountName !== '-') data.accountName = accountName
    if (cur.kind === 'flag') {
      data[cur.flag] = true
      if (input.role) data.role = input.role
      setStagedRows(prev => [
        // Remove any rows that had this flag set (initial or previously staged)
        ...prev.filter(r => !r.data[cur.flag]),
        { id: tempId, isPending: true, data },
      ])
    } else {
      data.role = cur.role
      setStagedRows(prev => [...prev, { id: tempId, isPending: true, data }])
    }
    return { id: tempId, isPending: true, data } as TeamMemberRow
  }, [slotConfig.criterion])

  const stagedClearRow = useCallback(async (rowId: string) => {
    hasStagedEditRef.current = true
    setStagedRows(prev => prev.filter(r => r.id !== rowId))
  }, [])

  const applyChanges = useCallback(async () => {
    const initialRows = initialRowsRef.current
    const cur: TeamMemberSlotCriterion = slotConfig.criterion
    const parentField = OBJECT_TO_FIELD[parentObjectApiName]
    // Rows that were cleared (present in initial, absent from staged)
    const stagedRealIds = new Set(stagedRows.filter(r => !r.isPending).map(r => r.id))
    const clearedRows = initialRows.filter(r => !stagedRealIds.has(r.id))
    // TEMP DIAGNOSTIC — remove once the "connections not saving" bug is
    // confirmed fixed. Surfaces exactly what applyChanges() sees so we can
    // tell whether it's even being called with the right data instead of
    // guessing further.
    showToast(
      `[DEBUG] applyChanges: initial=${initialRows.length} staged=${stagedRows.length} ` +
      `cleared=${clearedRows.length} pending=${stagedRows.filter(r => r.isPending).length} ` +
      `parentRecordId=${parentRecordId ?? 'null'} parentField=${parentField ?? 'MISSING'}`,
      'success',
    )
    for (const row of clearedRows) {
      try {
        if (cur.kind === 'flag') {
          await apiClient.put(`/objects/TeamMember/records/${row.id}`, { data: { [cur.flag]: false } })
        } else {
          await apiClient.delete(`/objects/TeamMember/records/${row.id}`)
        }
      } catch { /* ignore not-found */ }
    }
    // Rows that were added (isPending: true in staged)
    const addedRows = stagedRows.filter(r => r.isPending)
    for (const row of addedRows) {
      const payload: Record<string, unknown> = { ...row.data }
      if (parentRecordId && parentField) payload[parentField] = parentRecordId
      try {
        await apiClient.post('/objects/TeamMember/records', { data: payload })
      } catch (e) {
        // TEMP DIAGNOSTIC — surface any create failure instead of letting
        // it disappear silently.
        showToast(
          `[DEBUG] TeamMember POST failed: ${e instanceof Error ? e.message : String(e)}`,
          'error',
        )
        throw e
      }
    }
    if (clearedRows.length > 0 || addedRows.length > 0) {
      notifyTeamMembersChanged()
    }
  }, [stagedRows, slotConfig.criterion, parentObjectApiName, parentRecordId, showToast])

  useImperativeHandle(ref, () => ({ applyChanges }), [applyChanges])

  // ── LIVE MODE ────────────────────────────────────────────────────────
  // When staged=true we pass null so the hook skips live fetching/mutations.
  const { rows: liveRows, loading: liveLoading, fillSlot, clearRow, error, occupiedRoles } = useTeamMemberSlot({
    parentObjectApiName,
    parentRecordId: staged ? null : parentRecordId,
    criterion: slotConfig.criterion,
    singleCardinalityRoles,
  })

  const rows = staged ? stagedRows : liveRows
  const loading = staged ? stagedLoading : liveLoading
  const activeFillSlot = staged ? stagedFillSlot : fillSlot
  const activeClearRow = staged ? stagedClearRow : clearRow

  const { fieldMap } = useDisplayFields({
    rows,
    displayFields: slotConfig.displayFields,
    enabled: !!readOnly,
  })
  const [showAdder, setShowAdder] = useState(false)

  // Preload Contact + Account lookup caches so the bound row's resolveLookupDisplayName
  // has data on first render rather than briefly showing the raw id.
  useEffect(() => {
    void preloadLookupRecords('Contact')
    void preloadLookupRecords('Account')
  }, [])

  const cardinality = slotConfig.cardinality ?? 'single'
  const mode = slotConfig.mode ?? 'paired'
  const labelText = panelField?.labelOverride || defaultLabel(slotConfig)
  const isRequired = panelField?.behavior === 'required'

  const labelStyle: React.CSSProperties = {
    ...(panelField?.labelStyle?.color ? { color: panelField.labelStyle.color } : {}),
    fontWeight: panelField?.labelStyle?.bold ? 700 : undefined,
    fontStyle: panelField?.labelStyle?.italic ? 'italic' : undefined,
    textTransform: panelField?.labelStyle?.uppercase ? 'uppercase' : undefined,
  }

  const renderBody = () => {
    if (loading && rows.length === 0) {
      return <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
    }
    if (readOnly) {
      if (rows.length === 0) {
        return <div className="text-sm text-gray-400">—</div>
      }

      const contactDisplayFields = slotConfig.displayFields?.Contact ?? []
      const accountDisplayFields = slotConfig.displayFields?.Account ?? []

      return (
        <div className="text-sm text-gray-900 space-y-2">
          {rows.map((row) => {
            const { contact, account, contactId, accountId } = resolveRowDisplay(row)
            if (!contact && !account) {
              return <div key={row.id} className="text-gray-400 italic">—</div>
            }
            const rowFields = fieldMap[row.id]
            return (
              <div key={row.id}>
                <div>
                  {contact && contactId ? (
                    <Link href={recordUrl('Contact', contactId)} className="font-medium text-blue-600 underline hover:text-blue-800">
                      {contact}
                    </Link>
                  ) : contact ? (
                    <span className="font-medium">{contact}</span>
                  ) : null}
                  {contact && account && <span className="text-gray-400 mx-1">&middot;</span>}
                  {account && accountId ? (
                    <Link href={recordUrl('Account', accountId)} className="text-blue-600 underline hover:text-blue-800">
                      {account}
                    </Link>
                  ) : account ? (
                    <span className="text-gray-700">{account}</span>
                  ) : null}
                </div>
                {contactDisplayFields.length > 0 && (
                  <DisplayFieldRows
                    fields={contactDisplayFields}
                    record={rowFields?.Contact}
                    objectApiName="Contact"
                  />
                )}
                {accountDisplayFields.length > 0 && (
                  <DisplayFieldRows
                    fields={accountDisplayFields}
                    record={rowFields?.Account}
                    objectApiName="Account"
                  />
                )}
              </div>
            )
          })}
        </div>
      )
    }
    if (cardinality === 'single') {
      const bound = rows[0]
      return bound ? (
        <SlotInput
          mode={mode}
          criterion={slotConfig.criterion}
          boundRow={bound}
          onFill={async () => { /* clear first to replace */ }}
          onClear={async () => {
            try {
              await activeClearRow(bound.id)
              showToast('Connection removed', 'success')
            } catch (e) {
              showToast(e instanceof Error ? e.message : 'Failed to remove connection', 'error')
            }
          }}
          placeholder={slotConfig.placeholder}
          occupiedRoles={occupiedRoles}
        />
      ) : (
        <SlotInput
          mode={mode}
          criterion={slotConfig.criterion}
          onFill={async (input) => { await activeFillSlot(input) }}
          placeholder={slotConfig.placeholder}
          occupiedRoles={occupiedRoles}
        />
      )
    }

    // Multi
    return (
      <div className="space-y-1.5">
        {rows.map(row => (
          <SlotInput
            key={row.id}
            mode={mode}
            criterion={slotConfig.criterion}
            boundRow={row}
            onFill={async () => { /* no-op while bound */ }}
            onClear={async () => {
              try {
                await activeClearRow(row.id)
                showToast('Connection removed', 'success')
              } catch (e) {
                showToast(e instanceof Error ? e.message : 'Failed to remove connection', 'error')
              }
            }}
            occupiedRoles={occupiedRoles}
          />
        ))}
        {showAdder ? (
          <div className="rounded-md border border-dashed border-gray-300 p-2">
            <SlotInput
              mode={mode}
              criterion={slotConfig.criterion}
              onFill={async (input) => {
                await activeFillSlot(input)
                setShowAdder(false)
              }}
              placeholder={slotConfig.placeholder ?? 'Add'}
              occupiedRoles={occupiedRoles}
            />
            <button
              type="button"
              onClick={() => setShowAdder(false)}
              className="mt-1 text-[11px] text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdder(true)}
            className="inline-flex items-center gap-1 text-xs text-brand-navy hover:text-brand-navy/80 font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            {rows.length === 0 ? 'Add' : 'Add another'}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs font-medium text-gray-500 mb-0.5" style={labelStyle}>
        {labelText}
        {isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </div>
      {error && <p className="text-xs text-red-600 mb-1">{error}</p>}
      {renderBody()}
    </div>
  )
}
)
