'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { Network, Edit2, Trash2, Check, X } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'

// ── Types ──────────────────────────────────────────────────────────────

interface TeamMemberRecord {
  id: string
  data: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

interface ResolvedAssociation {
  /** The TeamMember junction record ID */
  memberId: string
  /** Object type of the parent record */
  objectApiName: string
  /** ID of the parent record */
  parentRecordId: string
  /** Resolved display name of the parent record */
  parentRecordName: string
  role: string
  isPrimary: boolean
  isContractHolder: boolean
}

// ── Constants ──────────────────────────────────────────────────────────

const SUPPORTED_OBJECTS = ['Contact', 'Account']

/** Maps object API name → TeamMember lookup field name */
const PARENT_FIELDS: Array<{ objectApiName: string; fieldName: string; label: string }> = [
  { objectApiName: 'Property',     fieldName: 'property',     label: 'Property' },
  { objectApiName: 'Opportunity',  fieldName: 'opportunity',  label: 'Opportunity' },
  { objectApiName: 'Project',      fieldName: 'project',      label: 'Project' },
  { objectApiName: 'WorkOrder',    fieldName: 'workOrder',    label: 'Work Order' },
  { objectApiName: 'Installation', fieldName: 'installation', label: 'Installation' },
]

const ROLE_PICKLIST = [
  'Homeowner', 'General Contractor', 'Subcontractor', 'Architect / Designer',
  'Property Manager', 'Sales Rep', 'Installer', 'Inspector', 'Engineer', 'Other',
]

const DEDICATED_ROUTES: Record<string, string> = {
  Property: '/properties',
  Account: '/accounts',
  Contact: '/contacts',
  Lead: '/leads',
  Opportunity: '/opportunities',
  Project: '/projects',
  Product: '/products',
  Installation: '/installations',
  Quote: '/quotes',
  Service: '/service',
  WorkOrder: '/work-orders',
}

function recordUrl(objectApiName: string, recordId: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  return prefix ? `${prefix}/${recordId}` : `/objects/${objectApiName}/${recordId}`
}

// ── Helpers ────────────────────────────────────────────────────────────

function getField(rec: TeamMemberRecord, field: string): unknown {
  const d = rec.data ?? {}
  if (d[field] !== undefined) return d[field]
  for (const key of Object.keys(d)) {
    const stripped = key.replace(/^[A-Za-z]+__/, '')
    if (stripped === field) return d[key]
  }
  return undefined
}

function getStr(rec: TeamMemberRecord, field: string): string {
  const v = getField(rec, field)
  return v !== null && v !== undefined ? String(v) : ''
}

function getLookupId(rec: TeamMemberRecord, field: string): string {
  const v = getField(rec, field)
  if (!v) return ''
  if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
  return String(v)
}

function getRecordName(raw: Record<string, unknown>): string {
  const d = (raw.data && typeof raw.data === 'object')
    ? raw.data as Record<string, unknown>
    : raw

  for (const key of Object.keys(d)) {
    if (key.endsWith('__firstName') || key === 'firstName') {
      const val = d[key]
      if (val && String(val).trim()) {
        const prefix = key.replace(/__firstName$/, '')
        const lastName = d[`${prefix}__lastName`] || d.lastName
        if (lastName) return `${String(val)} ${String(lastName)}`
        return String(val)
      }
    }
  }

  for (const key of Object.keys(d)) {
    const lower = key.toLowerCase()
    if (
      (lower.endsWith('name') || lower.endsWith('__name')) &&
      !lower.includes('firstname') &&
      !lower.includes('lastname')
    ) {
      const val = d[key]
      if (val && typeof val === 'string' && val.trim()) return val
    }
  }

  if (d.firstName && d.lastName) return `${String(d.firstName)} ${String(d.lastName)}`
  if (d.name && typeof d.name === 'string' && d.name.trim()) return d.name
  if (d.title && typeof d.title === 'string' && d.title.trim()) return d.title as string
  if (d.label && typeof d.label === 'string' && (d.label as string).trim()) return d.label as string

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
      {[1, 2, 3].map(i => (
        <div key={i} className="px-4 py-3 border-b border-gray-50 flex gap-4">
          <div className="h-3 bg-gray-100 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-1/5" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
      ))}
    </div>
  )
}

// ── Object Type Badge ──────────────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  Property:     'bg-purple-100 text-purple-700',
  Opportunity:  'bg-blue-100 text-blue-700',
  Project:      'bg-teal-100 text-teal-700',
  WorkOrder:    'bg-amber-100 text-amber-700',
  Installation: 'bg-orange-100 text-orange-700',
}

function ObjectBadge({ objectApiName, label }: { objectApiName: string; label: string }) {
  const cls = BADGE_COLORS[objectApiName] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function TeamMemberAssociationsWidget({ config, record, object }: WidgetProps) {
  const { label } = config as { type: string; label?: string }

  const objectApiName = object.apiName
  const recordId = record?.id ? String(record.id) : null
  const isSupported = SUPPORTED_OBJECTS.includes(objectApiName)

  // ── State ──
  const [associations, setAssociations] = useState<ResolvedAssociation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editRole, setEditRole] = useState('')
  const [editPrimary, setEditPrimary] = useState(false)
  const [editContractHolder, setEditContractHolder] = useState(false)
  const [saving, setSaving] = useState(false)

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Data Fetching ──
  const fetchAssociations = useCallback(async () => {
    if (!recordId || !isSupported) return
    setLoading(true)
    setError(null)

    try {
      // Determine which lookup field points to this object type
      const linkField = objectApiName === 'Contact' ? 'contact' : 'account'

      // Fetch all TeamMember records linked to this contact/account (try both plain and prefixed)
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
      for (const m of [...(Array.isArray(plain) ? plain : []), ...(Array.isArray(prefixed) ? prefixed : [])]) {
        if (!seen.has(String(m.id))) {
          seen.add(String(m.id))
          members.push(m)
        }
      }

      // Group parent record IDs by object type for batch resolution
      const parentIdsByType: Record<string, { memberId: string; parentId: string }[]> = {}
      for (const member of members) {
        for (const { objectApiName: parentType, fieldName } of PARENT_FIELDS) {
          const parentId = getLookupId(member, fieldName)
          if (parentId) {
            if (!parentIdsByType[parentType]) parentIdsByType[parentType] = []
            parentIdsByType[parentType].push({ memberId: String(member.id), parentId })
          }
        }
      }

      // Batch-resolve record names per object type
      const namesByType: Record<string, Map<string, string>> = {}
      await Promise.all(
        Object.entries(parentIdsByType).map(async ([parentType, entries]) => {
          const uniqueIds = Array.from(new Set(entries.map(e => e.parentId)))
          const nameMap = new Map<string, string>()
          await Promise.allSettled(
            uniqueIds.map(id =>
              apiClient
                .get<Record<string, unknown>>(`/objects/${parentType}/records/${id}`)
                .then(data => {
                  const name = getRecordName(data as Record<string, unknown>)
                  if (name && name !== id && name !== 'Unnamed') nameMap.set(id, name)
                })
            )
          )
          namesByType[parentType] = nameMap
        })
      )

      // Build resolved associations from member records
      const resolved: ResolvedAssociation[] = []
      for (const member of members) {
        for (const { objectApiName: parentType, fieldName } of PARENT_FIELDS) {
          const parentId = getLookupId(member, fieldName)
          if (!parentId) continue

          const nameMap = namesByType[parentType]
          const resolvedName = nameMap?.get(parentId) ?? parentId

          resolved.push({
            memberId: String(member.id),
            objectApiName: parentType,
            parentRecordId: parentId,
            parentRecordName: resolvedName,
            role: getStr(member, 'role'),
            isPrimary: getField(member, 'primaryContact') === true || getField(member, 'primaryContact') === 'true',
            isContractHolder: getField(member, 'contractHolder') === true || getField(member, 'contractHolder') === 'true',
          })
        }
      }

      // Sort by object type order then by name
      const typeOrder = PARENT_FIELDS.map(f => f.objectApiName)
      resolved.sort((a, b) => {
        const ai = typeOrder.indexOf(a.objectApiName)
        const bi = typeOrder.indexOf(b.objectApiName)
        if (ai !== bi) return ai - bi
        return a.parentRecordName.localeCompare(b.parentRecordName)
      })

      setAssociations(resolved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load associations')
    } finally {
      setLoading(false)
    }
  }, [recordId, objectApiName, isSupported])

  useEffect(() => {
    fetchAssociations()
  }, [fetchAssociations])

  // ── Inline edit handlers ──
  const startEdit = (assoc: ResolvedAssociation) => {
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
        data: {
          role: editRole,
          primaryContact: editPrimary,
          contractHolder: editContractHolder,
        },
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

  // Group label for each parent type
  const parentFieldLabels = useMemo(() => {
    const m: Record<string, string> = {}
    for (const { objectApiName: t, label: l } of PARENT_FIELDS) m[t] = l
    return m
  }, [])

  // ── Unsupported object ──
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        Team Member Associations is not available for {object.label}.
      </div>
    )
  }

  if (loading && associations.length === 0) return <Skeleton />

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
            {associations.length} record{associations.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Body ── */}
        {associations.length === 0 ? (
          <div className="p-8 text-center">
            <Network className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-brand-gray">No associated records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">
                    Related To
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">
                    Type
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">
                    Role
                  </th>
                  <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">
                    Flags
                  </th>
                  <th className="w-16 px-2 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {associations.map(assoc => {
                  const isEditing = editingId === assoc.memberId
                  return (
                    <tr
                      key={assoc.memberId}
                      className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors group"
                    >
                      {/* Related To */}
                      <td className="px-4 py-2.5 font-medium">
                        <Link
                          href={recordUrl(assoc.objectApiName, assoc.parentRecordId)}
                          className="text-brand-navy hover:underline"
                        >
                          {assoc.parentRecordName}
                        </Link>
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-2.5">
                        <ObjectBadge
                          objectApiName={assoc.objectApiName}
                          label={parentFieldLabels[assoc.objectApiName] ?? assoc.objectApiName}
                        />
                      </td>

                      {/* Role — editable */}
                      <td className="px-4 py-2.5 text-brand-dark">
                        {isEditing ? (
                          <select
                            value={editRole}
                            onChange={e => setEditRole(e.target.value)}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand-navy"
                          >
                            <option value="">-- Select --</option>
                            {ROLE_PICKLIST.map(r => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        ) : (
                          assoc.role || <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Flags — editable */}
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editPrimary}
                                onChange={e => setEditPrimary(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              Primary
                            </label>
                            <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editContractHolder}
                                onChange={e => setEditContractHolder(e.target.checked)}
                                className="rounded border-gray-300"
                              />
                              Contract Holder
                            </label>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {assoc.isPrimary && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                                Primary
                              </span>
                            )}
                            {assoc.isContractHolder && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                                Contract Holder
                              </span>
                            )}
                            {!assoc.isPrimary && !assoc.isContractHolder && (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-2 py-2">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={saving}
                              className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-50"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="p-1 rounded text-gray-400 hover:bg-gray-100"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => startEdit(assoc)}
                              className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100"
                              title="Edit"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(assoc.memberId)}
                              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                              title="Remove"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
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
                This will remove this team member assignment from the related record. The record itself is not affected.
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
                  {deletingId === deleteTarget ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
