'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Clock, MapPin, LogIn, LogOut, Loader2 } from 'lucide-react'
import type { WidgetProps } from '@/lib/widgets/types'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/components/toast'
import { apiClient } from '@/lib/api-client'

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

export default function ClockInWidget({ record }: WidgetProps) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const recordId = (record?.id ?? (record as any)?.Id ?? '') as string

  const [entries, setEntries] = useState<ClockInRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

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
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Clock Out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClockIn}
            disabled={busy || !recordId}
            className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy/90 disabled:opacity-60 transition-colors"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {entries.map((e) => {
                const inLink = mapLink(e.clockInLatitude, e.clockInLongitude)
                const outLink = mapLink(e.clockOutLatitude, e.clockOutLongitude)
                return (
                  <tr key={e.id} className="align-top text-gray-700">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.clockedInByName || 'Unknown'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtTime(e.clockInTime)}</td>
                    <td className="px-4 py-3">
                      <LocationCell address={locationLabel(e.clockInAddress, e.clockInLatitude, e.clockInLongitude)} href={inLink} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {e.clockOutTime ? fmtTime(e.clockOutTime) : <span className="font-medium text-amber-600">In progress</span>}
                    </td>
                    <td className="px-4 py-3">
                      {e.clockOutTime ? <LocationCell address={locationLabel(e.clockOutAddress, e.clockOutLatitude, e.clockOutLongitude)} href={outLink} /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{fmtDuration(e.durationMinutes)}</td>
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
