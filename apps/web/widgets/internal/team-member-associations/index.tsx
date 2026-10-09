'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  Network, Edit2, Trash2, Check, X, Home, CornerDownRight,
  ChevronDown, ChevronRight, Search,
  Target, Briefcase, Wrench, Truck, Megaphone,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { getConnectionRoleFieldApiName, getConnectionRoleFieldBareName, getConnectionTargetObject, type FieldDef, type TeamMemberAssociationsConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'
import { useSchemaStore } from '@/lib/schema-store'
import { useAuth } from '@/lib/auth-context'
import { getPageLayoutFieldApiNames } from '@/lib/layout-migration'
import { resolveLayoutForUser } from '@/lib/layout-resolver'
import { FieldDisplay } from '../shared/FieldDisplay'
import { ConnectionBadges } from '../shared/ConnectionBadges'
import { getRecordName } from '../shared/recordName'

// ── Types ──────────────────────────────────────────────────────────────

interface AssociationRow {
  memberId: string
  objectApiName: string
  connectionFieldApiName?: string
  parentRecordId: string
  parentRecordName: string
  parentRecordData: Record<string, unknown>
  role: string
  roles?: string[]
  isPrimary: boolean
  isContractHolder: boolean
  isQuoteRecipient: boolean
  isLookupConnection?: boolean
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

const OBJECT_LABELS: Record<string, string> = {
  Property:     'Property',
  Opportunity:  'Opportunity',
  Project:      'Project',
  WorkOrder:    'Work Order',
  Installation: 'Installation',
  Lead:         'Lead',
}

const BADGE_COLORS: Record<string, string> = {
  Opportunity:  'bg-blue-100 text-blue-700',
  Project:      'bg-teal-100 text-teal-700',
  WorkOrder:    'bg-amber-100 text-amber-700',
  Installation: 'bg-orange-100 text-orange-700',
  Lead:         'bg-pink-100 text-pink-700',
  Property:     'bg-purple-100 text-purple-700',
}

const OBJECT_ICONS: Record<string, LucideIcon> = {
  Property:     Home,
  Opportunity:  Target,
  Project:      Briefcase,
  WorkOrder:    Wrench,
  Installation: Truck,
  Lead:         Megaphone,
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

// `getRecordName` lives in shared/recordName.ts so it stays in sync with the
// rollup widget's resolution policy (composite-name "N/A" filter, address
// fallback, etc.). See that file for the priority order.

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
  const Icon = OBJECT_ICONS[objectApiName]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {Icon && <Icon className="w-2.5 h-2.5" aria-hidden />}
      {OBJECT_LABELS[objectApiName] ?? objectApiName}
    </span>
  )
}

// ── Inline edit form ───────────────────────────────────────────────────

function InlineEditForm({
  role, isPrimary, isContractHolder, isQuoteRecipient, saving,
  onRole, onPrimary, onContractHolder, onQuoteRecipient, onSave, onCancel,
}: {
  role: string
  isPrimary: boolean
  isContractHolder: boolean
  isQuoteRecipient: boolean
  saving: boolean
  onRole: (v: string) => void
  onPrimary: (v: boolean) => void
  onContractHolder: (v: boolean) => void
  onQuoteRecipient: (v: boolean) => void
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
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1">
        <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
          <input type="checkbox" checked={isPrimary} onChange={e => onPrimary(e.target.checked)} className="rounded border-gray-300" />
          Primary
        </label>
        <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
          <input type="checkbox" checked={isContractHolder} onChange={e => onContractHolder(e.target.checked)} className="rounded border-gray-300" />
          Contract Holder
        </label>
        <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
          <input type="checkbox" checked={isQuoteRecipient} onChange={e => onQuoteRecipient(e.target.checked)} className="rounded border-gray-300" />
          Quote Recipient
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
  editQuoteRecipient: boolean
  saving: boolean
  onStartEdit: (assoc: AssociationRow) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditRole: (v: string) => void
  onEditPrimary: (v: boolean) => void
  onEditContractHolder: (v: boolean) => void
  onEditQuoteRecipient: (v: boolean) => void
  onDelete: (memberId: string) => void
}

function AssocRow({
  assoc, isChild, fieldValues,
  editingId, editRole, editPrimary, editContractHolder, editQuoteRecipient, saving,
  onStartEdit, onSaveEdit, onCancelEdit, onEditRole, onEditPrimary, onEditContractHolder, onEditQuoteRecipient,
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
              isQuoteRecipient={editQuoteRecipient}
              saving={saving}
              onRole={onEditRole}
              onPrimary={onEditPrimary}
              onContractHolder={onEditContractHolder}
              onQuoteRecipient={onEditQuoteRecipient}
              onSave={onSaveEdit}
              onCancel={onCancelEdit}
            />
          ) : (
            <ConnectionBadges
              role={assoc.role}
              roles={assoc.roles}
              flags={{
                primary: assoc.isPrimary,
                contractHolder: assoc.isContractHolder,
                quoteRecipient: assoc.isQuoteRecipient,
              }}
            />
          )}
        </div>

        {!isEditing && !assoc.isLookupConnection && (
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
  'editingId' | 'editRole' | 'editPrimary' | 'editContractHolder' | 'editQuoteRecipient' | 'saving' |
  'onStartEdit' | 'onSaveEdit' | 'onCancelEdit' |
  'onEditRole' | 'onEditPrimary' | 'onEditContractHolder' | 'onEditQuoteRecipient' | 'onDelete'
>

function PropertyGroupTile({
  group,
  displayFields,
  collapsed,
  onToggleCollapsed,
  ...edit
}: { group: PropertyGroup; displayFields: DisplayFieldsConfig; collapsed: boolean; onToggleCollapsed: () => void } & EditHandlers) {
  const propertyFields = displayFields.Property ?? []
  const childCount = (group.direct ? 1 : 0) + group.children.length

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm p-3 transition-all space-y-2">
      {/* Property header */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand group' : 'Collapse group'}
          className="text-gray-400 hover:text-brand-navy shrink-0"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        <Home className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1 min-w-0">
          <Link
            href={recordUrl('Property', group.propertyId)}
            className="text-xs font-semibold text-brand-dark hover:text-brand-navy hover:underline block truncate"
          >
            {group.propertyName}
          </Link>
          <FieldDisplay data={group.propertyData} fields={propertyFields} />
        </div>
        {collapsed && (
          <span className="text-[10px] text-brand-gray tabular-nums shrink-0">
            {childCount} connection{childCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {!collapsed && group.direct && (
        <AssocRow assoc={group.direct} isChild={false} fieldValues={[]} {...edit} />
      )}

      {!collapsed && group.children.map(child => (
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
              isQuoteRecipient={edit.editQuoteRecipient}
              saving={edit.saving}
              onRole={edit.onEditRole}
              onPrimary={edit.onEditPrimary}
              onContractHolder={edit.onEditContractHolder}
              onQuoteRecipient={edit.onEditQuoteRecipient}
              onSave={edit.onSaveEdit}
              onCancel={edit.onCancelEdit}
            />
          ) : (
            <ConnectionBadges
              role={assoc.role}
              roles={assoc.roles}
              flags={{
                primary: assoc.isPrimary,
                contractHolder: assoc.isContractHolder,
                quoteRecipient: assoc.isQuoteRecipient,
              }}
            />
          )}
        </div>

        {!isEditing && !assoc.isLookupConnection && (
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
  const recordData = record?.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : record as Record<string, unknown> | undefined
  const connectionTypeField = objectApiName === 'Contact' ? 'contactType' : 'accountType'
  const connectedRecordType = String(
    recordData?.[`${objectApiName}__${connectionTypeField}`]
    ?? recordData?.[connectionTypeField]
    ?? '',
  ).trim()
  const recordId = record?.id ? String(record.id) : null
  const isSupported = SUPPORTED_OBJECTS.includes(objectApiName)
  const schema = useSchemaStore(state => state.schema)
  const { user } = useAuth()
  const connectionFields = useMemo(() => (schema?.objects ?? []).flatMap(sourceObject => {
    const resolved = resolveLayoutForUser(sourceObject, { profileId: user?.profileId ?? null })
    const placedFields = resolved.kind === 'resolved' ? getPageLayoutFieldApiNames(resolved.layout) : new Set<string>()
    return sourceObject.fields
      .filter((field: FieldDef) => placedFields.has(field.apiName)
        && (field.type === 'ConnectionContact' || field.type === 'ConnectionAccount')
        && getConnectionTargetObject(field.type, field.lookupObject) === objectApiName)
      .map((field: FieldDef) => ({ sourceApiName: sourceObject.apiName, field }))
  }), [schema, objectApiName, user?.profileId])

  // ── State ──
  const [propertyGroups, setPropertyGroups] = useState<PropertyGroup[]>([])
  const [flatTiles, setFlatTiles] = useState<AssociationRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Search / filter
  const [search, setSearch] = useState('')

  // Collapse state (per-property). Initialised lazily once we know how many
  // groups we have — when > 10, default-collapse.
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [collapseInitialised, setCollapseInitialised] = useState(false)

  // ── 3-phase data fetch ──
  const fetchAssociations = useCallback(async () => {
    if (!recordId || !isSupported) return
    setLoading(true)
    setError(null)

    try {
      const connectionResults = await Promise.allSettled(connectionFields.map(async ({ sourceApiName, field }) => {
        const query = new URLSearchParams({ [`filter[${field.apiName}]`]: recordId, limit: '200' })
        const records = await apiClient.get<Record<string, unknown>[]>(
          `/objects/${encodeURIComponent(sourceApiName)}/records?${query.toString()}`,
        )
        return records.map(connectedRecord => ({ sourceApiName, field, connectedRecord }))
      }))
      const lookupConnections = connectionResults.flatMap(result => (
        result.status === 'fulfilled' ? result.value : []
      ))

      const propertyIds = new Set<string>()
      const propertyIdByConnection = lookupConnections.map(({ sourceApiName, connectedRecord }) => {
        const propertyId = sourceApiName === 'Property'
          ? String(connectedRecord.id ?? '')
          : resolvePropertyId(connectedRecord, sourceApiName)
        if (propertyId) propertyIds.add(propertyId)
        return propertyId
      })

      const propertyNames = new Map<string, string>()
      const propertyDataMap = new Map<string, Record<string, unknown>>()
      await Promise.allSettled(
        Array.from(propertyIds).map(pid =>
          apiClient
            .get<Record<string, unknown>>(`/objects/Property/records/${pid}`)
            .then(data => {
              propertyNames.set(pid, getRecordName(data) || pid)
              propertyDataMap.set(pid, data)
            })
        )
      )

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
      const newFlatTiles: AssociationRow[] = []
      for (const [index, { sourceApiName, field, connectedRecord }] of lookupConnections.entries()) {
        const recordData = connectedRecord.data && typeof connectedRecord.data === 'object'
          ? connectedRecord.data as Record<string, unknown>
          : connectedRecord
        const roleApiName = getConnectionRoleFieldApiName(field.apiName)
        const roleBareName = getConnectionRoleFieldBareName(field.apiName)
        const savedRole = recordData[roleApiName] ?? recordData[roleBareName]
        const role = typeof savedRole === 'string' && savedRole.trim()
          ? savedRole.trim()
          : (field.type === 'ConnectionContact' || field.type === 'ConnectionAccount') && connectedRecordType
            ? connectedRecordType
            : field.label
        const row: AssociationRow = {
          memberId: `connection:${sourceApiName}:${field.apiName}:${String(connectedRecord.id)}`,
          objectApiName: sourceApiName,
          connectionFieldApiName: field.apiName,
          parentRecordId: String(connectedRecord.id ?? ''),
          parentRecordName: getRecordName(connectedRecord),
          parentRecordData: recordData,
          role,
          roles: (field.type === 'ConnectionContact' || field.type === 'ConnectionAccount') && connectedRecordType
            ? Array.from(new Set([role, field.label].filter(Boolean)))
            : [role],
          isPrimary: false,
          isContractHolder: false,
          isQuoteRecipient: false,
          isLookupConnection: true,
        }
        const propertyId = propertyIdByConnection[index] ?? ''
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
  }, [recordId, objectApiName, isSupported, connectionFields, connectedRecordType])

  useEffect(() => {
    fetchAssociations()
  }, [fetchAssociations])

  // ── Shared edit props passed down to every row ──
  const editHandlers: EditHandlers = {
    editingId: null,
    editRole: '',
    editPrimary: false,
    editContractHolder: false,
    editQuoteRecipient: false,
    saving: false,
    onStartEdit: () => {},
    onSaveEdit: () => {},
    onCancelEdit: () => {},
    onEditRole: () => {},
    onEditPrimary: () => {},
    onEditContractHolder: () => {},
    onEditQuoteRecipient: () => {},
    onDelete: () => {},
  }

  const visibleGroups = useMemo(() => propertyGroups
    .map(group => ({
      ...group,
      direct: null,
      children: group.children.filter(row => connectionFields.some(({ sourceApiName, field }) =>
        sourceApiName === row.objectApiName && field.apiName === row.connectionFieldApiName,
      )),
    }))
    .filter(group => group.children.length > 0), [propertyGroups, connectionFields])
  const visibleFlatTiles = useMemo(() => flatTiles.filter(row => connectionFields.some(({ sourceApiName, field }) =>
    sourceApiName === row.objectApiName && field.apiName === row.connectionFieldApiName,
  )), [flatTiles, connectionFields])
  const totalCount = visibleGroups.reduce((count, group) => count + group.children.length, 0) + visibleFlatTiles.length

  // ── Filtered view (search query) ──
  const filteredView = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return { groups: visibleGroups, flatTiles: visibleFlatTiles, hidden: 0 }
    const matchRow = (row: AssociationRow) =>
      row.parentRecordName.toLowerCase().includes(q) ||
      row.role.toLowerCase().includes(q)
    const groups: PropertyGroup[] = []
    let hidden = 0
    for (const g of visibleGroups) {
      const propMatches = g.propertyName.toLowerCase().includes(q)
      const directMatches = g.direct ? matchRow(g.direct) : false
      const children = g.children.filter(matchRow)
      if (propMatches) {
        // Whole group surfaces with all its rows
        groups.push(g)
      } else if (directMatches || children.length > 0) {
        groups.push({
          ...g,
          direct: directMatches ? g.direct : null,
          children,
        })
      } else {
        hidden += (g.direct ? 1 : 0) + g.children.length
      }
    }
    const filteredFlat = visibleFlatTiles.filter(matchRow)
    hidden += visibleFlatTiles.length - filteredFlat.length
    return { groups, flatTiles: filteredFlat, hidden }
  }, [visibleGroups, visibleFlatTiles, search])

  // Default-collapse heuristic: once results are loaded and the user hasn't
  // toggled anything yet, collapse all groups when there are > 10 of them.
  useEffect(() => {
    if (collapseInitialised) return
    if (propertyGroups.length === 0) return
    if (propertyGroups.length > 10) {
      setCollapsedIds(new Set(propertyGroups.map(g => g.propertyId)))
    }
    setCollapseInitialised(true)
  }, [propertyGroups, collapseInitialised])

  const toggleCollapsed = useCallback((propertyId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev)
      if (next.has(propertyId)) next.delete(propertyId)
      else next.add(propertyId)
      return next
    })
  }, [])

  // ── Unsupported object ──
  // Render nothing when placed on an object the widget doesn't support —
  // matches team-members-rollup's behavior to avoid showing a confusing
  // "not available" banner to end users when admins place the widget on
  // a layout where it can't render meaningful data.
  if (!isSupported) {
    return null
  }

  if (loading && propertyGroups.length === 0 && flatTiles.length === 0) return <Skeleton />

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  const widgetLabel = label || 'Connections'
  const showSearchBar = totalCount > 5
  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* ── Header ── */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <Network className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-dark flex-1">{widgetLabel}</h3>
          <span className="text-[11px] text-brand-gray tabular-nums">
            {totalCount} connection{totalCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Search bar ── */}
        {showSearchBar && (
          <div className="px-4 py-2 border-b border-gray-50 dark:border-gray-800 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" aria-hidden />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by property, role, or record name…"
                aria-label="Filter connections"
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 pl-8 pr-3 py-1.5 text-xs text-brand-dark dark:text-gray-100 outline-none focus:border-brand-navy transition"
              />
            </div>
            {filteredView.hidden > 0 && (
              <span className="text-[11px] text-brand-gray tabular-nums shrink-0">
                {filteredView.hidden} hidden
              </span>
            )}
          </div>
        )}

        {/* ── Body ── */}
        {totalCount === 0 ? (
          <div className="p-8 text-center">
            <Network className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-brand-gray">{object.label || 'This record'} isn&apos;t connected to any records yet.</p>
          </div>
        ) : filteredView.groups.length === 0 && filteredView.flatTiles.length === 0 ? (
          <div className="p-8 text-center">
            <Search className="w-7 h-7 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-brand-gray">No connections match &ldquo;{search}&rdquo;.</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="mt-2 text-[11px] font-medium text-brand-navy hover:underline"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {filteredView.groups.map(group => (
              <PropertyGroupTile
                key={group.propertyId}
                group={group}
                displayFields={displayFields}
                collapsed={collapsedIds.has(group.propertyId)}
                onToggleCollapsed={() => toggleCollapsed(group.propertyId)}
                {...editHandlers}
              />
            ))}

            {filteredView.flatTiles.length > 0 && (
              <>
                {filteredView.groups.length > 0 && (
                  <p className="text-[10px] font-semibold text-brand-gray uppercase tracking-wide px-1 pt-1">
                    Other
                  </p>
                )}
                {filteredView.flatTiles.map(assoc => (
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

    </>
  )
}
