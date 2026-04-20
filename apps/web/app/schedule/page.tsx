'use client'

import { useEffect, useState, useCallback } from 'react'
import { DndContext, DragEndEvent, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { recordsService } from '@/lib/records-service'
import { useAuth } from '@/lib/auth-context'
import { CalendarGrid, type GridTech, type GridWO } from './calendar-grid'
import { UnassignedPool, type UnassignedWO } from './unassigned-pool'

// ── Helpers ────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return v != null ? String(v) : ''
}

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

function parseRecords<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[]
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.records)) return r.records as T[]
    if (Array.isArray(r.data)) return r.data as T[]
  }
  return []
}

/** Returns YYYY-MM-DD for a Date in local timezone */
function localDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Returns Monday of the week containing `d` */
function weekMonday(d: Date): Date {
  const result = new Date(d)
  const day = result.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  result.setDate(result.getDate() + diff)
  result.setHours(0, 0, 0, 0)
  return result
}

/** 7-day array of YYYY-MM-DD strings starting from Monday */
function weekDates(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return localDateStr(d)
  })
}

/** Format a week label like "Apr 14 – Apr 20, 2026" */
function weekLabel(dates: string[]): string {
  if (dates.length === 0) return ''
  const first = new Date(dates[0] + 'T00:00:00')
  const last = new Date(dates[dates.length - 1] + 'T00:00:00')
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(first)} – ${fmt(last)}, ${last.getFullYear()}`
}

/** Extract date portion from an ISO string */
function extractDatePart(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  return iso.length > 10 ? iso.substring(0, 10) : iso
}

// ── Types ──────────────────────────────────────────────────────────────────

interface RawWO {
  id: string
  name: string
  status: string
  workOrderType?: string
  scheduledStartDate?: string
  leadTech?: string
}

interface RawTech {
  id: string
  name: string
  techCode?: string
}

// Statuses that belong in the Unassigned pool (no assignment + open/scheduled)
const UNASSIGNED_STATUSES = new Set(['Open', 'Scheduled'])

// ── Page component ─────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { user } = useAuth()

  // Navigation
  const [monday, setMonday] = useState<Date>(() => weekMonday(new Date()))
  const dates = weekDates(monday)

  // Data
  const [techs, setTechs] = useState<RawTech[]>([])
  const [allWOs, setAllWOs] = useState<RawWO[]>([])
  /** woId → techId for assigned WOs (from WorkOrderAssignment) */
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({})

  // Loading / error
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Drag state
  const [activeWoId, setActiveWoId] = useState<string | null>(null)

  // Filters (lifted up so pool + grid can share)
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'client' | 'internal'>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  )

  // ── Fetch ────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      // Fetch techs, WOs, assignments in parallel
      const [techResp, woResp, assignResp] = await Promise.all([
        apiClient.get<unknown>('/objects/Technician/records?limit=200'),
        apiClient.get<unknown>('/objects/WorkOrder/records?limit=500'),
        apiClient.get<unknown>('/objects/WorkOrderAssignment/records?limit=1000'),
      ])

      // Parse Technicians
      const rawTechs = parseRecords<Record<string, unknown>>(techResp)
      const parsedTechs: RawTech[] = rawTechs.map((r) => ({
        id: str(r.id),
        name: str(getField(r, 'technicianName')) || str(r.id),
        techCode: str(getField(r, 'techCode')) || undefined,
      }))

      // Parse WorkOrders
      const rawWOs = parseRecords<Record<string, unknown>>(woResp)
      const parsedWOs: RawWO[] = rawWOs.map((r) => ({
        id: str(r.id),
        name: str(getField(r, 'name')) || str(r.id),
        status: str(getField(r, 'workOrderStatus')) || 'Open',
        workOrderType: str(getField(r, 'workOrderType')) || undefined,
        scheduledStartDate: str(getField(r, 'scheduledStartDate')) || undefined,
        leadTech: str(getField(r, 'leadTech')) || undefined,
      }))

      // Parse WorkOrderAssignments → woId → techId (first / lead assignment wins)
      const rawAssigns = parseRecords<Record<string, unknown>>(assignResp)
      const newAssignedMap: Record<string, string> = {}
      for (const a of rawAssigns) {
        const woId = str(getField(a, 'workOrder'))
        const techId = str(getField(a, 'technician'))
        const isLead = getField(a, 'isLead')
        if (woId && techId) {
          // Lead assignment wins; otherwise first seen
          if (!newAssignedMap[woId] || isLead === true || isLead === 'true') {
            newAssignedMap[woId] = techId
          }
        }
      }

      setTechs(parsedTechs)
      setAllWOs(parsedWOs)
      setAssignedMap(newAssignedMap)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ── Derived data ─────────────────────────────────────────────────────────

  // Unassigned: Open/Scheduled, no WorkOrderAssignment entry
  const unassignedWOs: UnassignedWO[] = allWOs
    .filter((wo) => UNASSIGNED_STATUSES.has(wo.status) && !assignedMap[wo.id])
    .map((wo) => ({
      id: wo.id,
      name: wo.name,
      status: wo.status,
      workOrderType: wo.workOrderType,
      scheduledStartDate: wo.scheduledStartDate,
    }))

  // Grid WOs: has an assignment, has a scheduledStartDate in this week
  const gridWOs: GridWO[] = allWOs
    .filter((wo) => {
      if (!assignedMap[wo.id] && !wo.leadTech) return false
      const dateStr = extractDatePart(wo.scheduledStartDate)
      if (!dateStr) return false
      return dates.includes(dateStr)
    })
    .map((wo) => ({
      id: wo.id,
      name: wo.name,
      status: wo.status,
      workOrderType: wo.workOrderType,
      scheduledStartDate: wo.scheduledStartDate,
      techId: assignedMap[wo.id] || wo.leadTech,
    }))

  const gridTechs: GridTech[] = techs.map((t) => ({
    id: t.id,
    name: t.name,
    techCode: t.techCode,
  }))

  // ── Drop handler ──────────────────────────────────────────────────────────

  async function handleDragEnd(e: DragEndEvent) {
    setActiveWoId(null)
    if (!e.over) return

    const { techId, date } = e.over.data.current as { techId: string; date: string }
    const woId = e.active.id as string

    // Optimistic update
    setAssignedMap((prev) => ({ ...prev, [woId]: techId }))
    setAllWOs((prev) =>
      prev.map((wo) =>
        wo.id === woId
          ? { ...wo, scheduledStartDate: `${date}T08:00:00`, status: 'Scheduled', leadTech: techId }
          : wo
      )
    )

    try {
      await recordsService.createRecord('WorkOrderAssignment', {
        data: { workOrder: woId, technician: techId, isLead: true },
      })
      await recordsService.updateRecord('WorkOrder', woId, {
        data: {
          scheduledStartDate: `${date}T08:00:00`,
          workOrderStatus: 'Scheduled',
          leadTech: techId,
        },
      })
    } catch (err) {
      console.error('Failed to save assignment:', err)
      // Revert optimistic update on error
      setAssignedMap((prev) => {
        const next = { ...prev }
        delete next[woId]
        return next
      })
      setAllWOs((prev) =>
        prev.map((wo) =>
          wo.id === woId
            ? { ...wo, scheduledStartDate: undefined, status: 'Open', leadTech: undefined }
            : wo
        )
      )
    }
  }

  // ── Week navigation ───────────────────────────────────────────────────────

  function prevWeek() {
    setMonday((m) => {
      const d = new Date(m)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  function nextWeek() {
    setMonday((m) => {
      const d = new Date(m)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  function goToday() {
    setMonday(weekMonday(new Date()))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!user || loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-lg mx-auto mt-8">
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Failed to load schedule</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
            <button
              onClick={() => loadData()}
              className="mt-2 text-xs text-red-600 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Active drag WO (for DragOverlay)
  const activeWO = activeWoId ? allWOs.find((w) => w.id === activeWoId) : null

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveWoId(e.active.id as string)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveWoId(null)}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Page header */}
        <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-brand-dark">Schedule</h1>
          </div>

          {/* Week nav */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={goToday}
              className="px-3 py-1 text-xs font-medium border border-gray-200 rounded hover:bg-gray-50 transition-colors text-gray-700"
            >
              Today
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[200px] text-center">
              {weekLabel(dates)}
            </span>
            <button
              onClick={nextWeek}
              className="p-1.5 rounded hover:bg-gray-100 transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="text-xs text-gray-400">
            {unassignedWOs.length} unassigned
          </div>
        </div>

        {/* Main: pool + grid */}
        <div className="flex flex-1 overflow-hidden">
          <UnassignedPool
            wos={unassignedWOs}
            categoryFilter={categoryFilter}
            statusFilter={statusFilter}
            onCategoryFilterChange={setCategoryFilter}
            onStatusFilterChange={setStatusFilter}
          />

          {/* Grid area */}
          <div className="flex-1 overflow-auto">
            <CalendarGrid
              techs={gridTechs}
              wos={gridWOs}
              weekStart={monday}
              weekDates={dates}
            />
          </div>
        </div>
      </div>

      {/* Drag overlay — floating ghost while dragging */}
      <DragOverlay>
        {activeWO && (
          <div className="rounded-lg border border-blue-400 bg-blue-100 text-blue-900 px-3 py-2 text-xs font-semibold shadow-lg opacity-90 pointer-events-none">
            {activeWO.name || activeWO.id}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
