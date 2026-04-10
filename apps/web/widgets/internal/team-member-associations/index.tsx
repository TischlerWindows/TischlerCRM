'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Network, Edit2, Trash2, Check, X, Home, CornerDownRight } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import type { TeamMemberAssociationsConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'
import { FieldDisplay, getFieldValue } from '../shared/FieldDisplay'

// ── Types ──────────────────────────────────────────────────────────────

interface TeamMemberRecord {
  id: string
  data: Record<string, unknown>
}

interface AssociationRow {
  memberId: string
  objectApiName: string
  parentRecordId: string
  parentRecordName: string
  parentRecordData: Record<string, unknown>
  role: string
  isPrimary: boolean
  isContractHolder: boolean
}

interface PropertyGroup {
  propertyId: string
  propertyName: string
  propertyData: Record<string, unknown>
  direct: AssociationRow | null
  children: AssociationRow[]
}

type DisplayFieldsConfig = NonNullable<TeamMemberAssociationsConfig['displayFields']>

// ── Constants ──────────────────────────────────────────────────────────

const SUPPORTED_OBJECTS = ['Contact', 'Account']

const CHILD_FIELD_MAP: Array<{ objectApiName: string; fieldName: string; label: string }> = [
  { objectApiName: 'Opportunity',  fieldName: 'opportunity',  label: 'Opportunity' },
  { objectApiName: 'Project',      fieldName: 'project',      label: 'Project' },
  { objectApiName: 'WorkOrder',    fieldName: 'workOrder',    label: 'Work Order' },
  { objectApiName: 'Installation', fieldName: 'installation', label: 'Installation' },
]

const OBJECT_LABELS: Record<string, string> = {
  Property:     'Property',
  Opportunity:  'Opportunity',
  Project:      'Project',
  WorkOrder:    'Work Order',
  Installation: 'Installation',
}

const BADGE_COLORS: Record<string, string> = {
  Opportunity:  'bg-blue-100 text-blue-700',
  Project:      'bg-teal-100 text-teal-700',
  WorkOrder:    'bg-amber-100 text-amber-700',
  Installation: 'bg-orange-100 text-orange-700',
}

const ROLE_PICKLIST = [
  'Homeowner', 'General Contractor', 'Subcontractor', 'Architect / Designer',
  'Property Manager', 'Sales Rep', 'Installer', 'Inspector', 'Engineer', 'Other',
]

const DEDICATED_ROUTES: Record<string, string> = {
  Property:     '/properties',
  Account:      '/accounts',
  Contact:      '/contacts',
  Lead:         '/leads',
  Opportunity:  '/opportunities',
  Project:      '/projects',
  Product:      '/products',
  Installation: '/installations',
  Quote:        '/quotes',
  Service:      '/service',
  WorkOrder:    '/work-orders',
}

function recordUrl(objectApiName: string, recordId: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  return prefix ? `${prefix}/${recordId}` : `/objects/${objectApiName}/${recordId}`
}

// ── Generic field helpers ──────────────────────────────────────────────

/** Extract a field from any record shape (plain or with .data blob), tolerating prefixed keys */
function getField(raw: Record<string, unknown>, field: string): unknown {
  return getFieldValue(raw, field)
}

function getLookupId(raw: Record<string, unknown>, field: string): string {
  const v = getField(raw, field)
  if (!v) return ''
  if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
  return String(v)
}

function getStr(raw: Record<string, unknown>, field: string): string {
  const v = getField(raw, field)
  return v != null ? String(v) : ''
}

function getBool(raw: Record<string, unknown>, field: string): boolean {
  const v = getField(raw, field)
  return v === true || v === 'true'
}

/**
 * Robustly extract the Property ID from a child record (Opportunity, Project, etc.).
 * The same field can be stored under multiple key variants depending on how the
 * record was created (POST normalization keeps both prefixed and bare forms, but
 * PUT merges without stripping, so only the submitted key may exist).
 *
 * Mirrors the pattern used by the Dropbox route (`apps/api/src/routes/dropbox.ts`).
 */
function resolvePropertyId(raw: Record<string, unknown>, childObjectApiName: string): string {
  const d = (raw.data && typeof raw.data === 'object')
    ? raw.data as Record<string, unknown>
    : raw

  const candidates = [
    'property',
    `${childObjectApiName}__property`,
    'propertyId',
    `${childObjectApiName}__propertyId`,
    'property_id',
    `${childObjectApiName}__property_id`,
  ]

  for (const key of candidates) {
    const v = d[key]
    if (!v) continue
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
  }

  // Last resort: scan all keys for anything that normalises to "property" or "propertyid"
  for (const key of Object.keys(d)) {
    const normalised = key.toLowerCase().replace(/[^a-z]/g, '')
    if (normalised === 'property' || normalised === 'propertyid') {
      const v = d[key]
      if (typeof v === 'string' && v.trim()) return v.trim()
      if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
    }
  }

  return ''
}

/** Best-effort display name from any record shape */
function getRecordName(raw: Record<string, unknown>): string {
  const d = (raw.data && typeof raw.data === 'object')
    ? raw.data as Record<string, unknown>
    : raw

  // First/last name pairs
  for (const key of Object.keys(d)) {
    if (key.endsWith('__firstName') || key === 'firstName') {
      const val = d[key]
      if (val && String(val).trim()) {
        const prefix = key.replace(/__firstName$/, '')
        const lastName = d[`${prefix}__lastName`] ?? d.lastName
        if (lastName) return `${String(val)} ${String(lastName)}`
        return String(val)
      }
    }
  }

  // Fields ending in 'name' (opportunityName, projectName, etc.)
  for (const key of Object.keys(d)) {
    const lower = key.toLowerCase()
    if (
      (lower.endsWith('name') || lower.endsWith('__name')) &&
      !lower.includes('firstname') && !lower.includes('lastname')
    ) {
      const val = d[key]
      if (val && typeof val === 'string' && val.trim()) return val
    }
  }

  if (d.name && typeof d.name === 'string' && d.name.trim()) return d.name
  if (d.title && typeof d.title === 'string' && d.title.trim()) return d.title as string

  // Auto-number fields: propertyNumber, opportunityNumber, projectNumber, etc.
  // These are the primary identifiers in the CRM and the only meaningful label for
  // objects like Property that have no separate "name" field.
  for (const key of Object.keys(d)) {
    const bare = key.replace(/^[A-Za-z]+__/, '').toLowerCase()
    if (bare.endsWith('number') && !bare.includes('phone') && !bare.includes('mobile')) {
      const val = d[key]
      if (val && typeof val === 'string' && val.trim()) return val
    }
  }

  return 'Unnamed'
}

// ── Skeleton ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-12 ml-auto" />
      </div>
      <div className="p-3 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-2 bg-gray-100 rounded w-2/3 ml-5" />
            <div className="h-2 bg-gray-100 rounded w-1/2 ml-5" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Object type badge ──────────────────────────────────────────────────

function ObjectBadge({ objectApiName }: { objectApiName: string }) {
  const cls = BADGE_COLORS[objectApiName] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {OBJECT_LABELS[objectApiName] ?? objectApiName}
    </span>
  )
}

// ── Role + flag badges ─────────────────────────────────────────────────

function AssocBadges({ role, isPrimary, isContractHolder }: {
  role: string
  isPrimary: boolean
  isContractHolder: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1 mt-0.5">
      {role && (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-navy/10 text-brand-navy">
          {role}
        </span>
      )}
      {isPrimary && (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
          Primary
        </span>
      )}
      {isContractHolder && (
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
          Contract Holder
        </span>
      )}
    </div>
  )
}

// ── Inline edit form ───────────────────────────────────────────────────

function InlineEditForm({
  role, isPrimary, isContractHolder, saving,
  onRole, onPrimary, onContractHolder, onSave, onCancel,
}: {
  role: string
  isPrimary: boolean
  isContractHolder: boolean
  saving: boolean
  onRole: (v: string) => void
  onPrimary: (v: boolean) => void
  onContractHolder: (v: boolean) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <div className="mt-1.5 space-y-1.5">
      <select
        value={role}
        onChange={e => onRole(e.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand-navy"
      >
        <option value="">-- Select Role --</option>
        {ROLE_PICKLIST.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
          <input type="checkbox" checked={isPrimary} onChange={e => onPrimary(e.target.checked)} className="rounded border-gray-300" />
          Primary
        </label>
        <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
          <input type="checkbox" checked={isContractHolder} onChange={e => onContractHolder(e.target.checked)} className="rounded border-gray-300" />
          Contract Holder
        </label>
      </div>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-brand-navy text-white text-[10px] font-medium hover:bg-brand-navy/90 disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-200 text-[10px] text-brand-gray hover:bg-gray-50"
        >
          <X className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Single association row ─────────────────────────────────────────────

interface AssocRowProps {
  assoc: AssociationRow
  isChild: boolean
  /** Configured display fields for this row's object type */
  fieldValues: string[]
  editingId: string | null
  editRole: string
  editPrimary: boolean
  editContractHolder: boolean
  saving: boolean
  onStartEdit: (assoc: AssociationRow) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditRole: (v: string) => void
  onEditPrimary: (v: boolean) => void
  onEditContractHolder: (v: boolean) => void
  onDelete: (memberId: string) => void
}

function AssocRow({
  assoc, isChild, fieldValues,
  editingId, editRole, editPrimary, editContractHolder, saving,
  onStartEdit, onSaveEdit, onCancelEdit, onEditRole, onEditPrimary, onEditContractHolder,
  onDelete,
}: AssocRowProps) {
  const isEditing = editingId === assoc.memberId

  return (
    <div className={`group ${isChild ? 'ml-5 pl-3 border-l-2 border-gray-200' : ''}`}>
      <div className="flex items-start gap-1.5">
        {isChild && (
          <CornerDownRight className="w-3 h-3 text-gray-300 shrink-0 mt-0.5" />
        )}

        <div className="flex-1 min-w-0">
          {isChild && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href={recordUrl(assoc.objectApiName, assoc.parentRecordId)}
                className="text-xs font-semibold text-brand-navy hover:underline"
              >
                {assoc.parentRecordName}
              </Link>
              <ObjectBadge objectApiName={assoc.objectApiName} />
            </div>
          )}

          {!isChild && (
            <span className="text-[10px] font-semibold text-brand-gray uppercase tracking-wide">
              Direct association
            </span>
          )}

          {/* Configured display fields for the child record */}
          {isChild && fieldValues.length > 0 && (
            <FieldDisplay data={assoc.parentRecordData} fields={fieldValues} />
          )}

          {isEditing ? (
            <InlineEditForm
              role={editRole}
              isPrimary={editPrimary}
              isContractHolder={editContractHolder}
              saving={saving}
              onRole={onEditRole}
              onPrimary={onEditPrimary}
              onContractHolder={onEditContractHolder}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <AssocBadges
              role={assoc.role}
              isPrimary={assoc.isPrimary}
              isContractHolder={assoc.isContractHolder}
            />
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => onStartEdit(assoc)}
              className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(assoc.memberId)}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Property group tile ────────────────────────────────────────────────

type EditHandlers = Pick<AssocRowProps,
  'editingId' | 'editRole' | 'editPrimary' | 'editContractHolder' | 'saving' |
  'onStartEdit' | 'onSaveEdit' | 'onCancelEdit' |
  'onEditRole' | 'onEditPrimary' | 'onEditContractHolder' | 'onDelete'
>

function PropertyGroupTile({
  group,
  displayFields,
  ...edit
}: { group: PropertyGroup; displayFields: DisplayFieldsConfig } & EditHandlers) {
  const propertyFields = displayFields.Property ?? []

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm p-3 transition-all space-y-2">
      {/* Property header */}
      <div className="flex items-center gap-1.5">
        <Home className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <Link
            href={recordUrl('Property', group.propertyId)}
            className="text-xs font-semibold text-brand-dark hover:text-brand-navy hover:underline block truncate"
          >
            {group.propertyName}
          </Link>
          <FieldDisplay data={group.propertyData} fields={propertyFields} />
        </div>
      </div>

      {/* Direct property-level association */}
      {group.direct && (
        <AssocRow assoc={group.direct} isChild={false} fieldValues={[]} {...edit} />
      )}

      {/* Child associations (Opp, Project, etc.) */}
      {group.children.map(child => (
        <AssocRow
          key={child.memberId}
          assoc={child}
          isChild
          fieldValues={displayFields[child.objectApiName as keyof DisplayFieldsConfig] ?? []}
          {...edit}
        />
      ))}
    </div>
  )
}

// ── Flat tile (child record with no property) ──────────────────────────

function FlatTile({
  assoc,
  displayFields,
  ...edit
}: { assoc: AssociationRow; displayFields: DisplayFieldsConfig } & EditHandlers) {
  const isEditing = edit.editingId === assoc.memberId
  const fieldValues = displayFields[assoc.objectApiName as keyof DisplayFieldsConfig] ?? []

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm p-3 transition-all group">
      <div className="flex items-start gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              href={recordUrl(assoc.objectApiName, assoc.parentRecordId)}
              className="text-xs font-semibold text-brand-navy hover:underline"
            >
              {assoc.parentRecordName}
            </Link>
            <ObjectBadge objectApiName={assoc.objectApiName} />
          </div>

          {fieldValues.length > 0 && (
            <FieldDisplay data={assoc.parentRecordData} fields={fieldValues} />
          )}

          {isEditing ? (
            <InlineEditForm
              role={edit.editRole}
              isPrimary={edit.editPrimary}
              isContractHolder={edit.editContractHolder}
              saving={edit.saving}
              onRole={edit.onEditRole}
              onPrimary={edit.onEditPrimary}
              onContractHolder={edit.onEditContractHolder}
              onSave={edit.onSaveEdit}
              onCancel={edit.onCancelEdit}
            />
          ) : (
            <AssocBadges
              role={assoc.role}
              isPrimary={assoc.isPrimary}
              isContractHolder={assoc.isContractHolder}
            />
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => edit.onStartEdit(assoc)}
              className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => edit.onDelete(assoc.memberId)}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function TeamMemberAssociationsWidget({ config, record, object }: WidgetProps) {
  const typedConfig = config as TeamMemberAssociationsConfig
  const { label } = typedConfig
  const displayFields: DisplayFieldsConfig = typedConfig.displayFields ?? {}
  const objectApiName = object.apiName
  const recordId = record?.id ? String(record.id) : null
  const isSupported = SUPPORTED_OBJECTS.includes(objectApiName)

  // ── State ──
  const [propertyGroups, setPropertyGroups] = useState<PropertyGroup[]>([])
  const [flatTiles, setFlatTiles] = useState<AssociationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline-edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editPrimary, setEditPrimary] = useState(false)
  const [editContractHolder, setEditContractHolder] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── 3-phase data fetch ──
  const fetchAssociations = useCallback(async () => {
    if (!recordId || !isSupported) return
    setLoading(true)
    setError(null)

    try {
      // ── Phase 1: Fetch TeamMember records for this contact/account ──
      const linkField = objectApiName === 'Contact' ? 'contact' : 'account'
      const [plain, prefixed] = await Promise.all([
        apiClient.get<TeamMemberRecord[]>(
          `/objects/TeamMember/records?filter[${linkField}]=${encodeURIComponent(recordId)}&limit=200`
        ).catch(() => [] as TeamMemberRecord[]),
        apiClient.get<TeamMemberRecord[]>(
          `/objects/TeamMember/records?filter[TeamMember__${linkField}]=${encodeURIComponent(recordId)}&limit=200`
        ).catch(() => [] as TeamMemberRecord[]),
      ])

      // Deduplicate
      const seen = new Set<string>()
      const members: TeamMemberRecord[] = []
      for (const m of [
        ...(Array.isArray(plain) ? plain : []),
        ...(Array.isArray(prefixed) ? prefixed : []),
      ]) {
        if (!seen.has(String(m.id))) { seen.add(String(m.id)); members.push(m) }
      }

      // ── Phase 2: Resolve child records to find their parent Property ──
      type DirectEntry = { member: TeamMemberRecord; propertyId: string }
      type ChildEntry  = {
        member: TeamMemberRecord
        objectApiName: string
        fieldName: string
        childRecordId: string
      }

      const directEntries: DirectEntry[] = []
      const childEntries: ChildEntry[] = []

      for (const member of members) {
        const raw = member as unknown as Record<string, unknown>
        const propertyId = getLookupId(raw, 'property')
        if (propertyId) {
          directEntries.push({ member, propertyId })
          continue
        }
        for (const { objectApiName: childType, fieldName } of CHILD_FIELD_MAP) {
          const childId = getLookupId(raw, fieldName)
          if (childId) {
            childEntries.push({ member, objectApiName: childType, fieldName, childRecordId: childId })
            break
          }
        }
      }

      // Fetch each child record to get its property link, display name, and full data
      const childRecordResults = await Promise.allSettled(
        childEntries.map(entry =>
          apiClient
            .get<Record<string, unknown>>(`/objects/${entry.objectApiName}/records/${entry.childRecordId}`)
            .then(data => ({ entry, data }))
            .catch(() => ({ entry, data: null as Record<string, unknown> | null }))
        )
      )

      // Build map: childRecordId → { propertyId, recordName, recordData }
      const childMeta = new Map<string, {
        propertyId: string
        recordName: string
        recordData: Record<string, unknown>
      }>()
      for (const result of childRecordResults) {
        if (result.status === 'fulfilled' && result.value.data) {
          const { entry, data } = result.value
          const propertyId = resolvePropertyId(data, entry.objectApiName)
          const recordName = getRecordName(data)
          childMeta.set(entry.childRecordId, { propertyId, recordName, recordData: data })
        }
      }

      // ── Phase 3: Batch-resolve Property display names and data ──
      const propertyIds = new Set<string>()
      for (const { propertyId } of directEntries) propertyIds.add(propertyId)
      for (const meta of childMeta.values()) {
        if (meta.propertyId) propertyIds.add(meta.propertyId)
      }

      const propertyNames = new Map<string, string>()
      const propertyDataMap = new Map<string, Record<string, unknown>>()

      await Promise.allSettled(
        Array.from(propertyIds).map(pid =>
          apiClient
            .get<Record<string, unknown>>(`/objects/Property/records/${pid}`)
            .then(data => {
              const d = data as Record<string, unknown>
              propertyNames.set(pid, getRecordName(d) || pid)
              propertyDataMap.set(pid, d)
            })
        )
      )

      // ── Build PropertyGroup map ──
      const groupMap = new Map<string, PropertyGroup>()

      const getOrCreate = (propertyId: string): PropertyGroup => {
        if (!groupMap.has(propertyId)) {
          groupMap.set(propertyId, {
            propertyId,
            propertyName: propertyNames.get(propertyId) ?? propertyId,
            propertyData: propertyDataMap.get(propertyId) ?? {},
            direct: null,
            children: [],
          })
        }
        return groupMap.get(propertyId)!
      }

      // Direct property associations
      for (const { member, propertyId } of directEntries) {
        const raw = member as unknown as Record<string, unknown>
        const group = getOrCreate(propertyId)
        group.direct = {
          memberId: String(member.id),
          objectApiName: 'Property',
          parentRecordId: propertyId,
          parentRecordName: propertyNames.get(propertyId) ?? propertyId,
          parentRecordData: propertyDataMap.get(propertyId) ?? {},
          role: getStr(raw, 'role'),
          isPrimary: getBool(raw, 'primaryContact'),
          isContractHolder: getBool(raw, 'contractHolder'),
        }
      }

      // Child associations
      const newFlatTiles: AssociationRow[] = []
      for (const entry of childEntries) {
        const raw = entry.member as unknown as Record<string, unknown>
        const meta = childMeta.get(entry.childRecordId)
        const recordName = meta?.recordName ?? entry.childRecordId
        const propertyId = meta?.propertyId ?? ''

        const row: AssociationRow = {
          memberId: String(entry.member.id),
          objectApiName: entry.objectApiName,
          parentRecordId: entry.childRecordId,
          parentRecordName: recordName,
          parentRecordData: meta?.recordData ?? {},
          role: getStr(raw, 'role'),
          isPrimary: getBool(raw, 'primaryContact'),
          isContractHolder: getBool(raw, 'contractHolder'),
        }

        if (propertyId) {
          getOrCreate(propertyId).children.push(row)
        } else {
          newFlatTiles.push(row)
        }
      }

      // Sort groups alphabetically by property name
      const sorted = Array.from(groupMap.values()).sort((a, b) =>
        a.propertyName.localeCompare(b.propertyName)
      )

      setPropertyGroups(sorted)
      setFlatTiles(newFlatTiles)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load associations')
    } finally {
      setLoading(false)
    }
  }, [recordId, objectApiName, isSupported])

  useEffect(() => {
    fetchAssociations()
  }, [fetchAssociations])

  // ── Edit handlers ──
  const startEdit = (assoc: AssociationRow) => {
    setEditingId(assoc.memberId)
    setEditRole(assoc.role)
    setEditPrimary(assoc.isPrimary)
    setEditContractHolder(assoc.isContractHolder)
  }

  const saveEdit = async () => {
    if (!editingId) return
    setSaving(true)
    try {
      await apiClient.put(`/objects/TeamMember/records/${editingId}`, {
        data: { role: editRole, primaryContact: editPrimary, contractHolder: editContractHolder },
      })
      setEditingId(null)
      await fetchAssociations()
    } catch {
      // keep editing open on failure
    } finally {
      setSaving(false)
    }
  }

  // ── Delete handler ──
  const handleDelete = async (memberId: string) => {
    setDeletingId(memberId)
    try {
      await apiClient.delete(`/objects/TeamMember/records/${memberId}`)
      setDeleteTarget(null)
      await fetchAssociations()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  // ── Shared edit props passed down to every row ──
  const editHandlers: EditHandlers = {
    editingId,
    editRole,
    editPrimary,
    editContractHolder,
    saving,
    onStartEdit: startEdit,
    onSaveEdit: saveEdit,
    onCancelEdit: () => setEditingId(null),
    onEditRole: setEditRole,
    onEditPrimary: setEditPrimary,
    onEditContractHolder: setEditContractHolder,
    onDelete: setDeleteTarget,
  }

  const totalCount =
    propertyGroups.reduce((n, g) => n + (g.direct ? 1 : 0) + g.children.length, 0) +
    flatTiles.length

  // ── Unsupported object ──
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        Team Member Associations is not available for {object.label}.
      </div>
    )
  }

  if (loading && propertyGroups.length === 0 && flatTiles.length === 0) return <Skeleton />

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  const widgetLabel = label || 'Team Member Associations'

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* ── Header ── */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <Network className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-dark flex-1">{widgetLabel}</h3>
          <span className="text-[11px] text-brand-gray tabular-nums">
            {totalCount} association{totalCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Body ── */}
        {totalCount === 0 ? (
          <div className="p-8 text-center">
            <Network className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-brand-gray">No associated records found</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {propertyGroups.map(group => (
              <PropertyGroupTile
                key={group.propertyId}
                group={group}
                displayFields={displayFields}
                {...editHandlers}
              />
            ))}

            {flatTiles.length > 0 && (
              <>
                {propertyGroups.length > 0 && (
                  <p className="text-[10px] font-semibold text-brand-gray uppercase tracking-wide px-1 pt-1">
                    Other
                  </p>
                )}
                {flatTiles.map(assoc => (
                  <FlatTile
                    key={assoc.memberId}
                    assoc={assoc}
                    displayFields={displayFields}
                    {...editHandlers}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-brand-dark">Remove association?</p>
              <p className="text-xs text-brand-gray">
                This removes the team member assignment from the related record. The record itself is not affected.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingId === deleteTarget}
                  onClick={() => handleDelete(deleteTarget)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === deleteTarget ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
