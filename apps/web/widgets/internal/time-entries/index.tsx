'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth-context'

// ── Types ──────────────────────────────────────────────────────────────

interface TimeEntry {
  id: string
  data: {
    workOrder?: string
    technician?: string
    date?: string
    workHours?: number
    travelHours?: number
    prepHours?: number
    miscHours?: number
    totalHours?: number
    rateAtEntry?: number
    totalCost?: number
    notes?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function getDataField(raw: Record<string, unknown>, field: string): unknown {
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as Record<string, unknown>
    if (d[field] !== undefined) return d[field]
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

function num(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function formatCurrency(val: number): string {
  return `$${val.toFixed(2)}`
}

const EMPTY_FORM = {
  workHours: '',
  travelHours: '',
  prepHours: '',
  miscHours: '',
  notes: '',
}

// ── Main Widget ────────────────────────────────────────────────────────

export default function TimeEntriesWidget({ record }: WidgetProps) {
  const workOrderId = record?.id ? String(record.id) : null

  const { user } = useAuth()

  const [entries, setEntries] = useState<TimeEntry[]>([])
  const [techNames, setTechNames] = useState<Record<string, string>>({})
  const [myTechId, setMyTechId] = useState<string | null | undefined>(undefined) // undefined = loading
  const [isManager, setIsManager] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [woStatus, setWoStatus] = useState<string>('')
  const [completedDate, setCompletedDate] = useState<string | null>(null)

  // Stable ref for techNames to avoid stale closures in reload
  const techNamesRef = useRef(techNames)
  useEffect(() => { techNamesRef.current = techNames }, [techNames])

  // ── Determine current user's tech record and manager status ──
  useEffect(() => {
    if (!user) {
      // Not authenticated yet
      setIsManager(false)
      setMyTechId(null)
      return
    }

    // ADMIN users are always managers (see permissions-context.tsx pattern)
    if (user.role === 'ADMIN') {
      setIsManager(true)
      setMyTechId(null)
      return
    }

    // For other roles: check if there's a Technician record linked to this user.
    // If yes → tech (show own entries only). If no → treat as manager (show all).
    apiClient.get<Record<string, unknown>[]>(
      `/objects/Technician/records?limit=500`
    ).then(raw => {
      const all = Array.isArray(raw) ? raw : []
      const myTech = all.find(r => {
        const linked = str(getDataField(r, 'user'))
        return linked === user.id
      })
      if (myTech) {
        setMyTechId(String(myTech.id))
        setIsManager(false)
      } else {
        // No linked Technician record → treat as manager/office staff
        setIsManager(true)
        setMyTechId(null)
      }
    }).catch(() => {
      // Fallback: show all (manager behaviour) so nothing is hidden on error
      setIsManager(true)
      setMyTechId(null)
    })
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    if (!workOrderId) return
    setLoading(true)
    setError(null)
    try {
      // Fetch the WO record for status / completedDate gate
      const woRec = await recordsService.getRecord('WorkOrder', workOrderId)
      const woData = (woRec?.data ?? {}) as Record<string, unknown>
      setWoStatus(str(woData.workOrderStatus))
      setCompletedDate(str(woData.completedDate) || null)

      // Fetch time entries filtered by workOrder
      const params = new URLSearchParams({
        'filter[workOrder]': workOrderId,
        limit: '500',
      })
      const raw = await apiClient.get<Record<string, unknown>[]>(
        `/objects/TimeEntry/records?${params}`
      )
      const all: TimeEntry[] = (Array.isArray(raw) ? raw : []).map(r => ({
        id: String(r.id),
        data: {
          workOrder: str(getDataField(r, 'workOrder')),
          technician: str(getDataField(r, 'technician')),
          date: str(getDataField(r, 'date')),
          workHours: num(getDataField(r, 'workHours')),
          travelHours: num(getDataField(r, 'travelHours')),
          prepHours: num(getDataField(r, 'prepHours')),
          miscHours: num(getDataField(r, 'miscHours')),
          totalHours: num(getDataField(r, 'totalHours')),
          rateAtEntry: num(getDataField(r, 'rateAtEntry')),
          totalCost: num(getDataField(r, 'totalCost')),
          notes: str(getDataField(r, 'notes')),
        },
      }))

      // User-scoping is applied after render via visibleEntries (derived from isManager / myTechId),
      // so we store the full unfiltered list here and let the derived variable do the filtering.
      setEntries(all)

      // Resolve tech names for unknown IDs
      const currentCache = techNamesRef.current
      const missingIds = [...new Set(
        all.map(e => e.data.technician).filter((id): id is string => !!id && !currentCache[id])
      )]
      const newNames: Record<string, string> = {}
      await Promise.all(
        missingIds.map(async (tid) => {
          const t = await recordsService.getRecord('Technician', tid) as any
          if (t) newNames[tid] = t.data?.technicianName || ''
        })
      )
      setTechNames(prev => ({ ...prev, ...newNames }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load time entries')
    } finally {
      setLoading(false)
    }
  }, [workOrderId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    reload()
  }, [reload])

  // ── Derived: filtered entries based on user scope ──
  // myTechId === undefined means we haven't resolved tech lookup yet
  const visibleEntries = isManager
    ? entries
    : entries.filter(e => e.data.technician === myTechId)

  // ── Edit-window gate: techs can't add entries >24h after WO completion ──
  const completedMs = completedDate ? new Date(completedDate).getTime() : null
  const within24hWindow = completedMs ? (Date.now() - completedMs) < 24 * 60 * 60 * 1000 : true

  const canLog = isManager || (myTechId && within24hWindow && woStatus !== 'Closed')

  // ── Add entry ──
  async function addEntry() {
    if (!workOrderId || !myTechId) return
    setSaving(true)
    setMutationError(null)
    try {
      await recordsService.createRecord('TimeEntry', {
        data: {
          workOrder: workOrderId,
          technician: myTechId,
          date: new Date().toISOString().split('T')[0],
          workHours: Number(form.workHours) || 0,
          travelHours: Number(form.travelHours) || 0,
          prepHours: Number(form.prepHours) || 0,
          miscHours: Number(form.miscHours) || 0,
          notes: form.notes.trim(),
        },
      })
      setForm(EMPTY_FORM)
      setAdding(false)
      await reload()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to save time entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete entry ──
  async function deleteEntry(entryId: string) {
    if (saving) return
    setSaving(true)
    setMutationError(null)
    try {
      await recordsService.deleteRecord('TimeEntry', entryId)
      await reload()
    } catch (e: unknown) {
      setMutationError(e instanceof Error ? e.message : 'Failed to delete time entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── Guards ──
  if (!workOrderId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-xs text-brand-gray text-center">
        No Work Order record loaded
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-brand-navy" />
      </div>
    )
  }

  if (error && entries.length === 0) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-xs text-red-600">
        {error}
      </div>
    )
  }

  // ── Totals row ──
  const totalHrs = visibleEntries.reduce((s, e) => s + (e.data.totalHours ?? 0), 0)
  const totalCost = visibleEntries.reduce((s, e) => s + (e.data.totalCost ?? 0), 0)

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Mutation error banner */}
      {mutationError && (
        <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center justify-between">
          <span className="text-xs text-red-600">{mutationError}</span>
          <button
            type="button"
            onClick={() => setMutationError(null)}
            className="ml-3 text-red-400 hover:text-red-600 text-xs leading-none"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
        <span className="text-xs font-semibold text-brand-gray uppercase tracking-wide">
          Time Entries
          <span className="ml-2 font-normal text-[11px]">({visibleEntries.length})</span>
        </span>
        {canLog && (
          <button
            type="button"
            onClick={() => { setAdding(true); setForm(EMPTY_FORM) }}
            disabled={saving}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 transition-colors disabled:opacity-50"
          >
            <Plus className="w-3 h-3" />
            Log Hours
          </button>
        )}
      </div>

      {/* Add-entry form */}
      {adding && (
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 space-y-2">
          <div className="grid grid-cols-4 gap-2">
            {(['workHours', 'travelHours', 'prepHours', 'miscHours'] as const).map(field => (
              <div key={field}>
                <label className="block text-[10px] text-brand-gray mb-0.5 capitalize">
                  {field.replace('Hours', '')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  placeholder="0"
                  value={form[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                />
              </div>
            ))}
          </div>
          <input
            type="text"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={addEntry}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-brand-navy text-white text-[11px] font-semibold hover:bg-brand-navy/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-[11px] font-medium text-brand-gray hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {visibleEntries.length === 0 ? (
        <p className="p-6 text-xs text-brand-gray text-center">
          {isManager ? 'No time entries logged yet.' : 'No time entries from you yet.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Date</th>
                {isManager && (
                  <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Tech</th>
                )}
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Work</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Travel</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Prep</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Misc</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Total</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Rate</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Cost</th>
                <th className="px-3 py-2 text-left font-semibold text-brand-gray uppercase tracking-wide text-[10px]">Notes</th>
                {(isManager || within24hWindow) && <th className="w-8 px-2 py-2" />}
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map(e => {
                const canDelete = isManager || (e.data.technician === myTechId && within24hWindow)
                return (
                  <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                    <td className="px-3 py-2.5 text-brand-dark">{e.data.date || '—'}</td>
                    {isManager && (
                      <td className="px-3 py-2.5 text-brand-gray">
                        {techNames[e.data.technician || ''] || '—'}
                      </td>
                    )}
                    <td className="px-3 py-2.5 text-brand-gray">{e.data.workHours ?? 0}</td>
                    <td className="px-3 py-2.5 text-brand-gray">{e.data.travelHours ?? 0}</td>
                    <td className="px-3 py-2.5 text-brand-gray">{e.data.prepHours ?? 0}</td>
                    <td className="px-3 py-2.5 text-brand-gray">{e.data.miscHours ?? 0}</td>
                    <td className="px-3 py-2.5 font-medium text-brand-dark">{e.data.totalHours ?? 0}</td>
                    <td className="px-3 py-2.5 text-brand-gray">{formatCurrency(e.data.rateAtEntry ?? 0)}</td>
                    <td className="px-3 py-2.5 font-medium text-brand-dark">{formatCurrency(e.data.totalCost ?? 0)}</td>
                    <td className="px-3 py-2.5 text-brand-gray max-w-[160px] truncate">{e.data.notes || '—'}</td>
                    {(isManager || within24hWindow) && (
                      <td className="px-2 py-2.5 text-right">
                        {canDelete && (
                          <button
                            type="button"
                            title="Delete entry"
                            onClick={() => deleteEntry(e.id)}
                            disabled={saving}
                            className="rounded p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
            {visibleEntries.length > 1 && (
              <tfoot>
                <tr className="border-t border-gray-200 bg-gray-50/80">
                  <td colSpan={isManager ? 6 : 5} className="px-3 py-2 text-[10px] font-semibold text-brand-gray uppercase">Totals</td>
                  <td className="px-3 py-2 font-semibold text-brand-dark text-xs">{totalHrs.toFixed(2)}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 font-semibold text-brand-dark text-xs">{formatCurrency(totalCost)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
