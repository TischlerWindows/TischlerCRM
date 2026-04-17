'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, Search, ChevronUp, ChevronDown, MoreHorizontal, Trash2, ExternalLink } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { useSchemaStore } from '@/lib/schema-store'

// ── Types ──────────────────────────────────────────────────────────────

type FilterOperator =
  | 'equals' | 'not_equals' | 'contains' | 'not_contains'
  | 'greater_than' | 'less_than' | 'is_empty' | 'is_not_empty'

interface FilterRule { field: string; operator: FilterOperator; value: string }

type SortDir = 'asc' | 'desc'

// ── Routing helper (mirrors universal-search.tsx) ─────────────────────

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
}

function recordUrl(objectApiName: string, recordId: string, fromPath?: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  const base = prefix ? `${prefix}/${recordId}` : `/objects/${objectApiName}/${recordId}`
  return fromPath ? `${base}?from=${encodeURIComponent(fromPath)}` : base
}

function newRecordUrl(objectApiName: string, linkField: string, linkValue: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  const base = prefix ?? `/objects/${objectApiName}`
  return `${base}?new=true&${linkField}=${encodeURIComponent(linkValue)}`
}

function listUrl(objectApiName: string, linkField: string, linkValue: string) {
  const prefix = DEDICATED_ROUTES[objectApiName]
  const base = prefix ?? `/objects/${objectApiName}`
  return `${base}?filter[${linkField}]=${encodeURIComponent(linkValue)}`
}

// ── Client-side filter engine ─────────────────────────────────────────

// Flatten raw API record to top-level keys (same as recordsService.flattenRecord)
function flattenRow(raw: Record<string, unknown>): Record<string, unknown> {
  const data = (raw.data && typeof raw.data === 'object') ? raw.data as Record<string, unknown> : {}
  const flat: Record<string, unknown> = {}

  // Build a case-insensitive lookup map for all data keys
  for (const [key, value] of Object.entries(data)) {
    flat[key] = value
    flat[key.toLowerCase()] = value
    // Strip double-underscore prefix (Deal__dealName → dealName)
    const stripped = key.replace(/^[A-Za-z]+__/, '')
    if (stripped !== key) {
      flat[stripped] = value
      flat[stripped.toLowerCase()] = value
    }
    // Strip single-underscore prefix (DEAL_DEALNAME → DEALNAME)
    const singleStripped = key.replace(/^[A-Za-z]+_/, '')
    if (singleStripped !== key && singleStripped !== stripped) {
      flat[singleStripped] = value
      flat[singleStripped.toLowerCase()] = value
    }
  }

  // System fields set AFTER data loop so they can never be overwritten
  flat.id = raw.id
  flat.createdAt = raw.createdAt
  flat.updatedAt = raw.updatedAt
  if (raw.createdBy && typeof raw.createdBy === 'object') {
    flat.createdBy = (raw.createdBy as any).name || (raw.createdBy as any).email || 'Unknown'
  }
  return flat
}

function getVal(row: Record<string, unknown>, field: string): unknown {
  if (row[field] !== undefined) return row[field]
  if (row[field.toLowerCase()] !== undefined) return row[field.toLowerCase()]
  // Strip single-underscore prefix: DEAL_DEALNAME → DEALNAME → dealname
  const stripped = field.replace(/^[A-Za-z]+_/, '')
  if (stripped !== field) {
    if (row[stripped] !== undefined) return row[stripped]
    if (row[stripped.toLowerCase()] !== undefined) return row[stripped.toLowerCase()]
  }
  // Strip double-underscore prefix: Deal__dealName → dealName
  const dblStripped = field.replace(/^[A-Za-z]+__/, '')
  if (dblStripped !== field) {
    if (row[dblStripped] !== undefined) return row[dblStripped]
    if (row[dblStripped.toLowerCase()] !== undefined) return row[dblStripped.toLowerCase()]
  }
  return undefined
}

function applyFilter(row: Record<string, unknown>, rule: FilterRule): boolean {
  const rawVal = getVal(row, rule.field)
  const cellStr = rawVal !== null && rawVal !== undefined ? String(rawVal).toLowerCase() : ''
  const ruleVal = rule.value.toLowerCase()

  switch (rule.operator) {
    case 'equals':       return cellStr === ruleVal
    case 'not_equals':   return cellStr !== ruleVal
    case 'contains':     return cellStr.includes(ruleVal)
    case 'not_contains': return !cellStr.includes(ruleVal)
    case 'greater_than': return parseFloat(cellStr) > parseFloat(ruleVal)
    case 'less_than':    return parseFloat(cellStr) < parseFloat(ruleVal)
    case 'is_empty':     return cellStr === ''
    case 'is_not_empty': return cellStr !== ''
    default:             return true
  }
}

function applyFilters(rows: Record<string, unknown>[], rules: FilterRule[]): Record<string, unknown>[] {
  if (!rules.length) return rows
  return rows.filter(row => rules.every(rule => applyFilter(row, rule)))
}

// ── Cell value helper ─────────────────────────────────────────────────

function getCellValue(row: Record<string, unknown>, col: string): string {
  const val = getVal(row, col)
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    const v = val as Record<string, unknown>
    if (v.street || v.city || v.state || v.postalCode || v.country) {
      return [v.street, v.city, v.state, v.postalCode, v.country].filter(Boolean).join(', ') || '—'
    }
    return JSON.stringify(val)
  }
  return val !== undefined && val !== null ? String(val) : '—'
}

// ── Skeleton loader ───────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-12 ml-auto" />
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="px-4 py-3 border-b border-gray-50 flex gap-4">
          <div className="h-3 bg-gray-100 rounded w-1/4" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-1/5" />
        </div>
      ))}
    </div>
  )
}

// ── Main widget ───────────────────────────────────────────────────────

export default function RelatedListWidget({ config, record }: WidgetProps) {
  const pathname = usePathname()
  const schema = useSchemaStore((s) => s.schema)
  const {
    objectApiName,
    columns = [],
    linkField,
    sortField,
    sortDirection = 'desc',
    rowLimit = 10,
    showSearch = false,
    viewMode = 'list',
    showActionBar = false,
    showNewButton = true,
    filters: adminFilters = [],
  } = config as {
    objectApiName?: string
    columns?: string[]
    linkField?: string
    sortField?: string
    sortDirection?: SortDir
    rowLimit?: number
    showSearch?: boolean
    viewMode?: 'list' | 'tile'
    showActionBar?: boolean
    showNewButton?: boolean
    filters?: FilterRule[]
  }

  // Build field label map for displaying nice column headers
  const fieldLabelMap = useMemo(() => {
    const map: Record<string, string> = {}
    const obj = schema?.objects?.find(o => o.apiName === objectApiName)
    if (obj?.fields) {
      for (const f of obj.fields) {
        map[f.apiName] = f.label
        map[f.apiName.toLowerCase()] = f.label
      }
    }
    return map
  }, [schema?.objects, objectApiName])

  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null)

  const recordId = record?.id ? String(record.id) : null

  // Fetch all rows matching the link field (up to 200 for client-side ops)
  useEffect(() => {
    if (!objectApiName || !linkField || !recordId) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      [`filter[${linkField}]`]: recordId,
      limit: '200',
      ...(sortField ? { orderBy: sortField, orderDir: sortDirection } : {}),
    })

    apiClient.get<Record<string, unknown>[]>(`/objects/${objectApiName}/records?${params}`)
      .then(data => setAllRows(Array.isArray(data) ? data.map(flattenRow) : []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [objectApiName, linkField, sortField, sortDirection, recordId])

  // Apply admin-defined filters
  const adminFiltered = useMemo(
    () => applyFilters(allRows, adminFilters as FilterRule[]),
    [allRows, adminFilters]
  )

  // Apply live search
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return adminFiltered
    const q = search.toLowerCase()
    return adminFiltered.filter(row => {
      const data = (row.data as Record<string, unknown>) ?? row
      return Object.values(data).some(v => String(v ?? '').toLowerCase().includes(q))
    })
  }, [adminFiltered, search])

  // Apply column sort (overrides API sort when user clicks a header)
  const sorted = useMemo(() => {
    if (!sortCol) return searchFiltered
    return [...searchFiltered].sort((a, b) => {
      const aVal = getCellValue(a, sortCol)
      const bVal = getCellValue(b, sortCol)
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
    })
  }, [searchFiltered, sortCol, sortAsc])

  // Apply row limit for display; keep full count for View All badge
  const displayRows = sorted.slice(0, rowLimit)
  const totalMatched = sorted.length

  const displayColumns = (columns as string[]).length > 0 ? (columns as string[]) : ['name']

  const handleSortColumn = (col: string) => {
    if (sortCol === col) {
      setSortAsc(a => !a)
    } else {
      setSortCol(col)
      setSortAsc(true)
    }
  }

  const handleDelete = async (rowId: string) => {
    if (!objectApiName) return
    setDeletingId(rowId)
    try {
      await apiClient.delete(`/objects/${objectApiName}/records/${rowId}`)
      setAllRows(prev => prev.filter(r => String(r.id) !== rowId))
    } catch {
      // ignore — row stays in list
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  // ── Unconfigured ──
  if (!objectApiName || !linkField) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        Configure this Related List widget in the properties panel
      </div>
    )
  }

  if (loading) return <Skeleton />

  if (error) {
    return <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">{error}</div>
  }

  const canShowNew = showActionBar && showNewButton && recordId

  // ── Tile view ──
  if (viewMode === 'tile') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <Header
          totalMatched={totalMatched}
          rowLimit={rowLimit}
          objectApiName={objectApiName}
          linkField={linkField}
          recordId={recordId}
          canShowNew={!!canShowNew}
          showSearch={showSearch}
          search={search}
          onSearch={setSearch}
          allCount={allRows.length}
        />
        {displayRows.length === 0 ? (
          <p className="p-6 text-xs text-brand-gray text-center">No related records</p>
        ) : (
          <div className="p-3 grid grid-cols-2 gap-3">
            {displayRows.map((row) => {
              const rowId = String(row.id)
              const href = recordUrl(objectApiName, rowId, pathname)
              return (
                <Link
                  key={rowId}
                  href={href}
                  className="block rounded-lg border border-gray-200 bg-gray-50 hover:bg-white hover:shadow-sm p-3 transition-all group"
                >
                  {displayColumns.map(col => (
                    <div key={col} className="mb-1.5 last:mb-0">
                      <p className="text-[10px] font-semibold text-brand-gray uppercase tracking-wide">{fieldLabelMap[col] || fieldLabelMap[col.toLowerCase()] || col}</p>
                      <p className="text-xs font-medium text-brand-dark truncate">{getCellValue(row, col)}</p>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center text-[10px] text-brand-navy font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Open record <ExternalLink className="w-3 h-3 ml-1" />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
        {totalMatched > rowLimit && (
          <ViewAllFooter
            objectApiName={objectApiName}
            linkField={linkField}
            recordId={recordId!}
            count={totalMatched}
          />
        )}
      </div>
    )
  }

  // ── List / Table view (default) ──
  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <Header
          totalMatched={totalMatched}
          rowLimit={rowLimit}
          objectApiName={objectApiName}
          linkField={linkField}
          recordId={recordId}
          canShowNew={!!canShowNew}
          showSearch={showSearch}
          search={search}
          onSearch={setSearch}
          allCount={allRows.length}
        />

        {displayRows.length === 0 ? (
          <p className="p-6 text-xs text-brand-gray text-center">No related records</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  {displayColumns.map(col => (
                    <th
                      key={col}
                      className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px] cursor-pointer hover:text-brand-dark select-none"
                      onClick={() => handleSortColumn(col)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {fieldLabelMap[col] || fieldLabelMap[col.toLowerCase()] || col}
                        {sortCol === col ? (
                          sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        ) : (
                          <span className="w-3 h-3 opacity-0 group-hover:opacity-40">↕</span>
                        )}
                      </span>
                    </th>
                  ))}
                  {/* Actions column */}
                  <th className="w-10 px-2 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const rowId = String(row.id)
                  const href = recordUrl(objectApiName, rowId, pathname)
                  const isMenuOpen = openRowMenu === rowId
                  return (
                    <tr
                      key={rowId}
                      className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors group"
                    >
                      {displayColumns.map((col, ci) => (
                        <td key={col} className="px-4 py-2.5 text-brand-dark">
                          {ci === 0 ? (
                            <Link
                              href={href}
                              className="font-medium text-brand-navy hover:underline"
                              onClick={e => e.stopPropagation()}
                            >
                              {getCellValue(row, col)}
                            </Link>
                          ) : (
                            getCellValue(row, col)
                          )}
                        </td>
                      ))}
                      {/* Row actions menu */}
                      <td className="px-2 py-2 text-right relative">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setOpenRowMenu(isMenuOpen ? null : rowId) }}
                          className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                          aria-label="Row actions"
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                        {isMenuOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenRowMenu(null)} />
                            <div className="absolute right-0 top-full mt-0.5 z-40 w-36 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                              <Link
                                href={href}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs text-brand-dark hover:bg-gray-50"
                                onClick={() => setOpenRowMenu(null)}
                              >
                                <ExternalLink className="w-3 h-3 text-gray-400" />
                                View
                              </Link>
                              <button
                                type="button"
                                onClick={() => { setDeleteTarget(rowId); setOpenRowMenu(null) }}
                                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalMatched > rowLimit && (
          <ViewAllFooter
            objectApiName={objectApiName}
            linkField={linkField}
            recordId={recordId!}
            count={totalMatched}
          />
        )}
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-brand-dark">Delete related record?</p>
              <p className="text-xs text-brand-gray">This action cannot be undone.</p>
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
                  {deletingId === deleteTarget ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────

interface HeaderProps {
  totalMatched: number
  rowLimit: number
  objectApiName: string
  linkField: string
  recordId: string | null
  canShowNew: boolean
  showSearch: boolean
  search: string
  onSearch: (v: string) => void
  allCount: number
}

function Header({
  totalMatched, rowLimit, objectApiName, linkField, recordId,
  canShowNew, showSearch, search, onSearch, allCount,
}: HeaderProps) {
  return (
    <div className="px-4 py-2 flex items-center gap-2 border-b border-gray-100">
      {showSearch && (
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search records…"
            className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs text-brand-dark outline-none focus:border-brand-navy transition"
          />
        </div>
      )}
      {!showSearch && <div className="flex-1" />}
      <span className="text-[11px] text-brand-gray tabular-nums shrink-0">
        {totalMatched > rowLimit
          ? `${rowLimit} of ${totalMatched}`
          : `${totalMatched}`}
        {allCount !== totalMatched && (
          <span className="text-gray-400"> / {allCount} total</span>
        )}
      </span>
      {canShowNew && recordId && (
        <Link
          href={newRecordUrl(objectApiName, linkField, recordId)}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 transition-colors shrink-0"
        >
          <Plus className="w-3 h-3" />
          New
        </Link>
      )}
    </div>
  )
}

function ViewAllFooter({
  objectApiName, linkField, recordId, count,
}: {
  objectApiName: string
  linkField: string
  recordId: string
  count: number
}) {
  return (
    <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
      <span className="text-[11px] text-brand-gray">
        Showing first {Math.min(count, 50)} — {count} match{count !== 1 ? 'es' : ''}
      </span>
      <Link
        href={listUrl(objectApiName, linkField, recordId)}
        className="text-[11px] font-semibold text-brand-navy hover:underline inline-flex items-center gap-1"
      >
        View All <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  )
}
