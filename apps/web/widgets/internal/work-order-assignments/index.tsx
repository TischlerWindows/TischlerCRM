'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Users, Plus, Trash2, Star, Search, X, AlertCircle } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'

// ── Types ──────────────────────────────────────────────────────────────

interface FlatAssignment {
  id: string
  workOrder: string
  technician: string
  isLead: boolean
  notified: boolean
  notes: string
}

interface FlatTechnician {
  id: string
  technicianName: string
  techCode: string
  departmentTags: string | string[]
  active: boolean | string
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Extract a field value from a flattened record, tolerating prefixed keys */
function getField(rec: Record<string, unknown>, field: string): unknown {
  if (field in rec) return rec[field]
  // Try prefixed variants
  for (const key of Object.keys(rec)) {
    if (key.endsWith(`__${field}`)) return rec[key]
  }
  return undefined
}

function getStr(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field)
  return v != null ? String(v) : ''
}

function getBool(rec: Record<string, unknown>, field: string): boolean {
  const v = getField(rec, field)
  return v === true || v === 'true'
}

function getLookupId(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field)
  if (!v) return ''
  if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
  return String(v)
}

/** Check if departmentTags contains 'Service' */
function hasServiceTag(tags: string | string[] | unknown): boolean {
  if (Array.isArray(tags)) return tags.some(t => String(t).toLowerCase() === 'service')
  if (typeof tags === 'string') {
    // Could be comma-separated or semicolon-separated
    return tags.split(/[,;]/).some(t => t.trim().toLowerCase() === 'service')
  }
  return false
}

// ── Skeleton ───────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
        <div className="h-4 bg-gray-100 rounded w-1/3" />
        <div className="h-4 bg-gray-100 rounded w-12 ml-auto" />
      </div>
      <div className="p-4 space-y-3">
        {[1, 2].map(i => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function WorkOrderAssignmentsWidget({ record, object }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  // ── State ──
  const [assignments, setAssignments] = useState<FlatAssignment[]>([])
  const [techMap, setTechMap] = useState<Map<string, FlatTechnician>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Add technician dropdown
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!workOrderId) return
    setError(null)

    try {
      const [assignmentRecords, techRecords] = await Promise.all([
        recordsService.getRecords('WorkOrderAssignment', { limit: 200 }),
        recordsService.getRecords('Technician', { limit: 500 }),
      ])

      // Flatten and filter assignments for this work order
      const flatAssignments = recordsService.flattenRecords(assignmentRecords)
      const filtered: FlatAssignment[] = flatAssignments
        .filter(r => getLookupId(r, 'workOrder') === workOrderId)
        .map(r => ({
          id: String(r.id),
          workOrder: getLookupId(r, 'workOrder'),
          technician: getLookupId(r, 'technician'),
          isLead: getBool(r, 'isLead'),
          notified: getBool(r, 'notified'),
          notes: getStr(r, 'notes'),
        }))

      // Build technician lookup map
      const flatTechs = recordsService.flattenRecords(techRecords)
      const map = new Map<string, FlatTechnician>()
      for (const t of flatTechs) {
        map.set(String(t.id), {
          id: String(t.id),
          technicianName: getStr(t, 'technicianName') || getStr(t, 'name') || 'Unnamed',
          techCode: getStr(t, 'techCode'),
          departmentTags: getField(t, 'departmentTags') as string | string[],
          active: getField(t, 'active') as boolean | string,
        })
      }

      setAssignments(filtered)
      setTechMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false)
        setSearchQuery('')
      }
    }
    if (showAddDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAddDropdown])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showAddDropdown && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [showAddDropdown])

  // ── Add technician ──
  const addTechnician = async (techId: string) => {
    if (!workOrderId) return
    setSaving(true)
    try {
      await recordsService.createRecord('WorkOrderAssignment', {
        data: {
          workOrder: workOrderId,
          technician: techId,
          isLead: false,
          notified: false,
        },
      })
      setShowAddDropdown(false)
      setSearchQuery('')
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add technician')
    } finally {
      setSaving(false)
    }
  }

  // ── Toggle lead ──
  const toggleLead = async (assignmentId: string) => {
    setSaving(true)
    try {
      // Find the assignment being toggled
      const target = assignments.find(a => a.id === assignmentId)
      if (!target) return

      const newIsLead = !target.isLead

      // If setting as lead, unset all others first
      if (newIsLead) {
        const otherLeads = assignments.filter(a => a.id !== assignmentId && a.isLead)
        await Promise.all(
          otherLeads.map(a =>
            recordsService.updateRecord('WorkOrderAssignment', a.id, {
              data: { isLead: false },
            })
          )
        )
      }

      // Set this assignment's lead status
      await recordsService.updateRecord('WorkOrderAssignment', assignmentId, {
        data: { isLead: newIsLead },
      })

      // Update the parent WorkOrder's leadTech field
      if (workOrderId) {
        await recordsService.updateRecord('WorkOrder', workOrderId, {
          data: { leadTech: newIsLead ? target.technician : null },
        })
      }

      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update lead')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete assignment ──
  const handleDelete = async (assignmentId: string) => {
    setDeleting(true)
    try {
      // If removing the lead tech, clear leadTech on the parent WorkOrder
      const target = assignments.find(a => a.id === assignmentId)
      if (target?.isLead && workOrderId) {
        await recordsService.updateRecord('WorkOrder', workOrderId, {
          data: { leadTech: null },
        })
      }

      await recordsService.deleteRecord('WorkOrderAssignment', assignmentId)
      setDeleteTarget(null)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove assignment')
    } finally {
      setDeleting(false)
    }
  }

  // ── Computed: available techs (service dept, active, not already assigned) ──
  const assignedTechIds = new Set(assignments.map(a => a.technician))
  const availableTechs = Array.from(techMap.values())
    .filter(t =>
      hasServiceTag(t.departmentTags) &&
      (t.active === true || t.active === 'true') &&
      !assignedTechIds.has(t.id)
    )
    .filter(t => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return (
        t.technicianName.toLowerCase().includes(q) ||
        t.techCode.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => a.technicianName.localeCompare(b.technicianName))

  // ── Render ──
  if (!workOrderId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        No work order selected.
      </div>
    )
  }

  if (loading) return <Skeleton />

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {/* ── Header ── */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-navy flex-1">
            Assigned Technicians
          </h3>
          <span className="text-[11px] text-brand-gray tabular-nums">
            {assignments.length} tech{assignments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-4 space-y-3">
          {assignments.length === 0 ? (
            <div className="py-6 text-center">
              <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-brand-gray">No technicians assigned yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Tech Name</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Tech Code</th>
                    <th className="text-center py-2 px-2 font-semibold text-brand-navy">Lead</th>
                    <th className="text-center py-2 px-2 font-semibold text-brand-navy">Notified</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Notes</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map(a => {
                    const tech = techMap.get(a.technician)
                    return (
                      <tr
                        key={a.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-2 text-brand-dark font-medium">
                          {tech?.technicianName ?? 'Unknown'}
                        </td>
                        <td className="py-2 px-2 text-brand-gray">
                          {tech?.techCode ?? '—'}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleLead(a.id)}
                            disabled={saving}
                            className="inline-flex items-center justify-center disabled:opacity-50"
                            title={a.isLead ? 'Remove as lead' : 'Set as lead'}
                          >
                            {a.isLead ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                                <Star className="w-3 h-3 fill-blue-500" />
                                Lead
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                                <Star className="w-3 h-3" />
                                Set Lead
                              </span>
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-center">
                          {a.notified ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-100 text-green-800">
                              Notified
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium text-gray-400">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-brand-gray max-w-[200px] truncate">
                          {a.notes || '—'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(a.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove assignment"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Add Technician ── */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setShowAddDropdown(!showAddDropdown)}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-navy hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Technician
            </button>

            {showAddDropdown && (
              <div className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-gray-200 bg-white shadow-lg z-20">
                {/* Search input */}
                <div className="p-2 border-b border-gray-100">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search by name or code..."
                      className="w-full pl-7 pr-2 py-1.5 rounded border border-gray-200 text-xs outline-none focus:border-brand-navy"
                    />
                  </div>
                </div>

                {/* Technician list */}
                <div className="max-h-48 overflow-y-auto">
                  {availableTechs.length === 0 ? (
                    <div className="p-3 text-center text-xs text-brand-gray">
                      {searchQuery
                        ? 'No matching technicians found'
                        : 'No available service technicians'}
                    </div>
                  ) : (
                    availableTechs.map(tech => (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() => addTechnician(tech.id)}
                        disabled={saving}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-brand-dark block truncate">
                            {tech.technicianName}
                          </span>
                          {tech.techCode && (
                            <span className="text-[10px] text-brand-gray">{tech.techCode}</span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-brand-dark">Remove technician?</p>
              <p className="text-xs text-brand-gray">
                This removes the technician assignment from this work order.
                The technician record itself is not affected.
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
                  disabled={deleting}
                  onClick={() => handleDelete(deleteTarget)}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
