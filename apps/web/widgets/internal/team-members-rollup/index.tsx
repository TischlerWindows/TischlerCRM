'use client'
import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Search, Users, X, Edit2, Trash2, Copy,
  Check, Building2, UserCircle, ArrowLeft, ChevronRight,
  Phone, Mail,
} from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import type { TeamMembersRollupConfig } from '@/lib/schema'
import { apiClient } from '@/lib/api-client'
import { FieldDisplay } from '../shared/FieldDisplay'

// ── Types ──────────────────────────────────────────────────────────────

interface TeamMemberRecord {
  id: string
  data: Record<string, unknown>
  createdAt?: string
  updatedAt?: string
}

/** ID → display name cache for resolved lookups */
type NameMap = Map<string, string>

interface ViaSource {
  objectApiName: string
  recordId: string
  recordName: string
}

interface MergedContact {
  contactId: string
  contactName: string
  contactData: Record<string, unknown>
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
  accountData: Record<string, unknown>
  roles: string[]
  viaSources: ViaSource[]
  isPrimary: boolean
  isContractHolder: boolean
  ownedMemberIds: string[]
  allMemberIds: string[]
}

// ── Constants ──────────────────────────────────────────────────────────

const SUPPORTED_OBJECTS = ['Property', 'Opportunity', 'Project', 'WorkOrder', 'Installation']

/** Plain field name used in TeamMember data to reference the parent */
const OBJECT_TO_FIELD: Record<string, string> = {
  Property: 'property',
  Opportunity: 'opportunity',
  Project: 'project',
  WorkOrder: 'workOrder',
  Installation: 'installation',
}

/** Auto-generated lookup field name used by ensureRelationshipFields
 *  (e.g. PropertyId, OpportunityId) — this is the field actually stored
 *  in the data column when records are linked through the UI. */
const OBJECT_TO_LOOKUP_FIELD: Record<string, string> = {
  Property: 'PropertyId',
  Opportunity: 'OpportunityId',
  Project: 'ProjectId',
  WorkOrder: 'WorkOrderId',
  Installation: 'InstallationId',
}

/** Reverse mapping: plain field name → auto-generated lookup field name */
const FIELD_TO_LOOKUP: Record<string, string> = {
  property: 'PropertyId',
  opportunity: 'OpportunityId',
  project: 'ProjectId',
  workOrder: 'WorkOrderId',
  installation: 'InstallationId',
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

// ── Module-level cache ────────────────────────────────────────────────
// Survives component unmount/remount (collapse/expand) within the same
// SPA session.  Cleared automatically on full page reload.

/** ID → full record data cache */
type RecordMap = Map<string, Record<string, unknown>>

interface TeamMembersCacheEntry {
  rawMembers: TeamMemberRecord[]
  contactNames: NameMap
  accountNames: NameMap
  parentNames: NameMap
  contactRecords: RecordMap
  accountRecords: RecordMap
  timestamp: number
}

const teamMembersCache = new Map<string, TeamMembersCacheEntry>()
const MAX_CACHE_ENTRIES = 20

function cacheKey(objectApiName: string, recordId: string, rollup: boolean): string {
  return `${objectApiName}:${recordId}:${rollup}`
}

function evictOldestIfNeeded() {
  if (teamMembersCache.size <= MAX_CACHE_ENTRIES) return
  const oldest = teamMembersCache.keys().next().value
  if (oldest !== undefined) teamMembersCache.delete(oldest)
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
  // Try auto-generated lookup field name (e.g. property → PropertyId)
  const lookupField = FIELD_TO_LOOKUP[field]
  if (lookupField && d[lookupField] !== undefined) return d[lookupField]
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

  // 1. Check for Contact-style first+last name fields (prefixed or plain)
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

  // 2. Check for prefixed name fields (e.g. Account__accountName, Account__name, Contact__name)
  for (const key of Object.keys(d)) {
    const lower = key.toLowerCase()
    if ((lower.endsWith('name') || lower.endsWith('__name')) && !lower.includes('firstname') && !lower.includes('lastname')) {
      const val = d[key]
      if (val && typeof val === 'string' && val.trim()) return val
    }
  }

  // 3. Plain fields
  if (d.firstName && d.lastName) return `${String(d.firstName)} ${String(d.lastName)}`
  if (d.name && typeof d.name === 'string' && d.name.trim()) return d.name
  if (d.title && typeof d.title === 'string' && d.title.trim()) return d.title as string
  if (d.label && typeof d.label === 'string' && (d.label as string).trim()) return d.label as string

  return 'Unnamed'
}

/** Batch-resolve a set of record IDs into display names and full record data */
async function resolveRecords(objectApiName: string, ids: string[]): Promise<{ names: NameMap; records: RecordMap }> {
  const names: NameMap = new Map()
  const records: RecordMap = new Map()
  if (ids.length === 0) return { names, records }
  const results = await Promise.allSettled(
    ids.map(id =>
      apiClient.get<Record<string, unknown>>(`/objects/${objectApiName}/records/${id}`)
    )
  )
  for (let i = 0; i < ids.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value) {
      const data = r.value as Record<string, unknown>
      const name = getRecordName(data)
      if (name && name !== ids[i] && name !== 'Unnamed') {
        names.set(ids[i], name)
      }
      records.set(ids[i], data)
    }
  }
  return { names, records }
}

/** Batch-resolve a set of record IDs into display names only (for parent/via labels) */
async function resolveNames(objectApiName: string, ids: string[]): Promise<NameMap> {
  const { names } = await resolveRecords(objectApiName, ids)
  return names
}

/** Fetch records of `objectType` linked to `parentId` via any field variant
 *  for `parentObjectType`.  Tries plain, prefixed, and auto-lookup names,
 *  deduplicates by ID. */
async function fetchLinkedRecords<T extends { id?: unknown }>(
  objectType: string,
  parentObjectType: string,
  parentId: string,
): Promise<T[]> {
  const plain = OBJECT_TO_FIELD[parentObjectType]
  const lookupField = OBJECT_TO_LOOKUP_FIELD[parentObjectType]
  const queries: Promise<T[]>[] = []
  if (plain) {
    queries.push(
      apiClient.get<T[]>(
        `/objects/${objectType}/records?filter[${plain}]=${encodeURIComponent(parentId)}&limit=200`
      ).catch(() => [] as T[])
    )
    queries.push(
      apiClient.get<T[]>(
        `/objects/${objectType}/records?filter[${objectType}__${plain}]=${encodeURIComponent(parentId)}&limit=200`
      ).catch(() => [] as T[])
    )
  }
  if (lookupField) {
    queries.push(
      apiClient.get<T[]>(
        `/objects/${objectType}/records?filter[${lookupField}]=${encodeURIComponent(parentId)}&limit=200`
      ).catch(() => [] as T[])
    )
  }
  const results = await Promise.all(queries)
  const seen = new Set<string>()
  const items: T[] = []
  for (const batch of results) {
    for (const item of (Array.isArray(batch) ? batch : [])) {
      const id = String(item.id)
      if (!seen.has(id)) { seen.add(id); items.push(item) }
    }
  }
  return items
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
    displayFields: configDisplayFields,
  } = config as TeamMembersRollupConfig

  const contactDisplayFields = configDisplayFields?.Contact ?? []
  const accountDisplayFields = configDisplayFields?.Account ?? []

  const objectApiName = object.apiName
  const recordId = record?.id ? String(record.id) : null
  const isSupported = SUPPORTED_OBJECTS.includes(objectApiName)

  // ── Cache-aware state init ──
  const _cacheKey = recordId ? cacheKey(objectApiName, recordId, !!rollupFromProperty) : null
  const _cached = _cacheKey ? teamMembersCache.get(_cacheKey) : null

  const [rawMembers, setRawMembers] = useState<TeamMemberRecord[]>(_cached?.rawMembers ?? [])
  const [contactNames, setContactNames] = useState<NameMap>(_cached?.contactNames ?? new Map())
  const [accountNames, setAccountNames] = useState<NameMap>(_cached?.accountNames ?? new Map())
  /** Maps parentRecordId → display name for "via" labels */
  const [parentNames, setParentNames] = useState<NameMap>(_cached?.parentNames ?? new Map())
  const [contactRecords, setContactRecords] = useState<RecordMap>(_cached?.contactRecords ?? new Map())
  const [accountRecords, setAccountRecords] = useState<RecordMap>(_cached?.accountRecords ?? new Map())
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
    // Only show loading skeleton when there is no cached data to display
    const k = cacheKey(objectApiName, recordId, !!rollupFromProperty)
    if (!teamMembersCache.has(k)) setLoading(true)
    setError(null)

    try {
      let members: TeamMemberRecord[] = []

      if (!rollupFromProperty) {
        // Self-only mode — try plain, prefixed, and auto-lookup field names
        members = await fetchLinkedRecords<TeamMemberRecord>('TeamMember', objectApiName, recordId)
      } else {
        // Rollup mode: gather from Property tree
        let propertyId = ''
        if (objectApiName === 'Property') {
          propertyId = recordId
        } else {
          // Look for the property reference under multiple possible field names
          const recData = (record as Record<string, unknown>).data
            ? (record as Record<string, unknown>).data as Record<string, unknown>
            : record as Record<string, unknown>
          const propField =
            recData.property ||
            recData.PropertyId ||
            recData.propertyId ||
            recData.property_id ||
            recData[`${objectApiName}__property`] ||
            (record as Record<string, unknown>).property ||
            (record as Record<string, unknown>).PropertyId
          if (propField && typeof propField === 'object' && propField !== null && 'id' in propField) {
            propertyId = String((propField as { id: unknown }).id)
          } else if (propField) {
            propertyId = String(propField)
          }
        }

        if (!propertyId) {
          // No property linked, fall back to self-only
          members = await fetchLinkedRecords<TeamMemberRecord>('TeamMember', objectApiName, recordId)
        } else {
          // Phase 1: fetch child record IDs in parallel (tries all field variants)
          const childRecordsByType: Record<string, Record<string, unknown>[]> = {}
          await Promise.all(CHILD_OBJECT_TYPES.map(async type => {
            childRecordsByType[type] = await fetchLinkedRecords<Record<string, unknown>>(type, 'Property', propertyId)
          }))

          // Phase 2: fetch team members in parallel
          const propertyMembersPromise = fetchLinkedRecords<TeamMemberRecord>('TeamMember', 'Property', propertyId)

          const childMemberPromises: Promise<TeamMemberRecord[]>[] = []
          for (const type of CHILD_OBJECT_TYPES) {
            for (const rec of (childRecordsByType[type] ?? [])) {
              childMemberPromises.push(
                fetchLinkedRecords<TeamMemberRecord>('TeamMember', type, String(rec.id))
              )
            }
          }

          const [propertyMembers, ...childMemberBatches] = await Promise.all([
            propertyMembersPromise,
            ...childMemberPromises,
          ])

          // Deduplicate all members
          const seenIds = new Set<string>()
          members = []
          for (const m of propertyMembers) {
            if (!seenIds.has(String(m.id))) { seenIds.add(String(m.id)); members.push(m) }
          }
          for (const batch of childMemberBatches) {
            for (const m of batch) {
              if (!seenIds.has(String(m.id))) { seenIds.add(String(m.id)); members.push(m) }
            }
          }
        }
      }

      // ── Resolve contact/account/parent names ──
      const contactIds = new Set<string>()
      const accountIds = new Set<string>()
      // parentIds grouped by object type for batch resolution
      const parentIdsByType: Record<string, Set<string>> = {}
      for (const m of members) {
        const cid = getLookupId(m, 'contact')
        const aid = getLookupId(m, 'account')
        if (cid) contactIds.add(cid)
        if (aid) accountIds.add(aid)
        // Collect parent record IDs for "via" labels
        for (const [objType, fieldKey] of Object.entries(OBJECT_TO_FIELD)) {
          const pid = getLookupId(m, fieldKey)
          if (pid) {
            if (!parentIdsByType[objType]) parentIdsByType[objType] = new Set()
            parentIdsByType[objType].add(pid)
          }
        }
      }

      // Resolve all names in parallel; contacts/accounts also fetch full records
      const parentResolvers = Object.entries(parentIdsByType).map(
        ([objType, ids]) => resolveNames(objType, Array.from(ids))
      )
      const [cResolved, aResolved, ...parentResults] = await Promise.all([
        resolveRecords('Contact', Array.from(contactIds)),
        resolveRecords('Account', Array.from(accountIds)),
        ...parentResolvers,
      ])

      const cNames = cResolved.names
      const aNames = aResolved.names
      const cRecords = cResolved.records
      const aRecords = aResolved.records

      // Merge all parent names into one map
      const pNames: NameMap = new Map()
      for (const pMap of parentResults) {
        for (const [id, name] of pMap) pNames.set(id, name)
      }

      setRawMembers(members)
      setContactNames(cNames)
      setAccountNames(aNames)
      setParentNames(pNames)
      setContactRecords(cRecords)
      setAccountRecords(aRecords)

      // Persist to module-level cache for instant restore on remount
      const ck = cacheKey(objectApiName, recordId, !!rollupFromProperty)
      teamMembersCache.delete(ck) // refresh insertion order (LRU)
      teamMembersCache.set(ck, {
        rawMembers: members,
        contactNames: cNames,
        accountNames: aNames,
        parentNames: pNames,
        contactRecords: cRecords,
        accountRecords: aRecords,
        timestamp: Date.now(),
      })
      evictOldestIfNeeded()
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
      const contactName =
        (contactId && contactNames.get(contactId)) ||  // resolved via API
        getLookupName(member, 'contact') ||              // embedded object
        getStr(member, 'contactName') ||                 // denormalized field
        getStr(member, 'TeamMember__contactName')        // prefixed denormalized field
      const accountId = getLookupId(member, 'account')
      const accountName =
        (accountId && accountNames.get(accountId)) ||
        getLookupName(member, 'account') ||
        getStr(member, 'accountName') ||
        getStr(member, 'TeamMember__accountName')
      const role = getStr(member, 'role')
      const isPrimary = getField(member, 'primaryContact') === true || getField(member, 'primaryContact') === 'true'
      const isContractHolder = getField(member, 'contractHolder') === true || getField(member, 'contractHolder') === 'true'
      const memberId = String(member.id)

      if (role) roleSet.add(role)

      // Determine "via" source — which parent record this member belongs to
      const viaSources: ViaSource[] = []
      for (const [objType, fieldKey] of Object.entries(OBJECT_TO_FIELD)) {
        const parentId = getLookupId(member, fieldKey)
        if (parentId) {
          const resolvedName = parentNames.get(parentId)
          const embeddedName = getLookupName(member, fieldKey)
          viaSources.push({
            objectApiName: objType,
            recordId: parentId,
            recordName: resolvedName || embeddedName || objType,
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
            contactData: contactRecords.get(contactId) ?? {},
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

      // Merge account — only account-only members (no contact) get their own
      // tile in the Accounts column.  Contact-linked members contribute to the
      // Contacts column only (they already show the account as a subtitle).
      const isAccountOnly = accountId && !contactId
      if (isAccountOnly) {
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
            accountData: accountRecords.get(accountId) ?? {},
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
  }, [rawMembers, currentField, recordId, contactNames, accountNames, parentNames, contactRecords, accountRecords])

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
    if (_cacheKey) teamMembersCache.delete(_cacheKey) // invalidate before refetch
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
    if (_cacheKey) teamMembersCache.delete(_cacheKey) // invalidate before refetch
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
                      displayFields={contactDisplayFields}
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
                      displayFields={accountDisplayFields}
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
  displayFields: string[]
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
  displayFields,
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
          {displayFields.length > 0 && (
            <FieldDisplay data={contact.contactData} fields={displayFields} />
          )}
        </div>
        {canEdit && !isEditing && (
          <div className="flex items-center gap-1 shrink-0">
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
  displayFields,
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
          {displayFields.length > 0 && (
            <FieldDisplay data={account.accountData} fields={displayFields} />
          )}
        </div>
        {canEdit && !isEditing && (
          <div className="flex items-center gap-1 shrink-0">
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

// ── 5f: Add Team Member Modal (Multi-step Salesforce-style) ───────────

type AddStep = 'choose' | 'contact-search' | 'contact-create' | 'contact-form' | 'account-search' | 'account-contacts'

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
  const [step, setStep] = useState<AddStep>('choose')

  // Contact search state
  const [contactSearch, setContactSearch] = useState('')
  const [contactResults, setContactResults] = useState<Record<string, unknown>[]>([])
  const [selectedContact, setSelectedContact] = useState<Record<string, unknown> | null>(null)
  const [searching, setSearching] = useState(false)

  // Contact create state
  const [newFirstName, setNewFirstName] = useState('')
  const [newLastName, setNewLastName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)

  // Contact form (role/flags) state
  const [role, setRole] = useState('')
  const [primaryContact, setPrimaryContact] = useState(false)
  const [contractHolder, setContractHolder] = useState(false)

  // Account search state
  const [accountSearch, setAccountSearch] = useState('')
  const [accountResults, setAccountResults] = useState<Record<string, unknown>[]>([])
  const [selectedAccount, setSelectedAccount] = useState<Record<string, unknown> | null>(null)

  // Account contacts state
  const [accountContacts, setAccountContacts] = useState<Record<string, unknown>[]>([])
  const [loadingAccountContacts, setLoadingAccountContacts] = useState(false)
  const [accountRole, setAccountRole] = useState('')
  const [accountPrimary, setAccountPrimary] = useState(false)
  const [accountContractHolder, setAccountContractHolder] = useState(false)
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set())
  const [contactRoles, setContactRoles] = useState<Record<string, string>>({})

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Debounced contact search
  useEffect(() => {
    if (step !== 'contact-search') return
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
  }, [contactSearch, step])

  // Debounced account search
  useEffect(() => {
    if (step !== 'account-search') return
    if (accountSearch.trim().length < 2) {
      setAccountResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await apiClient.get<Record<string, unknown>[]>(
          `/objects/Account/records/search?q=${encodeURIComponent(accountSearch.trim())}`
        )
        setAccountResults(Array.isArray(data) ? data : [])
      } catch {
        setAccountResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [accountSearch, step])

  // Fetch contacts belonging to selected account
  useEffect(() => {
    if (step !== 'account-contacts' || !selectedAccount) return
    const accountId = String(selectedAccount.id)
    setLoadingAccountContacts(true)
    apiClient.get<Record<string, unknown>[]>(
      `/objects/Contact/records?filter[account]=${encodeURIComponent(accountId)}&limit=200`
    )
      .then(data => setAccountContacts(Array.isArray(data) ? data : []))
      .catch(() => setAccountContacts([]))
      .finally(() => setLoadingAccountContacts(false))
  }, [step, selectedAccount])

  const handleSelectContact = (contact: Record<string, unknown>) => {
    setSelectedContact(contact)
    setContactSearch('')
    setContactResults([])
    setStep('contact-form')
  }

  const handleCreateContact = async () => {
    if (!newLastName.trim()) {
      setError('Last name is required')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {
        lastName: newLastName.trim(),
      }
      if (newFirstName.trim()) payload.firstName = newFirstName.trim()
      if (newEmail.trim()) payload.email = newEmail.trim()
      if (newPhone.trim()) payload.phone = newPhone.trim()

      const created = await apiClient.post<Record<string, unknown>>(
        '/objects/Contact/records',
        { data: payload }
      )
      setSelectedContact(created)
      setStep('contact-form')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create contact')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveContactMember = async () => {
    if (!selectedContact) return
    if (!role) {
      setError('Role is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const parentField = OBJECT_TO_FIELD[objectApiName]
      await apiClient.post('/objects/TeamMember/records', {
        data: {
          [parentField]: recordId,
          contact: String(selectedContact.id),
          contactName: getRecordName(selectedContact),
          role,
          primaryContact,
          contractHolder,
        },
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add team member')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAccountMembers = async () => {
    if (!selectedAccount) return
    if (!accountRole && selectedContactIds.size === 0) {
      setError('Select a role for the account or select individual contacts')
      return
    }
    // Validate: each selected contact needs a role
    for (const cid of selectedContactIds) {
      if (!contactRoles[cid]) {
        setError('Please select a role for each selected contact')
        return
      }
    }
    setSaving(true)
    setError(null)
    try {
      const parentField = OBJECT_TO_FIELD[objectApiName]
      const accountId = String(selectedAccount.id)

      const acctName = getRecordName(selectedAccount)

      // Add account as team member if a role is set
      if (accountRole) {
        await apiClient.post('/objects/TeamMember/records', {
          data: {
            [parentField]: recordId,
            account: accountId,
            accountName: acctName,
            role: accountRole,
            primaryContact: accountPrimary,
            contractHolder: accountContractHolder,
          },
        })
      }

      // Build contact name lookup from the fetched account contacts
      const contactNameMap = new Map<string, string>()
      for (const c of accountContacts) {
        contactNameMap.set(String(c.id), getRecordName(c))
      }

      // Add each selected contact as team member
      for (const contactId of selectedContactIds) {
        try {
          await apiClient.post('/objects/TeamMember/records', {
            data: {
              [parentField]: recordId,
              contact: contactId,
              contactName: contactNameMap.get(contactId) || '',
              account: accountId,
              accountName: acctName,
              role: contactRoles[contactId] || 'Other',
              primaryContact: false,
              contractHolder: false,
            },
          })
        } catch {
          // Skip duplicates, continue with others
        }
      }

      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add team members')
    } finally {
      setSaving(false)
    }
  }

  const toggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev)
      if (next.has(contactId)) next.delete(contactId)
      else next.add(contactId)
      return next
    })
  }

  const inputCls = 'w-full rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition'

  return (
    <ModalOverlay onClose={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
          {step !== 'choose' && (
            <button
              type="button"
              onClick={() => {
                if (step === 'contact-form') setStep('contact-search')
                else if (step === 'contact-create') setStep('contact-search')
                else if (step === 'account-contacts') setStep('account-search')
                else setStep('choose')
                setError(null)
              }}
              className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h3 className="text-sm font-semibold text-brand-dark flex-1">
            {step === 'choose' && 'Add Team Member'}
            {step === 'contact-search' && 'Search Contacts'}
            {step === 'contact-create' && 'Create New Contact'}
            {step === 'contact-form' && 'Add Contact as Team Member'}
            {step === 'account-search' && 'Search Accounts'}
            {step === 'account-contacts' && 'Select Account Contacts'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* ──────── Step: Choose type ──────── */}
          {step === 'choose' && (
            <>
              <p className="text-xs text-brand-gray text-center">What would you like to add?</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep('contact-search')}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-6 text-center transition hover:border-brand-navy/40 hover:bg-brand-navy/5"
                >
                  <UserCircle className="w-10 h-10 text-brand-navy" />
                  <span className="text-sm font-semibold text-brand-dark">Contact</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep('account-search')}
                  className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 bg-gray-50 p-6 text-center transition hover:border-brand-navy/40 hover:bg-brand-navy/5"
                >
                  <Building2 className="w-10 h-10 text-brand-navy" />
                  <div>
                    <span className="text-sm font-semibold text-brand-dark block">Account</span>
                    <span className="text-[10px] text-brand-gray">Add account contacts</span>
                  </div>
                </button>
              </div>
            </>
          )}

          {/* ──────── Step: Contact search ──────── */}
          {step === 'contact-search' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1">
                  <span className="text-red-500">*</span> Search Contacts
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    className={`${inputCls} pl-8`}
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="Type to search contacts..."
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">Searching...</div>
                  )}
                </div>
              </div>

              {contactResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                  {contactResults.map(r => {
                    const name = getRecordName(r)
                    const d = (r.data && typeof r.data === 'object') ? r.data as Record<string, unknown> : r
                    const email = String(d.email || d.Contact__email || '')
                    const phone = String(d.phone || d.Contact__phone || '')
                    return (
                      <button
                        key={String(r.id)}
                        type="button"
                        onClick={() => handleSelectContact(r)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <UserCircle className="w-5 h-5 text-gray-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-brand-dark truncate">{name}</div>
                          {(email || phone) && (
                            <div className="text-[10px] text-brand-gray truncate">
                              {[email, phone].filter(Boolean).join(' \u00b7 ')}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('contact-create'); setError(null) }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-navy hover:underline"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Contact
                </button>
              </div>
            </>
          )}

          {/* ──────── Step: Create new contact ──────── */}
          {step === 'contact-create' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-brand-dark mb-1">First Name</label>
                  <input type="text" className={inputCls} value={newFirstName} onChange={e => setNewFirstName(e.target.value)} placeholder="First name" autoFocus />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-brand-dark mb-1"><span className="text-red-500">*</span> Last Name</label>
                  <input type="text" className={inputCls} value={newLastName} onChange={e => setNewLastName(e.target.value)} placeholder="Last name" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Email</label>
                <input type="email" className={inputCls} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1 flex items-center gap-1"><Phone className="w-3 h-3" /> Phone</label>
                <input type="tel" className={inputCls} value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="(555) 123-4567" />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setStep('contact-search')} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateContact}
                  disabled={creating}
                  className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Continue'}
                </button>
              </div>
            </>
          )}

          {/* ──────── Step: Contact form (role + flags) ──────── */}
          {step === 'contact-form' && selectedContact && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-navy/20 bg-brand-navy/5 text-xs text-brand-dark">
                <UserCircle className="w-4 h-4 text-brand-navy shrink-0" />
                <span className="font-medium flex-1">{getRecordName(selectedContact)}</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1"><span className="text-red-500">*</span> Role</label>
                <select value={role} onChange={e => setRole(e.target.value)} className={inputCls}>
                  <option value="">-- Select Role --</option>
                  {ROLE_PICKLIST.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-1.5 text-xs text-brand-dark cursor-pointer">
                  <input type="checkbox" checked={primaryContact} onChange={e => setPrimaryContact(e.target.checked)} className="rounded border-gray-300" />
                  Primary Contact
                </label>
                <label className="flex items-center gap-1.5 text-xs text-brand-dark cursor-pointer">
                  <input type="checkbox" checked={contractHolder} onChange={e => setContractHolder(e.target.checked)} className="rounded border-gray-300" />
                  Contract Holder
                </label>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContactMember}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </>
          )}

          {/* ──────── Step: Account search ──────── */}
          {step === 'account-search' && (
            <>
              <div>
                <label className="block text-[11px] font-semibold text-brand-dark mb-1">
                  <span className="text-red-500">*</span> Search Accounts
                </label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    className={`${inputCls} pl-8`}
                    value={accountSearch}
                    onChange={e => setAccountSearch(e.target.value)}
                    placeholder="Type to search accounts..."
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">Searching...</div>
                  )}
                </div>
              </div>

              {accountResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-50">
                  {accountResults.map(r => (
                    <button
                      key={String(r.id)}
                      type="button"
                      onClick={() => {
                        setSelectedAccount(r)
                        setAccountSearch('')
                        setAccountResults([])
                        setStep('account-contacts')
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Building2 className="w-5 h-5 text-gray-400 shrink-0" />
                      <span className="text-xs font-medium text-brand-dark flex-1 truncate">{getRecordName(r)}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ──────── Step: Account contacts selection ──────── */}
          {step === 'account-contacts' && selectedAccount && (
            <>
              {/* Account header */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-brand-navy/20 bg-brand-navy/5">
                <Building2 className="w-4 h-4 text-brand-navy shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-brand-dark">{getRecordName(selectedAccount)}</div>
                  <div className="text-[10px] text-brand-gray">Add the account as a team member and/or select individual contacts</div>
                </div>
              </div>

              {/* Add Account as Team Member */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <h4 className="text-[11px] font-semibold text-brand-dark">Add Account as Team Member</h4>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="block text-[10px] text-brand-gray mb-0.5">Account Role</label>
                    <select value={accountRole} onChange={e => setAccountRole(e.target.value)} className={inputCls}>
                      <option value="">Select Role for Account</option>
                      {ROLE_PICKLIST.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer mt-3.5">
                    <input type="checkbox" checked={accountPrimary} onChange={e => setAccountPrimary(e.target.checked)} className="rounded border-gray-300" />
                    Primary
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-brand-dark cursor-pointer mt-3.5">
                    <input type="checkbox" checked={accountContractHolder} onChange={e => setAccountContractHolder(e.target.checked)} className="rounded border-gray-300" />
                    Contract Holder
                  </label>
                </div>
              </div>

              {/* Individual Contacts */}
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <h4 className="text-[11px] font-semibold text-brand-dark">Add Individual Contacts</h4>
                {loadingAccountContacts ? (
                  <div className="py-3 text-center text-xs text-brand-gray animate-pulse">Loading contacts...</div>
                ) : accountContacts.length === 0 ? (
                  <p className="text-[10px] text-gray-400 py-2">No contacts found for this account</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {accountContacts.map(c => {
                      const cid = String(c.id)
                      const name = getRecordName(c)
                      const d = (c.data && typeof c.data === 'object') ? c.data as Record<string, unknown> : c
                      const email = String(d.email || d.Contact__email || '')
                      const phone = String(d.phone || d.Contact__phone || '')
                      const isSelected = selectedContactIds.has(cid)
                      return (
                        <div key={cid} className={`rounded-lg border p-2.5 transition ${isSelected ? 'border-brand-navy/30 bg-white' : 'border-gray-200 bg-white/50'}`}>
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleContactSelection(cid)}
                              className="rounded border-gray-300"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-medium text-brand-dark truncate">{name}</div>
                              {(email || phone) && (
                                <div className="text-[10px] text-brand-gray truncate">
                                  {[email, phone].filter(Boolean).join('\u00b7 ')}
                                </div>
                              )}
                            </div>
                            {isSelected && (
                              <div className="shrink-0">
                                <label className="block text-[10px] text-brand-gray">Role</label>
                                <select
                                  value={contactRoles[cid] || ''}
                                  onChange={e => setContactRoles(prev => ({ ...prev, [cid]: e.target.value }))}
                                  className="rounded border border-gray-200 bg-white px-1.5 py-1 text-[10px] text-brand-dark outline-none focus:border-brand-navy"
                                >
                                  <option value="">Select Role</option>
                                  {ROLE_PICKLIST.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end">
                <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAccountMembers}
                  disabled={saving || (!accountRole && selectedContactIds.size === 0)}
                  className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
                >
                  {saving ? 'Adding...' : 'Add Members'}
                </button>
              </div>
            </>
          )}
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
                            {getLookupName(m, 'contact') || getLookupName(m, 'account') || getLookupId(m, 'contact') || getLookupId(m, 'account') || 'Unknown'}
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
