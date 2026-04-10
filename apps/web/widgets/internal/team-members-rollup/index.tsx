'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Search, Users, X, Edit2, Trash2, Copy,
  Check, Building2, UserCircle,
} from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'

// ── Types ──────────────────────────────────────────────────────────────

interface TeamMemberRecord {
  id: string
  data: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

interface ViaSource {
  objectApiName: string
  recordId: string
  recordName: string
}

interface MergedContact {
  contactId: string
  contactName: string
  accountId?: string
  accountName?: string
  roles: string[]
  viaSources: ViaSource[]
  isPrimary: boolean
  isContractHolder: boolean
  /** TeamMember record IDs belonging to the current record (editable/deletable) */
  ownedMemberIds: string[]
  /** All TeamMember record IDs for this contact (for dedup) */
  allMemberIds: string[]
}

interface MergedAccount {
  accountId: string
  accountName: string
  roles: string[]
  viaSources: ViaSource[]
  isPrimary: boolean
  isContractHolder: boolean
  ownedMemberIds: string[]
  allMemberIds: string[]
}

// ── Constants ──────────────────────────────────────────────────────────

const SUPPORTED_OBJECTS = ['Property', 'Opportunity', 'Project', 'WorkOrder', 'Installation']

const OBJECT_TO_FIELD: Record<string, string> = {
  Property: 'property',
  Opportunity: 'opportunity',
  Project: 'project',
  WorkOrder: 'workOrder',
  Installation: 'installation',
}

const CHILD_OBJECT_TYPES = ['Opportunity', 'Project', 'WorkOrder', 'Installation']

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
  // Try with object prefix (e.g. TeamMember__role)
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

function getLookupName(rec: TeamMemberRecord, field: string): string {
  const v = getField(rec, field)
  if (!v) return ''
  if (typeof v === 'object' && v !== null) {
    const obj = v as Record<string, unknown>
    return String(obj.name || obj.label || obj.id || '')
  }
  return ''
}

function getRecordName(raw: Record<string, unknown>): string {
  const d = (raw.data && typeof raw.data === 'object') ? raw.data as Record<string, unknown> : raw
  return String(d.name || d.title || d.label || raw.id || 'Unnamed')
}

// ── Skeleton ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-12 ml-auto" />
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-lg border border-gray-100 p-3 space-y-2">
            <div className="h-3 bg-gray-100 rounded w-2/3" />
            <div className="h-2 bg-gray-100 rounded w-1/2" />
            <div className="h-2 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function TeamMembersRollupWidget({ config, record, object }: WidgetProps) {
  const {
    rollupFromProperty = false,
    label,
  } = config as { type: string; rollupFromProperty?: boolean; label?: string }

  const objectApiName = object.apiName
  const recordId = record?.id ? String(record.id) : null
  const isSupported = SUPPORTED_OBJECTS.includes(objectApiName)

  // ── State ──
  const [rawMembers, setRawMembers] = useState<TeamMemberRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Inline-edit state
  const [editRole, setEditRole] = useState('')
  const [editPrimary, setEditPrimary] = useState(false)
  const [editContractHolder, setEditContractHolder] = useState(false)
  const [saving, setSaving] = useState(false)

  // ── 5b: Data Fetching ──
  const fetchTeamMembers = useCallback(async () => {
    if (!recordId || !isSupported) return
    setLoading(true)
    setError(null)

    try {
      if (!rollupFromProperty) {
        // Self-only mode
        const fieldName = OBJECT_TO_FIELD[objectApiName]
        if (!fieldName) throw new Error(`No lookup field for ${objectApiName}`)
        const data = await apiClient.get<TeamMemberRecord[]>(
          `/objects/TeamMember/records?filter[${fieldName}]=${encodeURIComponent(recordId)}&limit=200`
        )
        setRawMembers(Array.isArray(data) ? data : [])
      } else {
        // Rollup mode: gather from Property tree
        let propertyId = ''
        if (objectApiName === 'Property') {
          propertyId = recordId
        } else {
          const propField = (record as Record<string, unknown>).data
            ? ((record as Record<string, unknown>).data as Record<string, unknown>).property
            : (record as Record<string, unknown>).property
          if (propField && typeof propField === 'object' && propField !== null && 'id' in propField) {
            propertyId = String((propField as { id: unknown }).id)
          } else if (propField) {
            propertyId = String(propField)
          }
        }

        if (!propertyId) {
          // No property linked, fall back to self-only
          const fieldName = OBJECT_TO_FIELD[objectApiName]
          if (!fieldName) throw new Error(`No lookup field for ${objectApiName}`)
          const data = await apiClient.get<TeamMemberRecord[]>(
            `/objects/TeamMember/records?filter[${fieldName}]=${encodeURIComponent(recordId)}&limit=200`
          )
          setRawMembers(Array.isArray(data) ? data : [])
          return
        }

        // Phase 1: fetch child record IDs in parallel
        const childResults = await Promise.allSettled(
          CHILD_OBJECT_TYPES.map(type =>
            apiClient.get<Record<string, unknown>[]>(
              `/objects/${type}/records?filter[property]=${encodeURIComponent(propertyId)}&limit=200`
            )
          )
        )

        const childRecordsByType: Record<string, Record<string, unknown>[]> = {}
        CHILD_OBJECT_TYPES.forEach((type, i) => {
          const result = childResults[i]
          if (result.status === 'fulfilled' && Array.isArray(result.value)) {
            childRecordsByType[type] = result.value
          } else {
            childRecordsByType[type] = []
          }
        })

        // Phase 2: fetch team members in parallel
        const memberFetches: Promise<TeamMemberRecord[]>[] = []

        // Property's own team members
        memberFetches.push(
          apiClient.get<TeamMemberRecord[]>(
            `/objects/TeamMember/records?filter[property]=${encodeURIComponent(propertyId)}&limit=200`
          ).catch(() => [] as TeamMemberRecord[])
        )

        // Child record team members
        for (const type of CHILD_OBJECT_TYPES) {
          const records = childRecordsByType[type]
          const fieldName = OBJECT_TO_FIELD[type]
          if (!fieldName) continue
          for (const rec of records) {
            const childId = String(rec.id)
            memberFetches.push(
              apiClient.get<TeamMemberRecord[]>(
                `/objects/TeamMember/records?filter[${fieldName}]=${encodeURIComponent(childId)}&limit=200`
              ).catch(() => [] as TeamMemberRecord[])
            )
          }
        }

        const allResults = await Promise.allSettled(memberFetches)
        const allMembers: TeamMemberRecord[] = []
        const seenIds = new Set<string>()

        for (const result of allResults) {
          if (result.status === 'fulfilled') {
            const arr = Array.isArray(result.value) ? result.value : []
            for (const m of arr) {
              if (!seenIds.has(String(m.id))) {
                seenIds.add(String(m.id))
                allMembers.push(m)
              }
            }
          }
        }

        setRawMembers(allMembers)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team members')
    } finally {
      setLoading(false)
    }
  }, [recordId, objectApiName, rollupFromProperty, record, isSupported])

  useEffect(() => {
    fetchTeamMembers()
  }, [fetchTeamMembers])

  // ── 5c: De-duplication & merge ──
  const currentField = OBJECT_TO_FIELD[objectApiName] ?? ''

  const { mergedContacts, mergedAccounts, allRoles } = useMemo(() => {
    const contactMap = new Map<string, MergedContact>()
    const accountMap = new Map<string, MergedAccount>()
    const roleSet = new Set<string>()

    for (const member of rawMembers) {
      const contactId = getLookupId(member, 'contact')
      const contactName = getLookupName(member, 'contact') || getStr(member, 'contactName')
      const accountId = getLookupId(member, 'account')
      const accountName = getLookupName(member, 'account') || getStr(member, 'accountName')
      const role = getStr(member, 'role')
      const isPrimary = getField(member, 'primaryContact') === true || getField(member, 'primaryContact') === 'true'
      const isContractHolder = getField(member, 'contractHolder') === true || getField(member, 'contractHolder') === 'true'
      const memberId = String(member.id)

      if (role) roleSet.add(role)

      // Determine "via" source — which parent record this member belongs to
      const viaSources: ViaSource[] = []
      for (const [objType, fieldKey] of Object.entries(OBJECT_TO_FIELD)) {
        const parentId = getLookupId(member, fieldKey)
        const parentName = getLookupName(member, fieldKey)
        if (parentId) {
          viaSources.push({
            objectApiName: objType,
            recordId: parentId,
            recordName: parentName || objType,
          })
        }
      }

      // Check if this member "belongs" to the current record (editable)
      const ownerParentId = getLookupId(member, currentField)
      const isOwned = !!recordId && ownerParentId === recordId

      // Merge contact
      if (contactId) {
        const existing = contactMap.get(contactId)
        if (existing) {
          if (role && !existing.roles.includes(role)) existing.roles.push(role)
          for (const vs of viaSources) {
            if (!existing.viaSources.some(s => s.objectApiName === vs.objectApiName && s.recordId === vs.recordId)) {
              existing.viaSources.push(vs)
            }
          }
          if (isPrimary) existing.isPrimary = true
          if (isContractHolder) existing.isContractHolder = true
          if (isOwned && !existing.ownedMemberIds.includes(memberId)) existing.ownedMemberIds.push(memberId)
          if (!existing.allMemberIds.includes(memberId)) existing.allMemberIds.push(memberId)
          if (!existing.accountId && accountId) {
            existing.accountId = accountId
            existing.accountName = accountName
          }
        } else {
          contactMap.set(contactId, {
            contactId,
            contactName: contactName || 'Unknown Contact',
            accountId: accountId || undefined,
            accountName: accountName || undefined,
            roles: role ? [role] : [],
            viaSources,
            isPrimary,
            isContractHolder,
            ownedMemberIds: isOwned ? [memberId] : [],
            allMemberIds: [memberId],
          })
        }
      }

      // Merge account
      if (accountId) {
        const existing = accountMap.get(accountId)
        if (existing) {
          if (role && !existing.roles.includes(role)) existing.roles.push(role)
          for (const vs of viaSources) {
            if (!existing.viaSources.some(s => s.objectApiName === vs.objectApiName && s.recordId === vs.recordId)) {
              existing.viaSources.push(vs)
            }
          }
          if (isPrimary) existing.isPrimary = true
          if (isContractHolder) existing.isContractHolder = true
          if (isOwned && !existing.ownedMemberIds.includes(memberId)) existing.ownedMemberIds.push(memberId)
          if (!existing.allMemberIds.includes(memberId)) existing.allMemberIds.push(memberId)
        } else {
          accountMap.set(accountId, {
            accountId,
            accountName: accountName || 'Unknown Account',
            roles: role ? [role] : [],
            viaSources,
            isPrimary,
            isContractHolder,
            ownedMemberIds: isOwned ? [memberId] : [],
            allMemberIds: [memberId],
          })
        }
      }
    }

    return {
      mergedContacts: Array.from(contactMap.values()),
      mergedAccounts: Array.from(accountMap.values()),
      allRoles: Array.from(roleSet).sort(),
    }
  }, [rawMembers, currentField, recordId])

  // ── 5e: Search, Filter & Sort ──
  const filteredContacts = useMemo(() => {
    let list = [...mergedContacts]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => c.contactName.toLowerCase().includes(q))
    }
    if (roleFilter) {
      list = list.filter(c => c.roles.includes(roleFilter))
    }
    list.sort((a, b) => a.contactName.localeCompare(b.contactName))
    return list
  }, [mergedContacts, search, roleFilter])

  const filteredAccounts = useMemo(() => {
    let list = [...mergedAccounts]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a => a.accountName.toLowerCase().includes(q))
    }
    if (roleFilter) {
      list = list.filter(a => a.roles.includes(roleFilter))
    }
    list.sort((a, b) => a.accountName.localeCompare(b.accountName))
    return list
  }, [mergedAccounts, search, roleFilter])

  const totalCount = mergedContacts.length + mergedAccounts.length
  const showSearchBar = totalCount > 5

  // ── 5h: Inline Edit handlers ──
  const startEdit = (memberId: string) => {
    const member = rawMembers.find(m => String(m.id) === memberId)
    if (!member) return
    setEditingId(memberId)
    setEditRole(getStr(member, 'role'))
    setEditPrimary(getField(member, 'primaryContact') === true || getField(member, 'primaryContact') === 'true')
    setEditContractHolder(getField(member, 'contractHolder') === true || getField(member, 'contractHolder') === 'true')
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
      await fetchTeamMembers()
    } catch {
      // keep editing on failure
    } finally {
      setSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  // ── 5i: Delete handler ──
  const handleDelete = async (memberId: string) => {
    setDeletingId(memberId)
    try {
      await apiClient.delete(`/objects/TeamMember/records/${memberId}`)
      setDeleteTarget(null)
      await fetchTeamMembers()
    } catch {
      // ignore
    } finally {
      setDeletingId(null)
    }
  }

  // ── 5a: Supported object check (after all hooks) ──
  if (!isSupported) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        Team Members is not available for {object.label}.
      </div>
    )
  }

  // ── Loading / Error ──
  if (loading && rawMembers.length === 0) return <Skeleton />

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  const widgetLabel = (label as string) || 'Team Members'

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* ── Header ── */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-dark flex-1">{widgetLabel}</h3>
          <span className="text-[11px] text-brand-gray tabular-nums">
            {totalCount} member{totalCount !== 1 ? 's' : ''}
          </span>
          <button
            type="button"
            onClick={() => setShowCopyModal(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-brand-gray hover:text-brand-dark hover:bg-gray-50 transition-colors"
            title="Copy team from another record"
          >
            <Copy className="w-3 h-3" />
            Copy
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {/* ── Search & Filter bar ── */}
        {showSearchBar && (
          <div className="px-4 py-2 border-b border-gray-50 flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search names..."
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition"
              />
            </div>
            {allRoles.length > 0 && (
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition"
              >
                <option value="">All Roles</option>
                {allRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* ── Body: Two-column grid ── */}
        {totalCount === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-brand-gray">No team members found</p>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="mt-2 text-[11px] font-semibold text-brand-navy hover:underline"
            >
              Add a team member
            </button>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Contacts column ── */}
            <div>
              <h4 className="text-[10px] font-semibold text-brand-gray uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <UserCircle className="w-3.5 h-3.5" />
                Contacts ({filteredContacts.length})
              </h4>
              {filteredContacts.length === 0 ? (
                <p className="text-[10px] text-gray-400 py-2">No contacts</p>
              ) : (
                <div className="space-y-2">
                  {filteredContacts.map(c => (
                    <ContactTile
                      key={c.contactId}
                      contact={c}
                      editingId={editingId}
                      editRole={editRole}
                      editPrimary={editPrimary}
                      editContractHolder={editContractHolder}
                      saving={saving}
                      onStartEdit={startEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onSetEditRole={setEditRole}
                      onSetEditPrimary={setEditPrimary}
                      onSetEditContractHolder={setEditContractHolder}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Accounts column ── */}
            <div>
              <h4 className="text-[10px] font-semibold text-brand-gray uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Accounts ({filteredAccounts.length})
              </h4>
              {filteredAccounts.length === 0 ? (
                <p className="text-[10px] text-gray-400 py-2">No accounts</p>
              ) : (
                <div className="space-y-2">
                  {filteredAccounts.map(a => (
                    <AccountTile
                      key={a.accountId}
                      account={a}
                      editingId={editingId}
                      editRole={editRole}
                      editPrimary={editPrimary}
                      editContractHolder={editContractHolder}
                      saving={saving}
                      onStartEdit={startEdit}
                      onSaveEdit={saveEdit}
                      onCancelEdit={cancelEdit}
                      onSetEditRole={setEditRole}
                      onSetEditPrimary={setEditPrimary}
                      onSetEditContractHolder={setEditContractHolder}
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation ── */}
      {deleteTarget && (
        <ModalOverlay onClose={() => setDeleteTarget(null)}>
          <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
            <p className="text-sm font-semibold text-brand-dark">Remove team member?</p>
            <p className="text-xs text-brand-gray">This will remove the team member assignment. The contact/account record itself is not affected.</p>
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
        </ModalOverlay>
      )}

      {/* ── Add Team Member Modal ── */}
      {showAddModal && (
        <AddTeamMemberModal
          objectApiName={objectApiName}
          recordId={recordId!}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); fetchTeamMembers() }}
        />
      )}

      {/* ── Copy Team Modal ── */}
      {showCopyModal && (
        <CopyTeamModal
          objectApiName={objectApiName}
          recordId={recordId!}
          existingMemberIds={rawMembers.map(m => String(m.id))}
          onClose={() => setShowCopyModal(false)}
          onSaved={() => { setShowCopyModal(false); fetchTeamMembers() }}
        />
      )}
    </>
  )
}

// ── Modal Overlay ──────────────────────────────────────────────────────

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {children}
      </div>
    </>
  )
}

// ── Contact Tile ───────────────────────────────────────────────────────

interface TileEditProps {
  editingId: string | null
  editRole: string
  editPrimary: boolean
  editContractHolder: boolean
  saving: boolean
  onStartEdit: (id: string) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onSetEditRole: (v: string) => void
  onSetEditPrimary: (v: boolean) => void
  onSetEditContractHolder: (v: boolean) => void
  onDelete: (id: string) => void
}

function ContactTile({
  contact,
  editingId,
  editRole,
  editPrimary,
  editContractHolder,
  saving,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onSetEditRole,
  onSetEditPrimary,
  onSetEditContractHolder,
  onDelete,
}: { contact: MergedContact } & TileEditProps) {
  const isEditing = contact.ownedMemberIds.some(id => id === editingId)
  const canEdit = contact.ownedMemberIds.length > 0

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm p-3 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={recordUrl('Contact', contact.contactId)}
            className="text-xs font-semibold text-brand-navy hover:underline truncate block"
          >
            {contact.contactName}
          </Link>
          {contact.accountName && (
            <Link
              href={recordUrl('Account', contact.accountId!)}
              className="text-[10px] text-brand-gray hover:underline truncate block mt-0.5"
            >
              {contact.accountName}
            </Link>
          )}
        </div>
        {canEdit && !isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => onStartEdit(contact.ownedMemberIds[0])}
              className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(contact.ownedMemberIds[0])}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {contact.roles.map(role => (
          <span key={role} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-navy/10 text-brand-navy">
            {role}
          </span>
        ))}
        {contact.isPrimary && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
            Primary
          </span>
        )}
        {contact.isContractHolder && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
            Contract Holder
          </span>
        )}
      </div>

      {/* Via sources */}
      {contact.viaSources.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-gray-400">via:</span>
          {contact.viaSources.map((vs, i) => (
            <Link
              key={`${vs.objectApiName}-${vs.recordId}`}
              href={recordUrl(vs.objectApiName, vs.recordId)}
              className="text-[10px] text-brand-navy hover:underline"
            >
              {vs.recordName}{i < contact.viaSources.length - 1 ? ',' : ''}
            </Link>
          ))}
        </div>
      )}

      {/* Inline edit form */}
      {isEditing && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-brand-gray uppercase">Role</label>
            <select
              value={editRole}
              onChange={e => onSetEditRole(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand-navy"
            >
              <option value="">-- Select --</option>
              {ROLE_PICKLIST.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-[10px] text-brand-dark cursor-pointer">
              <input
                type="checkbox"
                checked={editPrimary}
                onChange={e => onSetEditPrimary(e.target.checked)}
                className="rounded border-gray-300"
              />
              Primary Contact
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-brand-dark cursor-pointer">
              <input
                type="checkbox"
                checked={editContractHolder}
                onChange={e => onSetEditContractHolder(e.target.checked)}
                className="rounded border-gray-300"
              />
              Contract Holder
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-2 py-1 rounded text-[10px] font-medium text-brand-gray hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving}
              className="px-2 py-1 rounded bg-brand-navy text-white text-[10px] font-medium hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Account Tile ───────────────────────────────────────────────────────

function AccountTile({
  account,
  editingId,
  editRole,
  editPrimary,
  editContractHolder,
  saving,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onSetEditRole,
  onSetEditPrimary,
  onSetEditContractHolder,
  onDelete,
}: { account: MergedAccount } & TileEditProps) {
  const isEditing = account.ownedMemberIds.some(id => id === editingId)
  const canEdit = account.ownedMemberIds.length > 0

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm p-3 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={recordUrl('Account', account.accountId)}
            className="text-xs font-semibold text-brand-navy hover:underline truncate block"
          >
            {account.accountName}
          </Link>
        </div>
        {canEdit && !isEditing && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => onStartEdit(account.ownedMemberIds[0])}
              className="p-1 rounded text-gray-400 hover:text-brand-navy hover:bg-gray-100"
              title="Edit"
            >
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(account.ownedMemberIds[0])}
              className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
              title="Remove"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1 mt-1.5">
        {account.roles.map(role => (
          <span key={role} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand-navy/10 text-brand-navy">
            {role}
          </span>
        ))}
        {account.isPrimary && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
            Primary
          </span>
        )}
        {account.isContractHolder && (
          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
            Contract Holder
          </span>
        )}
      </div>

      {/* Via sources */}
      {account.viaSources.length > 0 && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-gray-400">via:</span>
          {account.viaSources.map((vs, i) => (
            <Link
              key={`${vs.objectApiName}-${vs.recordId}`}
              href={recordUrl(vs.objectApiName, vs.recordId)}
              className="text-[10px] text-brand-navy hover:underline"
            >
              {vs.recordName}{i < account.viaSources.length - 1 ? ',' : ''}
            </Link>
          ))}
        </div>
      )}

      {/* Inline edit form */}
      {isEditing && (
        <div className="mt-2 pt-2 border-t border-gray-200 space-y-2">
          <div>
            <label className="text-[10px] font-semibold text-brand-gray uppercase">Role</label>
            <select
              value={editRole}
              onChange={e => onSetEditRole(e.target.value)}
              className="mt-0.5 w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-brand-dark outline-none focus:border-brand-navy"
            >
              <option value="">-- Select --</option>
              {ROLE_PICKLIST.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-[10px] text-brand-dark cursor-pointer">
              <input
                type="checkbox"
                checked={editPrimary}
                onChange={e => onSetEditPrimary(e.target.checked)}
                className="rounded border-gray-300"
              />
              Primary Contact
            </label>
            <label className="flex items-center gap-1.5 text-[10px] text-brand-dark cursor-pointer">
              <input
                type="checkbox"
                checked={editContractHolder}
                onChange={e => onSetEditContractHolder(e.target.checked)}
                className="rounded border-gray-300"
              />
              Contract Holder
            </label>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-2 py-1 rounded text-[10px] font-medium text-brand-gray hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={saving}
              className="px-2 py-1 rounded bg-brand-navy text-white text-[10px] font-medium hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 5f: Add Team Member Modal ──────────────────────────────────────────

function AddTeamMemberModal({
  objectApiName,
  recordId,
  onClose,
  onSaved,
}: {
  objectApiName: string
  recordId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Record<string, unknown>[]>([])
  const [selectedContact, setSelectedContact] = useState<Record<string, unknown> | null>(null)
  const [accountSearch, setAccountSearch] = useState('')
  const [accountResults, setAccountResults] = useState<Record<string, unknown>[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Record<string, unknown> | null>(null)
  const [role, setRole] = useState('')
  const [primaryContact, setPrimaryContact] = useState(false)
  const [contractHolder, setContractHolder] = useState(false)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced contact search
  useEffect(() => {
    if (contactSearch.trim().length < 2) {
      setContactResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/Contact/records/search?q=${encodeURIComponent(contactSearch.trim())}`
        )
        setContactResults(Array.isArray(data) ? data : [])
      } catch {
        setContactResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [contactSearch])

  // Debounced account search
  useEffect(() => {
    if (accountSearch.trim().length < 2) {
      setAccountResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/Account/records/search?q=${encodeURIComponent(accountSearch.trim())}`
        )
        setAccountResults(Array.isArray(data) ? data : [])
      } catch {
        setAccountResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [accountSearch])

  const handleSave = async () => {
    if (!selectedContact) {
      setError('Contact is required')
      return
    }
    if (!role) {
      setError('Role is required')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const parentField = OBJECT_TO_FIELD[objectApiName]
      const payload: Record<string, unknown> = {
        [parentField]: recordId,
        role,
        primaryContact,
        contractHolder,
      }
      if (selectedContact) {
        payload.contact = String(selectedContact.id)
      }
      if (selectedAccount) {
        payload.account = String(selectedAccount.id)
      }

      await apiClient.post('/objects/TeamMember/records', { data: payload })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create team member')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-dark">Add Team Member</h3>
          <button type="button" onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Contact search */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Contact</label>
            {selectedContact ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-brand-navy/20 bg-brand-navy/5 text-xs text-brand-dark">
                <UserCircle className="w-3.5 h-3.5 text-brand-navy" />
                <span className="flex-1">{getRecordName(selectedContact)}</span>
                <button type="button" onClick={() => { setSelectedContact(null); setContactSearch('') }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className={inputCls}
                  value={contactSearch}
                  onChange={e => setContactSearch(e.target.value)}
                  placeholder="Search contacts..."
                />
                {searching && (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">Searching...</div>
                )}
                {contactResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {contactResults.map(r => (
                      <button
                        key={String(r.id)}
                        type="button"
                        onClick={() => { setSelectedContact(r); setContactSearch(''); setContactResults([]) }}
                        className="w-full text-left px-3 py-2 text-xs text-brand-dark hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {getRecordName(r)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Account search */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Account <span className="text-gray-400 font-normal">(optional)</span></label>
            {selectedAccount ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-brand-navy/20 bg-brand-navy/5 text-xs text-brand-dark">
                <Building2 className="w-3.5 h-3.5 text-brand-navy" />
                <span className="flex-1">{getRecordName(selectedAccount)}</span>
                <button type="button" onClick={() => { setSelectedAccount(null); setAccountSearch('') }} className="text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  className={inputCls}
                  value={accountSearch}
                  onChange={e => setAccountSearch(e.target.value)}
                  placeholder="Search accounts..."
                />
                {accountResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {accountResults.map(r => (
                      <button
                        key={String(r.id)}
                        type="button"
                        onClick={() => { setSelectedAccount(r); setAccountSearch(''); setAccountResults([]) }}
                        className="w-full text-left px-3 py-2 text-xs text-brand-dark hover:bg-gray-50 border-b border-gray-50 last:border-0"
                      >
                        {getRecordName(r)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Role */}
          <div>
            <label className="block text-[11px] font-semibold text-brand-dark mb-1">Role *</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className={inputCls}
            >
              <option value="">-- Select Role --</option>
              {ROLE_PICKLIST.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-1.5 text-xs text-brand-dark cursor-pointer">
              <input
                type="checkbox"
                checked={primaryContact}
                onChange={e => setPrimaryContact(e.target.checked)}
                className="rounded border-gray-300"
              />
              Primary Contact
            </label>
            <label className="flex items-center gap-1.5 text-xs text-brand-dark cursor-pointer">
              <input
                type="checkbox"
                checked={contractHolder}
                onChange={e => setContractHolder(e.target.checked)}
                className="rounded border-gray-300"
              />
              Contract Holder
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Member'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── 5g: Copy Team Modal ────────────────────────────────────────────────

function CopyTeamModal({
  objectApiName,
  recordId,
  existingMemberIds,
  onClose,
  onSaved,
}: {
  objectApiName: string
  recordId: string
  existingMemberIds: string[]
  onClose: () => void
  onSaved: () => void
}) {
  const [sourceObjectType, setSourceObjectType] = useState(SUPPORTED_OBJECTS[0])
  const [sourceSearch, setSourceSearch] = useState('')
  const [sourceResults, setSourceResults] = useState<Record<string, unknown>[]>([])
  const [selectedSource, setSelectedSource] = useState<Record<string, unknown> | null>(null)
  const [previewMembers, setPreviewMembers] = useState<TeamMemberRecord[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [copying, setCopying] = useState(false)
  const [result, setResult] = useState<{ copied: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Debounced source record search
  useEffect(() => {
    if (sourceSearch.trim().length < 2) {
      setSourceResults([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/${sourceObjectType}/records/search?q=${encodeURIComponent(sourceSearch.trim())}`
        )
        setSourceResults(Array.isArray(data) ? data : [])
      } catch {
        setSourceResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [sourceSearch, sourceObjectType])

  // Load preview when a source is selected
  useEffect(() => {
    if (!selectedSource) {
      setPreviewMembers([])
      return
    }
    const sourceId = String(selectedSource.id)
    const fieldName = OBJECT_TO_FIELD[sourceObjectType]
    if (!fieldName) return

    setLoadingPreview(true)
    apiClient.get<TeamMemberRecord[]>(
      `/objects/TeamMember/records?filter[${fieldName}]=${encodeURIComponent(sourceId)}&limit=200`
    )
      .then(data => setPreviewMembers(Array.isArray(data) ? data : []))
      .catch(() => setPreviewMembers([]))
      .finally(() => setLoadingPreview(false))
  }, [selectedSource, sourceObjectType])

  const handleCopy = async () => {
    if (previewMembers.length === 0) return
    setCopying(true)
    setError(null)

    const parentField = OBJECT_TO_FIELD[objectApiName]
    let copied = 0
    let skipped = 0

    // Build a set of existing contact+account combos for dedup
    const existingContactIds = new Set<string>()
    // We'll just try to create and let the server handle duplicates if needed

    for (const member of previewMembers) {
      try {
        const contactId = getLookupId(member, 'contact')
        const accountId = getLookupId(member, 'account')
        const role = getStr(member, 'role')
        const isPrimary = getField(member, 'primaryContact') === true
        const isContractHolder = getField(member, 'contractHolder') === true

        // Simple dedup: skip if same contact is already added in this batch
        const dedupKey = `${contactId}|${accountId}`
        if (existingContactIds.has(dedupKey)) {
          skipped++
          continue
        }
        existingContactIds.add(dedupKey)

        const payload: Record<string, unknown> = {
          [parentField]: recordId,
          role: role || 'Other',
          primaryContact: isPrimary,
          contractHolder: isContractHolder,
        }
        if (contactId) payload.contact = contactId
        if (accountId) payload.account = accountId

        await apiClient.post('/objects/TeamMember/records', { data: payload })
        copied++
      } catch {
        skipped++
      }
    }

    setResult({ copied, skipped })
    setCopying(false)
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-brand-dark">Copy Team From Another Record</h3>
          <button type="button" onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {result ? (
            <div className="text-center py-4 space-y-2">
              <Check className="w-8 h-8 text-green-500 mx-auto" />
              <p className="text-sm font-semibold text-brand-dark">Copy Complete</p>
              <p className="text-xs text-brand-gray">
                {result.copied} member{result.copied !== 1 ? 's' : ''} copied
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </p>
              <button
                type="button"
                onClick={onSaved}
                className="mt-2 px-4 py-1.5 rounded-lg bg-brand-navy text-white text-xs font-medium hover:bg-brand-navy/90"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Object type selector */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1">Source Object Type</label>
                <select
                  value={sourceObjectType}
                  onChange={e => { setSourceObjectType(e.target.value); setSelectedSource(null); setSourceSearch('') }}
                  className={inputCls}
                >
                  {SUPPORTED_OBJECTS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              {/* Source record search */}
              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1">Source Record</label>
                {selectedSource ? (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-brand-navy/20 bg-brand-navy/5 text-xs text-brand-dark">
                    <span className="flex-1">{getRecordName(selectedSource)}</span>
                    <button type="button" onClick={() => { setSelectedSource(null); setSourceSearch('') }} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      className={inputCls}
                      value={sourceSearch}
                      onChange={e => setSourceSearch(e.target.value)}
                      placeholder={`Search ${sourceObjectType} records...`}
                    />
                    {sourceResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-10 max-h-40 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                        {sourceResults.map(r => (
                          <button
                            key={String(r.id)}
                            type="button"
                            onClick={() => { setSelectedSource(r); setSourceSearch(''); setSourceResults([]) }}
                            className="w-full text-left px-3 py-2 text-xs text-brand-dark hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            {getRecordName(r)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Preview */}
              {selectedSource && (
                <div>
                  <p className="text-[11px] font-semibold text-brand-dark mb-1">
                    Team Members to Copy ({previewMembers.length})
                  </p>
                  {loadingPreview ? (
                    <div className="py-3 text-center text-xs text-brand-gray animate-pulse">Loading preview...</div>
                  ) : previewMembers.length === 0 ? (
                    <p className="text-xs text-brand-gray py-2">No team members found on this record</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                      {previewMembers.map(m => (
                        <div key={String(m.id)} className="px-3 py-2 text-xs text-brand-dark flex items-center gap-2">
                          <UserCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="flex-1 truncate">
                            {getLookupName(m, 'contact') || getLookupName(m, 'account') || 'Unknown'}
                          </span>
                          <span className="text-[10px] text-brand-gray">{getStr(m, 'role')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>

        {!result && (
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCopy}
              disabled={copying || previewMembers.length === 0}
              className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {copying ? 'Copying...' : `Copy ${previewMembers.length} Member${previewMembers.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </ModalOverlay>
  )
}
