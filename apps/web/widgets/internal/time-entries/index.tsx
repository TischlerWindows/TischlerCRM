'use client'

import { useState, useEffect, useCallback } from 'react'
import { Clock, Plus, Trash2, X, AlertCircle } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'

// ── Types ──────────────────────────────────────────────────────────────

interface FlatTimeEntry {
  id: string
  workOrder: string
  technician: string
  date: string
  workHours: number
  travelHours: number
  prepHours: number
  miscHours: number
  totalHours: number
  rateAtEntry: number
  totalCost: number
  notes: string
}

interface FlatTechnician {
  id: string
  technicianName: string
}

// ── Helpers ────────────────────────────────────────────────────────────

function getField(rec: Record<string, unknown>, field: string): unknown {
  if (field in rec) return rec[field]
  for (const key of Object.keys(rec)) {
    if (key.endsWith(`__${field}`)) return rec[key]
  }
  return undefined
}

function getStr(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field)
  return v != null ? String(v) : ''
}

function getNum(rec: Record<string, unknown>, field: string): number {
  const v = getField(rec, field)
  return typeof v === 'number' ? v : Number(v) || 0
}

function getLookupId(rec: Record<string, unknown>, field: string): string {
  const v = getField(rec, field)
  if (!v) return ''
  if (typeof v === 'object' && v !== null && 'id' in v) return String((v as { id: unknown }).id)
  return String(v)
}

function fmtCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
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
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  )
}

// ── Add Entry Modal ──────────────────────────────────────────────────

interface AddEntryFormData {
  date: string
  technician: string
  workHours: string
  travelHours: string
  prepHours: string
  miscHours: string
  notes: string
}

function AddEntryModal({
  techs,
  onSave,
  onClose,
  saving,
}: {
  techs: FlatTechnician[]
  onSave: (form: AddEntryFormData) => void
  onClose: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<AddEntryFormData>({
    date: todayISO(),
    technician: '',
    workHours: '',
    travelHours: '',
    prepHours: '',
    miscHours: '',
    notes: '',
  })

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-brand-dark">Log Hours</h4>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Technician *</label>
              <select
                value={form.technician}
                onChange={e => setForm(f => ({ ...f, technician: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
              >
                <option value="">-- Select --</option>
                {techs.map(t => (
                  <option key={t.id} value={t.id}>{t.technicianName}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Work Hrs</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.workHours}
                  onChange={e => setForm(f => ({ ...f, workHours: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Travel Hrs</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.travelHours}
                  onChange={e => setForm(f => ({ ...f, travelHours: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Prep Hrs</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.prepHours}
                  onChange={e => setForm(f => ({ ...f, prepHours: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-brand-navy mb-1">Misc Hrs</label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={form.miscHours}
                  onChange={e => setForm(f => ({ ...f, miscHours: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-brand-navy mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes..."
                rows={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs outline-none focus:border-brand-navy resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-gray hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !form.technician || !form.date}
              onClick={() => onSave(form)}
              className="px-3 py-1.5 rounded-lg bg-brand-navy text-xs font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Log Hours'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function TimeEntriesWidget({ record, object }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  // ── State ──
  const [entries, setEntries] = useState<FlatTimeEntry[]>([])
  const [techMap, setTechMap] = useState<Map<string, FlatTechnician>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ── Fetch data ──
  const fetchData = useCallback(async () => {
    if (!workOrderId) return
    setError(null)

    try {
      const [timeRecords, techRecords, assignmentRecords] = await Promise.all([
        recordsService.getRecords('TimeEntry', { limit: 500 }),
        recordsService.getRecords('Technician', { limit: 500 }),
        recordsService.getRecords('WorkOrderAssignment', { limit: 200 }),
      ])

      // Flatten and filter time entries for this work order
      const flatEntries = recordsService.flattenRecords(timeRecords)
      const filtered: FlatTimeEntry[] = flatEntries
        .filter(r => getLookupId(r, 'workOrder') === workOrderId)
        .map(r => ({
          id: String(r.id),
          workOrder: getLookupId(r, 'workOrder'),
          technician: getLookupId(r, 'technician'),
          date: getStr(r, 'date'),
          workHours: getNum(r, 'workHours'),
          travelHours: getNum(r, 'travelHours'),
          prepHours: getNum(r, 'prepHours'),
          miscHours: getNum(r, 'miscHours'),
          totalHours: getNum(r, 'totalHours'),
          rateAtEntry: getNum(r, 'rateAtEntry'),
          totalCost: getNum(r, 'totalCost'),
          notes: getStr(r, 'notes'),
        }))
        .sort((a, b) => b.date.localeCompare(a.date))

      // Build technician lookup map
      const flatTechs = recordsService.flattenRecords(techRecords)
      const map = new Map<string, FlatTechnician>()
      for (const t of flatTechs) {
        map.set(String(t.id), {
          id: String(t.id),
          technicianName: getStr(t, 'technicianName') || getStr(t, 'name') || 'Unnamed',
        })
      }

      setEntries(filtered)
      setTechMap(map)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }, [workOrderId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Assigned techs for modal dropdown ──
  const assignedTechIds = new Set<string>()
  // We already have entries; extract assigned tech IDs from assignments
  // (fetched in fetchData but we need to pass them to the modal)
  const [assignedTechs, setAssignedTechs] = useState<FlatTechnician[]>([])

  useEffect(() => {
    async function loadAssignedTechs() {
      if (!workOrderId) return
      try {
        const assignmentRecords = await recordsService.getRecords('WorkOrderAssignment', { limit: 200 })
        const flatAssignments = recordsService.flattenRecords(assignmentRecords)
        const techIds = flatAssignments
          .filter(r => getLookupId(r, 'workOrder') === workOrderId)
          .map(r => getLookupId(r, 'technician'))
          .filter(Boolean)

        const techs: FlatTechnician[] = techIds
          .map(id => techMap.get(id))
          .filter((t): t is FlatTechnician => !!t)
          .sort((a, b) => a.technicianName.localeCompare(b.technicianName))

        setAssignedTechs(techs)
      } catch {
        // Fallback: use all techs from map
        setAssignedTechs(
          Array.from(techMap.values()).sort((a, b) => a.technicianName.localeCompare(b.technicianName))
        )
      }
    }
    loadAssignedTechs()
  }, [workOrderId, techMap])

  // ── Add entry ──
  const addEntry = async (form: AddEntryFormData) => {
    if (!workOrderId) return
    setSaving(true)
    try {
      await recordsService.createRecord('TimeEntry', {
        data: {
          workOrder: workOrderId,
          technician: form.technician,
          date: form.date,
          workHours: form.workHours ? Number(form.workHours) : 0,
          travelHours: form.travelHours ? Number(form.travelHours) : 0,
          prepHours: form.prepHours ? Number(form.prepHours) : 0,
          miscHours: form.miscHours ? Number(form.miscHours) : 0,
          notes: form.notes || '',
        },
      })
      setShowAddModal(false)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to log hours')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete entry ──
  const handleDelete = async (entryId: string) => {
    setDeleting(true)
    try {
      await recordsService.deleteRecord('TimeEntry', entryId)
      setDeleteTarget(null)
      await fetchData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete time entry')
    } finally {
      setDeleting(false)
    }
  }

  // ── Totals ──
  const totalHoursSum = entries.reduce((s, e) => s + e.totalHours, 0)
  const totalCostSum = entries.reduce((s, e) => s + e.totalCost, 0)

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
          <Clock className="w-4 h-4 text-brand-gray" />
          <h3 className="text-xs font-semibold text-brand-navy flex-1">
            Time Entries
          </h3>
          <span className="text-[11px] text-brand-gray tabular-nums">
            {entries.length} entr{entries.length !== 1 ? 'ies' : 'y'}
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
          {entries.length === 0 ? (
            <div className="py-6 text-center">
              <Clock className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-xs text-brand-gray">No time entries yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Date</th>
                    <th className="text-left py-2 px-2 font-semibold text-brand-navy">Tech</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Work</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Travel</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Prep</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Misc</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Total Hrs</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Rate</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Cost</th>
                    <th className="text-right py-2 px-2 font-semibold text-brand-navy">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(entry => {
                    const tech = techMap.get(entry.technician)
                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                      >
                        <td className="py-2 px-2 text-brand-dark">{entry.date || '\u2014'}</td>
                        <td className="py-2 px-2 text-brand-dark font-medium max-w-[100px] truncate">
                          {tech?.technicianName ?? 'Unknown'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {entry.workHours || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {entry.travelHours || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {entry.prepHours || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {entry.miscHours || '\u2014'}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-dark font-medium tabular-nums">
                          {entry.totalHours.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-gray tabular-nums">
                          {fmtCurrency(entry.rateAtEntry)}
                        </td>
                        <td className="py-2 px-2 text-right text-brand-dark font-medium tabular-nums">
                          {fmtCurrency(entry.totalCost)}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(entry.id)}
                            className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {/* ── Totals row ── */}
                <tfoot>
                  <tr className="border-t border-gray-200 bg-gray-50/50">
                    <td colSpan={6} className="py-2 px-2 text-right text-xs font-semibold text-brand-navy">
                      Totals
                    </td>
                    <td className="py-2 px-2 text-right text-xs font-semibold text-brand-navy tabular-nums">
                      {totalHoursSum.toFixed(2)}
                    </td>
                    <td className="py-2 px-2" />
                    <td className="py-2 px-2 text-right text-xs font-semibold text-brand-navy tabular-nums">
                      {fmtCurrency(totalCostSum)}
                    </td>
                    <td className="py-2 px-2" />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* ── Log Hours Button ── */}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-brand-navy hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Hours
          </button>
        </div>
      </div>

      {/* ── Add Entry Modal ── */}
      {showAddModal && (
        <AddEntryModal
          techs={assignedTechs.length > 0 ? assignedTechs : Array.from(techMap.values()).sort((a, b) => a.technicianName.localeCompare(b.technicianName))}
          onSave={addEntry}
          onClose={() => setShowAddModal(false)}
          saving={saving}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white shadow-xl p-5 space-y-4">
              <p className="text-sm font-semibold text-brand-dark">Delete time entry?</p>
              <p className="text-xs text-brand-gray">
                This permanently removes the time entry. Work order totals will be recalculated.
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
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
