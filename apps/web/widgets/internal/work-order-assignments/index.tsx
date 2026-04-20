'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Star, StarOff, Loader2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'

// ── Types ──────────────────────────────────────────────────────────────

interface Assignment {
  id: string
  data: {
    workOrder?: string
    technician?: string
    isLead?: boolean
    notified?: boolean
    notes?: string
  }
}

interface Tech {
  id: string
  data: {
    technicianName?: string
    techCode?: string
    departmentTags?: string[] | string
    active?: boolean
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract a string field from a raw API record, tolerating both flat and
 * nested-data shapes and prefixed keys (e.g. WorkOrderAssignment__workOrder).
 */
function getDataField(raw: Record<string, unknown>, field: string): unknown {
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as Record<string, unknown>
    if (d[field] !== undefined) return d[field]
    // Try common prefix pattern
    for (const key of Object.keys(d)) {
      if (key === field || key.endsWith(`__${field}`)) return d[key]
    }
  }
  if (raw[field] !== undefined) return raw[field]
  for (const key of Object.keys(raw)) {
    if (key === field || key.endsWith(`__${field}`)) return raw[key]
  }
  return undefined
}

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

function hasDepartmentTag(tech: Tech, tag: string): boolean {
  const tags = tech.data.departmentTags
  if (!tags) return false
  if (Array.isArray(tags)) return tags.includes(tag)
  // May be stored as a comma-separated string
  return String(tags).split(',').map(t => t.trim()).includes(tag)
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function WorkOrderAssignmentsWidget({ record }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [techs, setTechs] = useState<Record<string, Tech>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [allServiceTechs, setAllServiceTechs] = useState<Tech[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    setError(null)
    try {
      // Use apiClient.get directly so we can pass filter params
      const params = new URLSearchParams({
        'filter[workOrder]': workOrderId,
        limit: '200',
      })
      const raw = await apiClient.get<Record<string, unknown>[]>(
        `/objects/WorkOrderAssignment/records?${params}`
      )
      const list: Assignment[] = (Array.isArray(raw) ? raw : []).map(r => ({
        id: String(r.id),
        data: {
          workOrder: str(getDataField(r, 'workOrder')),
          technician: str(getDataField(r, 'technician')),
          isLead: getDataField(r, 'isLead') === true || getDataField(r, 'isLead') === 'true',
          notified: getDataField(r, 'notified') === true || getDataField(r, 'notified') === 'true',
          notes: str(getDataField(r, 'notes')),
        },
      }))
      setAssignments(list)

      // Resolve tech names (fetch each unknown technician)
      const techMap: Record<string, Tech> = {}
      const missing = list
        .map(a => a.data.technician)
        .filter((tid): tid is string => !!tid)
      await Promise.all(
        [...new Set(missing)].map(async (tid) => {
          const t = await recordsService.getRecord('Technician', tid)
          if (t) techMap[tid] = t as unknown as Tech
        })
      )
      setTechs(prev => ({ ...prev, ...techMap }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load assignments')
    } finally {
      setLoading(false)
    }
  }, [workOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload()
  }, [reload])

  async function openPicker() {
    setPickerLoading(true)
    setShowPicker(true)
    try {
      const raw = await apiClient.get<Record<string, unknown>[]>(
        '/objects/Technician/records?limit=200'
      )
      const all: Tech[] = (Array.isArray(raw) ? raw : []).map(r => ({
        id: String(r.id),
        data: {
          technicianName: str(getDataField(r, 'technicianName')),
          techCode: str(getDataField(r, 'techCode')),
          departmentTags: getDataField(r, 'departmentTags') as string[] | string | undefined,
          active: getDataField(r, 'active') !== false && getDataField(r, 'active') !== 'false',
        },
      }))
      setAllServiceTechs(
        all.filter(t => t.data.active !== false && hasDepartmentTag(t, 'Service'))
      )
    } catch {
      // Leave picker open; show empty list
      setAllServiceTechs([])
    } finally {
      setPickerLoading(false)
    }
  }

  async function addTech(techId: string) {
    if (!workOrderId) return
    setSaving(true)
    try {
      const isFirstTech = assignments.length === 0
      await recordsService.createRecord('WorkOrderAssignment', {
        data: {
          workOrder: workOrderId,
          technician: techId,
          isLead: isFirstTech,
          notified: false,
        },
      })
      if (isFirstTech) {
        await recordsService.updateRecord('WorkOrder', workOrderId, {
          data: { leadTech: techId },
        })
      }
      setShowPicker(false)
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add technician. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleLead(assignment: Assignment) {
    if (!workOrderId || saving) return
    setSaving(true)
    try {
      await Promise.all(
        assignments.map(a =>
          recordsService.updateRecord('WorkOrderAssignment', a.id, {
            data: { isLead: a.id === assignment.id },
          })
        )
      )
      await recordsService.updateRecord('WorkOrder', workOrderId, {
        data: { leadTech: assignment.data.technician ?? null },
      })
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update lead technician')
    } finally {
      setSaving(false)
    }
  }

  async function removeAssignment(assignmentId: string) {
    if (saving) return
    setSaving(true)
    try {
      await recordsService.deleteRecord('WorkOrderAssignment', assignmentId)
      await reload()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove assignment. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Guard: no parent record ──
  if (!workOrderId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        No Work Order record loaded
      </div>
    )
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-brand-navy" />
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  // ── Already-assigned tech IDs (for picker deduplication) ──
  const assignedTechIds = new Set(assignments.map(a => a.data.technician).filter(Boolean))

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
        <span className="text-xs font-semibold text-brand-gray uppercase tracking-wide">
          Assigned Technicians
          <span className="ml-2 font-normal text-[11px]">({assignments.length})</span>
        </span>
        <button
          type="button"
          onClick={openPicker}
          disabled={saving}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3 h-3" />
          Add Technician
        </button>
      </div>

      {/* Table */}
      {assignments.length === 0 ? (
        <p className="p-6 text-xs text-brand-gray text-center">No technicians assigned yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Tech Name</th>
                <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Code</th>
                <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Lead</th>
                <th className="px-4 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Notified</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => {
                const tech = a.data.technician ? techs[a.data.technician] : undefined
                return (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-brand-dark">
                      {tech?.data.technicianName || '—'}
                    </td>
                    <td className="px-4 py-2.5 text-brand-gray">
                      {tech?.data.techCode || '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        title={a.data.isLead ? 'Lead technician' : 'Set as lead'}
                        onClick={() => toggleLead(a)}
                        disabled={saving}
                        className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50"
                      >
                        {a.data.isLead ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 rounded px-2 py-0.5">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            Lead
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400 hover:text-amber-500 rounded px-2 py-0.5">
                            <StarOff className="w-3 h-3" />
                            Set Lead
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-brand-gray">
                      {a.data.notified ? (
                        <span className="text-green-600 font-medium">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        type="button"
                        title="Remove assignment"
                        onClick={() => removeAssignment(a.id)}
                        disabled={saving}
                        className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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

      {/* Technician Picker */}
      {showPicker && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowPicker(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-dark">Pick a Service Technician</p>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto">
                {pickerLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-4 h-4 animate-spin text-brand-navy" />
                  </div>
                ) : allServiceTechs.length === 0 ? (
                  <p className="p-4 text-xs text-brand-gray text-center">No active Service technicians found.</p>
                ) : (
                  <ul className="divide-y divide-gray-50">
                    {allServiceTechs
                      .filter(t => !assignedTechIds.has(t.id))
                      .map(t => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => addTech(t.id)}
                            disabled={saving}
                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 transition-colors disabled:opacity-50"
                          >
                            <span className="text-xs font-medium text-brand-dark">
                              {t.data.technicianName || t.id}
                            </span>
                            {t.data.techCode && (
                              <span className="text-[11px] text-brand-gray ml-2 shrink-0">
                                {t.data.techCode}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
