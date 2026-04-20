'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertTriangle, ClipboardList } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/lib/auth-context'

// ── Types ──────────────────────────────────────────────────────────────

interface WORecord {
  id: string
  data: {
    name?: string
    workOrderStatus?: string
    scheduledStartDate?: string
    completedDate?: string
    leadTech?: string
  }
}

interface Assignment {
  id: string
  data: {
    workOrder?: string
    technician?: string
    isLead?: boolean
  }
}

interface Tech {
  id: string
  data: {
    technicianName?: string
    techCode?: string
  }
}

interface TimeEntry {
  id: string
  data: {
    workOrder?: string
    technician?: string
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Extract a field from a raw API record, tolerating both flat and
 * nested-data shapes as well as prefixed keys.
 */
function getField(raw: Record<string, unknown>, field: string): unknown {
  if (raw.data && typeof raw.data === 'object') {
    const d = raw.data as Record<string, unknown>
    if (d[field] !== undefined) return d[field]
    for (const key of Object.keys(d)) {
      if (key.endsWith(`__${field}`)) return d[key]
    }
  }
  if (raw[field] !== undefined) return raw[field]
  for (const key of Object.keys(raw)) {
    if (key.endsWith(`__${field}`)) return raw[key]
  }
  return undefined
}

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

function parseRecords<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.records)) return r.records as T[]
    if (Array.isArray(r.data)) return r.data as T[]
  }
  return []
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

const STATUS_COLORS: Record<string, string> = {
  'Open': 'bg-blue-100 text-blue-700',
  'Scheduled': 'bg-indigo-100 text-indigo-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  'Completed': 'bg-green-100 text-green-700',
  'On Hold': 'bg-orange-100 text-orange-700',
  'Cancelled': 'bg-red-100 text-red-700',
  'Closed': 'bg-gray-100 text-gray-600',
}

function statusBadge(status: string | undefined): string {
  if (!status) return 'bg-gray-100 text-gray-500'
  return STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'
}

// ── Subcomponents ──────────────────────────────────────────────────────

function WOCard({
  wo,
  techNames,
}: {
  wo: WORecord
  techNames: Record<string, string>
}) {
  const status = wo.data.workOrderStatus ?? ''
  const name = wo.data.name || wo.id

  return (
    <li className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="p-4">
        {/* Name + status badge */}
        <div className="flex items-start justify-between gap-3 min-h-[44px]">
          <span className="font-semibold text-brand-dark text-sm break-words min-w-0 flex-1">
            {name}
          </span>
          {status && (
            <span
              className={`shrink-0 self-start text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${statusBadge(status)}`}
            >
              {status}
            </span>
          )}
        </div>

        {/* Scheduled date */}
        <div className="mt-1.5 text-xs text-brand-gray">
          {formatDate(wo.data.scheduledStartDate)}
        </div>

        {/* Teammates (lead tech) */}
        {wo.data.leadTech && techNames[wo.data.leadTech] && (
          <div className="mt-1.5 text-xs text-brand-gray">
            Lead: {techNames[wo.data.leadTech]}
          </div>
        )}

        {/* Open WO link — full-width tap target */}
        <div className="mt-3">
          <Link
            href={`/workorders/${wo.id}`}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2.5 rounded-lg bg-brand-navy text-white text-xs font-semibold hover:bg-brand-navy/90 active:bg-brand-navy/80 transition-colors"
          >
            <ClipboardList className="w-3.5 h-3.5 shrink-0" />
            Open WO
          </Link>
        </div>
      </div>
    </li>
  )
}

function Section({
  title,
  items,
  empty,
  techNames,
  accent,
}: {
  title: string
  items: WORecord[]
  empty: string
  techNames: Record<string, string>
  accent?: string
}) {
  return (
    <section>
      <div className={`flex items-center gap-2 mb-3 ${accent ?? ''}`}>
        <h2 className="text-base font-bold text-brand-dark">{title}</h2>
        <span className="text-xs font-medium text-brand-gray bg-gray-100 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-brand-gray py-3 px-1">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((wo) => (
            <WOCard key={wo.id} wo={wo} techNames={techNames} />
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Main page ──────────────────────────────────────────────────────────

export default function TechDashboardPage() {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notLinked, setNotLinked] = useState(false)

  const [todayWOs, setTodayWOs] = useState<WORecord[]>([])
  const [upcomingWOs, setUpcomingWOs] = useState<WORecord[]>([])
  const [pendingReview, setPendingReview] = useState<WORecord[]>([])
  const [missingHours, setMissingHours] = useState<WORecord[]>([])
  const [techNames, setTechNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!user) return

    let cancelled = false

    ;(async () => {
      setLoading(true)
      setError(null)
      setNotLinked(false)

      try {
        // 1. Find my Technician record by user ID
        const techResp = await apiClient.get<unknown>(
          `/objects/Technician/records?filter[user]=${encodeURIComponent(user.id)}&limit=1`
        )
        const techList = parseRecords<Record<string, unknown>>(techResp)
        const myTechRaw = techList[0]

        if (!myTechRaw) {
          if (!cancelled) setNotLinked(true)
          return
        }

        const myTechId = str(myTechRaw.id)

        // 2. Fetch WorkOrderAssignment records for my tech ID
        const assignResp = await apiClient.get<unknown>(
          `/objects/WorkOrderAssignment/records?filter[technician]=${encodeURIComponent(myTechId)}&limit=500`
        )
        const assignments = parseRecords<Record<string, unknown>>(assignResp).map(
          (r): Assignment => ({
            id: str(r.id),
            data: {
              workOrder: str(getField(r, 'workOrder')),
              technician: str(getField(r, 'technician')),
              isLead: getField(r, 'isLead') === true || getField(r, 'isLead') === 'true',
            },
          })
        )

        const woIds = [...new Set(assignments.map((a) => a.data.workOrder).filter(Boolean))] as string[]

        if (woIds.length === 0) {
          if (!cancelled) {
            setTodayWOs([])
            setUpcomingWOs([])
            setPendingReview([])
            setMissingHours([])
            setLoading(false)
          }
          return
        }

        // 3. Fetch each WorkOrder (parallel)
        const woResults = await Promise.all(
          woIds.map(async (id) => {
            try {
              const r = await apiClient.get<Record<string, unknown>>(
                `/objects/WorkOrder/records/${id}`
              )
              if (!r) return null
              return {
                id: str(r.id ?? id),
                data: {
                  name: str(getField(r, 'name')),
                  workOrderStatus: str(getField(r, 'workOrderStatus')),
                  scheduledStartDate: str(getField(r, 'scheduledStartDate')) || undefined,
                  completedDate: str(getField(r, 'completedDate')) || undefined,
                  leadTech: str(getField(r, 'leadTech')) || undefined,
                },
              } as WORecord
            } catch {
              return null
            }
          })
        )
        const wos = woResults.filter((w): w is WORecord => w !== null)

        // 4. Compute date windows
        const now = new Date()
        const todayStr = now.toISOString().split('T')[0]
        const in14Days = new Date(now)
        in14Days.setDate(in14Days.getDate() + 14)

        const todayList: WORecord[] = []
        const upcomingList: WORecord[] = []
        const pendingList: WORecord[] = []

        for (const w of wos) {
          const status = w.data.workOrderStatus
          const isClosed = status === 'Closed' || status === 'Cancelled'
          const startRaw = w.data.scheduledStartDate

          // Pending review: Completed + within 24-hr edit window
          if (status === 'Completed' && w.data.completedDate) {
            const hrsAgo =
              (Date.now() - new Date(w.data.completedDate).getTime()) / 3_600_000
            if (hrsAgo < 24) pendingList.push(w)
          }

          // Today / Upcoming
          if (startRaw && !isClosed) {
            const startDate = new Date(startRaw)
            const startStr = startDate.toISOString().split('T')[0]
            if (startStr === todayStr) {
              todayList.push(w)
            } else if (startDate > now && startDate <= in14Days) {
              upcomingList.push(w)
            }
          }
        }

        // Sort by scheduledStartDate ascending
        const byDate = (a: WORecord, b: WORecord) =>
          (a.data.scheduledStartDate ?? '').localeCompare(b.data.scheduledStartDate ?? '')
        todayList.sort(byDate)
        upcomingList.sort(byDate)

        // 5. Fetch my TimeEntry records to find completed WOs with no entry from me
        const teResp = await apiClient.get<unknown>(
          `/objects/TimeEntry/records?filter[technician]=${encodeURIComponent(myTechId)}&limit=1000`
        )
        const myEntries = parseRecords<Record<string, unknown>>(teResp).map(
          (r): TimeEntry => ({
            id: str(r.id),
            data: {
              workOrder: str(getField(r, 'workOrder')),
              technician: str(getField(r, 'technician')),
            },
          })
        )
        const woIdsWithMyEntries = new Set(myEntries.map((e) => e.data.workOrder).filter(Boolean))

        const missingList = wos.filter(
          (w) => w.data.workOrderStatus === 'Completed' && !woIdsWithMyEntries.has(w.id)
        )

        // 6. Resolve lead tech names for cards
        const leadTechIds = [
          ...new Set(wos.map((w) => w.data.leadTech).filter(Boolean) as string[]),
        ]
        const nameMap: Record<string, string> = {}
        await Promise.all(
          leadTechIds.map(async (tid) => {
            try {
              const t = await apiClient.get<Record<string, unknown>>(
                `/objects/Technician/records/${tid}`
              )
              if (t) {
                nameMap[tid] = str(getField(t, 'technicianName')) || tid
              }
            } catch {
              /* ignore */
            }
          })
        )

        if (!cancelled) {
          setTodayWOs(todayList)
          setUpcomingWOs(upcomingList)
          setPendingReview(pendingList)
          setMissingHours(missingList)
          setTechNames(nameMap)
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading state ──
  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    )
  }

  // ── Not linked ──
  if (notLinked) {
    return (
      <div className="p-6 max-w-md mx-auto mt-12 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
        <h2 className="text-lg font-semibold text-brand-dark">No Technician Record Found</h2>
        <p className="text-sm text-brand-gray">
          Your account isn't linked to a technician record. Contact an admin to set this up.
        </p>
      </div>
    )
  }

  // ── Error ──
  if (error) {
    return (
      <div className="p-6 max-w-md mx-auto mt-8">
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      </div>
    )
  }

  // ── Dashboard ──
  return (
    <div className="p-4 max-w-lg mx-auto space-y-8 pb-16">
      {/* Page header */}
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-brand-dark">My Work</h1>
        <p className="text-sm text-brand-gray mt-0.5">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Today */}
      <Section
        title="Today"
        items={todayWOs}
        empty="Nothing scheduled for today."
        techNames={techNames}
      />

      {/* Upcoming */}
      <Section
        title="Upcoming — Next 14 Days"
        items={upcomingWOs}
        empty="No upcoming work in the next 14 days."
        techNames={techNames}
      />

      {/* Pending Review */}
      <Section
        title="Pending Review"
        items={pendingReview}
        empty="Nothing in the 24-hr edit window."
        techNames={techNames}
      />

      {/* Missing Hours */}
      <Section
        title="Missing Hours"
        items={missingHours}
        empty="All hours logged — great work!"
        techNames={techNames}
        accent="text-amber-600"
      />
    </div>
  )
}
