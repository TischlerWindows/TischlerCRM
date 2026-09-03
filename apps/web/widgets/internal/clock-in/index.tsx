'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Clock, MapPin, LogIn, LogOut, Loader2, Pencil, Trash2, Check, X, ChevronDown } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/toast'
import { apiClient } from '@/lib/api-client'
import { BodyEditor } from '@/app/proposal-builder/_components/body-editor'

const TASK_OPTIONS = ['Default 1', 'Default 2', 'Default 3', 'Other']

interface ClockInRecord {
  id: string
  workOrder?: string
  clockedInByUserId?: string
  clockedInByName?: string
  clockInTime?: string
  clockInLatitude?: string | number
  clockInLongitude?: string | number
  clockInAddress?: string
  clockOutTime?: string
  clockOutLatitude?: string | number
  clockOutLongitude?: string | number
  clockOutAddress?: string
  durationMinutes?: string | number
  tasks?: string
  taskOtherResponse?: string
}

interface GeoPoint {
  lat: number | null
  lng: number | null
}

/**
 * Wraps navigator.geolocation in a promise; resolves with nulls (never
 * rejects) if location can't be captured, so clocking in/out is never
 * blocked by denied permission, timeout, or an unsupported browser.
 */
function captureLocation(): Promise<GeoPoint> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: null, lng: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  })
}

function fmtTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function fmtDuration(mins?: string | number): string {
  const n = Number(mins)
  if (!n || n <= 0) return '—'
  const h = Math.floor(n / 60)
  const m = Math.round(n % 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function mapLink(lat?: string | number, lng?: string | number): string | null {
  if (lat === undefined || lat === null || lat === '') return null
  if (lng === undefined || lng === null || lng === '') return null
  return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}`
}

function locationLabel(address?: string, lat?: string | number, lng?: string | number): string {
  if (address) return address
  if (lat !== undefined && lng !== undefined && lat !== '' && lng !== '') {
    return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`
  }
  return 'Location unavailable'
}

function parseTaskValues(value?: string): string[] {
  return (value || '').split(';').map((item) => item.trim()).filter(Boolean)
}

function TaskCell({
  entry,
  onSave,
}: {
  entry: ClockInRecord
  onSave: (tasks: string[], otherResponse: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(() => parseTaskValues(entry.tasks))
  const [otherResponse, setOtherResponse] = useState(entry.taskOtherResponse || '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelected(parseTaskValues(entry.tasks))
    setOtherResponse(entry.taskOtherResponse || '')
  }, [entry.tasks, entry.taskOtherResponse])

  useEffect(() => {
    if (!open) return
    const handleOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const toggle = (option: string) => {
    setSelected((current) => current.includes(option)
      ? current.filter((value) => value !== option)
      : [...current, option])
  }

  const save = async () => {
    setSaving(true)
    try {
      await onSave(selected, otherResponse)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const label = selected.length === 0
    ? 'Select tasks'
    : selected.length === 1
      ? selected[0]
      : `${selected.length} tasks selected`

  return (
    <div ref={ref} className="flex min-w-[360px] items-start gap-2">
      <div className="relative w-44 shrink-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-9 w-full items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2.5 py-2 text-left text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
          aria-label="Select tasks"
        >
          <span className={selected.length ? 'truncate' : 'text-gray-400'}>{label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 w-full rounded border border-gray-200 bg-white p-1 shadow-lg">
            {TASK_OPTIONS.map((option) => (
              <label key={option} className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-xs hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  onChange={() => toggle(option)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-navy"
                />
                {option}
              </label>
            ))}
            <button type="button" onClick={save} disabled={saving} className="mt-1 w-full rounded bg-brand-navy px-2 py-1.5 text-xs font-medium text-white disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Tasks'}
            </button>
          </div>
        )}
      </div>
      {selected.includes('Other') && (
        <div className="min-w-[280px] flex-1">
          <BodyEditor value={otherResponse} onChange={setOtherResponse} placeholder="Describe the task..." minHeight={90} />
          <button type="button" onClick={save} disabled={saving} className="mt-1 rounded border border-brand-navy px-2.5 py-1 text-xs font-medium text-brand-navy hover:bg-brand-navy/5 disabled:opacity-60">
            {saving ? 'Saving...' : 'Save Other Task'}
          </button>
        </div>
      )}
    </div>
  )
}

function toDateTimeLocal(iso?: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function ClockInWidget({ record }: WidgetProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const recordId = (record?.id ?? (record as any)?.Id ?? '') as string

  const [entries, setEntries] = useState<ClockInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [editingTimeField, setEditingTimeField] = useState<'clockIn' | 'clockOut'>('clockIn')
  const [editingClockInTime, setEditingClockInTime] = useState('')
  const [editingClockOutTime, setEditingClockOutTime] = useState('')

  const load = useCallback(async () => {
    if (!recordId) { setLoading(false); return }
    const all = await recordsService.getRecords('ClockIn', { limit: 200, filter: { workOrder: recordId } })
    const mapped = all.map((r) => ({ id: r.id, ...r.data })) as ClockInRecord[]
    mapped.sort((a, b) => new Date(b.clockInTime || 0).getTime() - new Date(a.clockInTime || 0).getTime())
    setEntries(mapped)
    setLoading(false)
  }, [recordId])

  useEffect(() => { load() }, [load])

  // The current user's own open session (clocked in, not yet clocked out) —
  // each user tracks their own clock-in state independently, since multiple
  // technicians can be on the same Work Order at once.
  const activeEntry = useMemo(
    () => entries.find((e) => e.clockedInByUserId === user?.id && !e.clockOutTime),
    [entries, user?.id]
  )

  const handleClockIn = async () => {
    if (!recordId || busy) return
    setBusy(true)
    try {
      const loc = await captureLocation()
      if (loc.lat === null) {
        showToast('Could not capture your location — clocking in without it.', 'error')
      }
      let clockInAddress: string | null = null
      if (loc.lat !== null && loc.lng !== null) {
        try {
          clockInAddress = (await apiClient.reverseGeocode(loc.lat, loc.lng)).address
        } catch {
          clockInAddress = null
        }
      }
      await recordsService.createRecord('ClockIn', {
        data: {
          workOrder: recordId,
          clockedInByUserId: user?.id || '',
          clockedInByName: user?.name || '',
          clockInTime: new Date().toISOString(),
          clockInLatitude: loc.lat,
          clockInLongitude: loc.lng,
          clockInAddress,
        },
      })
      await load()
    } catch (err: any) {
      showToast(err?.message || 'Failed to clock in', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleClockOut = async () => {
    if (!activeEntry || busy) return
    setBusy(true)
    try {
      const loc = await captureLocation()
      if (loc.lat === null) {
        showToast('Could not capture your location — clocking out without it.', 'error')
      }
      const clockOutTime = new Date()
      const clockInTime = activeEntry.clockInTime ? new Date(activeEntry.clockInTime) : clockOutTime
      const durationMinutes = Math.max(0, Math.round((clockOutTime.getTime() - clockInTime.getTime()) / 60000))
      let clockOutAddress: string | null = null
      if (loc.lat !== null && loc.lng !== null) {
        try {
          clockOutAddress = (await apiClient.reverseGeocode(loc.lat, loc.lng)).address
        } catch {
          clockOutAddress = null
        }
      }
      await recordsService.updateRecord('ClockIn', activeEntry.id, {
        data: {
          clockOutTime: clockOutTime.toISOString(),
          clockOutLatitude: loc.lat,
          clockOutLongitude: loc.lng,
          clockOutAddress,
          durationMinutes,
        },
      })
      await load()
    } catch (err: any) {
      showToast(err?.message || 'Failed to clock out', 'error')
    } finally {
      setBusy(false)
    }
  }

  const canManageEntry = (entry: ClockInRecord) =>
    user?.role === 'ADMIN' || entry.clockedInByUserId === user?.id

  const startEditingTime = (entry: ClockInRecord, field: 'clockIn' | 'clockOut') => {
    if (!canManageEntry(entry) || busy) return
    setEditingEntryId(entry.id)
    setEditingTimeField(field)
    setEditingClockInTime(toDateTimeLocal(entry.clockInTime))
    setEditingClockOutTime(toDateTimeLocal(entry.clockOutTime))
  }

  const cancelEditingTime = () => {
    setEditingEntryId(null)
    setEditingTimeField('clockIn')
    setEditingClockInTime('')
    setEditingClockOutTime('')
  }

  const saveEditingTime = async (entry: ClockInRecord) => {
    const editedTime = editingTimeField === 'clockIn' ? editingClockInTime : editingClockOutTime
    if (!editedTime || !canManageEntry(entry) || busy) return
    const editedDate = new Date(editedTime)
    if (isNaN(editedDate.getTime())) {
      showToast(`Enter a valid clock-${editingTimeField === 'clockIn' ? 'in' : 'out'} time.`, 'error')
      return
    }
    setBusy(true)
    try {
      const clockInDate = new Date(editingTimeField === 'clockIn' ? editedTime : editingClockInTime)
      const clockOutDate = new Date(editingTimeField === 'clockOut' ? editedTime : editingClockOutTime)
      const data: Record<string, unknown> = {
        [editingTimeField === 'clockIn' ? 'clockInTime' : 'clockOutTime']: editedDate.toISOString(),
      }
      if (!isNaN(clockInDate.getTime()) && !isNaN(clockOutDate.getTime())) {
        data.durationMinutes = Math.max(0, Math.round((clockOutDate.getTime() - clockInDate.getTime()) / 60000))
      }
      await recordsService.updateRecord('ClockIn', entry.id, { data })
      cancelEditingTime()
      await load()
    } catch (err: any) {
      showToast(err?.message || 'Failed to update clock-in time', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (entry: ClockInRecord) => {
    if (!canManageEntry(entry) || busy) return
    if (!window.confirm('Delete this clock-in entry? This cannot be undone.')) return
    setBusy(true)
    try {
      await recordsService.deleteRecord('ClockIn', entry.id)
      if (editingEntryId === entry.id) cancelEditingTime()
      await load()
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete clock-in entry', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveTasks = async (entry: ClockInRecord, tasks: string[], otherResponse: string) => {
    if (!canManageEntry(entry)) return
    try {
      await recordsService.updateRecord('ClockIn', entry.id, {
        data: { tasks: tasks.join(';'), taskOtherResponse: tasks.includes('Other') ? otherResponse : '' },
      })
      await load()
    } catch (err: any) {
      showToast(err?.message || 'Failed to save tasks', 'error')
      throw err
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
        <div className="h-4 w-1/3 rounded bg-gray-200 mb-3" />
        <div className="h-9 w-full rounded bg-gray-200" />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
        <Clock className="h-4 w-4 text-gray-500" />
        <span className="text-sm font-semibold text-gray-800">Clock In</span>
      </div>

      <div className="p-4 space-y-3">
        {activeEntry ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Clocked in at <span className="font-medium text-gray-700">{fmtTime(activeEntry.clockInTime)}</span>
            </p>
            <button
              type="button"
              onClick={handleClockOut}
              disabled={busy}
              style={{ height: 100, minHeight: 100 }}
              className="mx-auto flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-6 text-lg font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
              Clock Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClockIn}
            disabled={busy || !recordId}
            style={{ height: 100, minHeight: 100 }}
            className="mx-auto flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-6 text-lg font-semibold text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
            Clock In
          </button>
        )}
      </div>

      {entries.length > 0 && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead className="bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Employee</th>
                <th className="px-4 py-2">Clock In Time</th>
                <th className="px-4 py-2">Clock In Location</th>
                <th className="px-4 py-2">Clock Out Time</th>
                <th className="px-4 py-2">Clock Out Location</th>
                <th className="px-4 py-2 text-right">Duration</th>
                <th className="px-4 py-2">Tasks</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => {
                const inLink = mapLink(e.clockInLatitude, e.clockInLongitude)
                const outLink = mapLink(e.clockOutLatitude, e.clockOutLongitude)
                return (
                  <tr key={e.id} className="align-top text-gray-700">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.clockedInByName || 'Unknown'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {editingEntryId === e.id && editingTimeField === 'clockIn' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="datetime-local"
                            value={editingTimeField === 'clockIn' ? editingClockInTime : editingClockOutTime}
                            onChange={(event) => editingTimeField === 'clockIn'
                              ? setEditingClockInTime(event.target.value)
                              : setEditingClockOutTime(event.target.value)}
                            disabled={busy}
                            className="h-8 rounded border border-gray-300 px-2 text-xs text-gray-700"
                            aria-label={`Edit clock-${editingTimeField === 'clockIn' ? 'in' : 'out'} time`}
                          />
                          <button type="button" onClick={() => saveEditingTime(e)} disabled={busy || !(editingTimeField === 'clockIn' ? editingClockInTime : editingClockOutTime)} className="rounded p-1 text-green-700 hover:bg-green-50 disabled:opacity-50" aria-label="Save edited time" title="Save edited time">
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={cancelEditingTime} disabled={busy} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50" aria-label="Cancel editing clock-in time" title="Cancel editing clock-in time">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : canManageEntry(e) ? (
                        <button type="button" onClick={() => startEditingTime(e, 'clockIn')} className="inline-flex items-center gap-1 text-left text-brand-navy hover:underline" title="Edit clock-in time">
                          {fmtTime(e.clockInTime)}
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : (
                        fmtTime(e.clockInTime)
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <LocationCell address={locationLabel(e.clockInAddress, e.clockInLatitude, e.clockInLongitude)} href={inLink} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {editingEntryId === e.id && editingTimeField === 'clockOut' ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="datetime-local"
                            value={editingClockOutTime}
                            onChange={(event) => setEditingClockOutTime(event.target.value)}
                            disabled={busy}
                            className="h-8 rounded border border-gray-300 px-2 text-xs text-gray-700"
                            aria-label="Edit clock-out time"
                          />
                          <button type="button" onClick={() => saveEditingTime(e)} disabled={busy || !editingClockOutTime} className="rounded p-1 text-green-700 hover:bg-green-50 disabled:opacity-50" aria-label="Save clock-out time" title="Save clock-out time">
                            <Check className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={cancelEditingTime} disabled={busy} className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50" aria-label="Cancel editing clock-out time" title="Cancel editing clock-out time">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : e.clockOutTime ? canManageEntry(e) ? (
                        <button type="button" onClick={() => startEditingTime(e, 'clockOut')} className="inline-flex items-center gap-1 text-left text-brand-navy hover:underline" title="Edit clock-out time">
                          {fmtTime(e.clockOutTime)}
                          <Pencil className="h-3 w-3" />
                        </button>
                      ) : fmtTime(e.clockOutTime) : <span className="font-medium text-amber-600">In progress</span>}
                    </td>
                    <td className="px-4 py-3">
                      {e.clockOutTime ? <LocationCell address={locationLabel(e.clockOutAddress, e.clockOutLatitude, e.clockOutLongitude)} href={outLink} /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmtDuration(e.durationMinutes)}</td>
                    <td className="px-4 py-3">
                      {canManageEntry(e) ? (
                        <TaskCell entry={e} onSave={(tasks, otherResponse) => saveTasks(e, tasks, otherResponse)} />
                      ) : (
                        <span className="text-gray-600">{parseTaskValues(e.tasks).join(', ') || '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canManageEntry(e) && (
                        <button type="button" onClick={() => handleDelete(e)} disabled={busy} className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-50" aria-label="Delete clock-in entry" title="Delete clock-in entry">
                          <Trash2 className="h-4 w-4" />
                        </button>
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
  )
}

function LocationCell({ address, href }: { address: string; href: string | null }) {
  const content = <span className="inline-flex items-start gap-1.5 leading-4"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" /><span>{address}</span></span>
  return href ? <a href={href} target="_blank" rel="noreferrer" className="text-brand-navy hover:underline">{content}</a> : content
}
