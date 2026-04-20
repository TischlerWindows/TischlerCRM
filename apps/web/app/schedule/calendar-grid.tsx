'use client'

import { useDroppable } from '@dnd-kit/core'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────

export interface GridWO {
  id: string
  name: string
  status: string
  workOrderType?: string
  scheduledStartDate?: string
  /** resolved tech ID — may differ from leadTech if assigned via WorkOrderAssignment */
  techId?: string
}

export interface GridTech {
  id: string
  name: string
  techCode?: string
}

// ── Status colors ──────────────────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  Open: 'bg-gray-200 text-gray-800 border-gray-400',
  Scheduled: 'bg-blue-200 text-blue-900 border-blue-400',
  'In Progress': 'bg-green-200 text-green-900 border-green-400',
  'On Hold': 'bg-yellow-200 text-yellow-900 border-yellow-400',
  Completed: 'bg-purple-200 text-purple-900 border-purple-400',
  Closed: 'bg-gray-100 text-gray-500 border-gray-300',
  Cancelled: 'bg-red-200 text-red-900 border-red-400',
}

function woBlockClass(status: string, isInternal: boolean): string {
  const base = STATUS_BG[status] ?? 'bg-gray-200 text-gray-800 border-gray-400'
  return `${base} rounded border text-[10px] px-1.5 py-1 leading-snug select-none cursor-pointer hover:opacity-90 transition-opacity ${
    isInternal ? 'border-dashed' : ''
  }`
}

// ── Droppable cell ─────────────────────────────────────────────────────────

function DroppableCell({
  techId,
  date,
  wos,
  isToday,
}: {
  techId: string
  date: string
  wos: GridWO[]
  isToday: boolean
}) {
  const dropId = `${techId}__${date}`
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    data: { techId, date },
  })

  return (
    <td
      ref={setNodeRef}
      className={`border border-gray-200 align-top p-1 min-w-[120px] max-w-[160px] w-[140px] min-h-[64px] transition-colors ${
        isToday ? 'bg-blue-50/60' : 'bg-white'
      } ${isOver ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : ''}`}
    >
      <div className="space-y-1">
        {wos.map((wo) => {
          const isInternal = wo.workOrderType?.toLowerCase().includes('internal')
          return (
            <Link
              key={wo.id}
              href={`/workorders/${wo.id}`}
              className={woBlockClass(wo.status, isInternal ?? false)}
              title={wo.name}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-1 justify-between">
                <span className="truncate font-medium">{wo.name || wo.id}</span>
                {isInternal && (
                  <span className="shrink-0 text-[8px] font-bold bg-white/50 border border-current rounded px-0.5 leading-tight">
                    INT
                  </span>
                )}
              </div>
              <div className="opacity-60 truncate">{wo.status}</div>
            </Link>
          )
        })}
      </div>
    </td>
  )
}

// ── Date helpers ───────────────────────────────────────────────────────────

function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function formatDayHeader(dateStr: string): { dayName: string; dayNum: string } {
  // Parse as local midnight to avoid UTC shift
  const d = new Date(dateStr + 'T00:00:00')
  return {
    dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
    dayNum: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }
}

// ── Extract date-only from an ISO datetime string ──────────────────────────

function extractDatePart(iso: string | undefined): string | undefined {
  if (!iso) return undefined
  return iso.length > 10 ? iso.substring(0, 10) : iso
}

// ── Calendar grid ──────────────────────────────────────────────────────────

interface CalendarGridProps {
  techs: GridTech[]
  wos: GridWO[]
  weekStart: Date
  /** 7 date strings for the current week, in YYYY-MM-DD format */
  weekDates: string[]
}

export function CalendarGrid({ techs, wos, weekStart: _weekStart, weekDates }: CalendarGridProps) {
  const todayStr = toLocalDateStr(new Date())

  // Build lookup: techId → date → WO[]
  const grid: Record<string, Record<string, GridWO[]>> = {}
  for (const tech of techs) {
    grid[tech.id] = {}
    for (const date of weekDates) {
      grid[tech.id][date] = []
    }
  }

  for (const wo of wos) {
    const dateStr = extractDatePart(wo.scheduledStartDate)
    if (!dateStr || !wo.techId) continue
    if (!weekDates.includes(dateStr)) continue
    const techRow = grid[wo.techId]
    if (!techRow) continue
    if (!techRow[dateStr]) techRow[dateStr] = []
    techRow[dateStr].push(wo)
  }

  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm" style={{ minWidth: `${200 + weekDates.length * 140}px` }}>
        <thead>
          <tr className="bg-gray-50">
            {/* Tech name column header */}
            <th className="border border-gray-200 px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wide w-[180px] min-w-[140px] sticky left-0 bg-gray-50 z-10">
              Technician
            </th>
            {weekDates.map((date) => {
              const { dayName, dayNum } = formatDayHeader(date)
              const isToday = date === todayStr
              return (
                <th
                  key={date}
                  className={`border border-gray-200 px-2 py-2 text-center text-xs min-w-[120px] w-[140px] ${
                    isToday ? 'bg-blue-50 text-blue-700 font-bold' : 'text-gray-600 font-semibold'
                  }`}
                >
                  <div>{dayName}</div>
                  <div className="font-normal opacity-80">{dayNum}</div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {techs.length === 0 ? (
            <tr>
              <td
                colSpan={weekDates.length + 1}
                className="border border-gray-200 text-center py-10 text-gray-400 text-sm"
              >
                No technicians found.
              </td>
            </tr>
          ) : (
            techs.map((tech) => (
              <tr key={tech.id} className="hover:bg-gray-50/50">
                {/* Tech name cell */}
                <td className="border border-gray-200 px-3 py-2 align-top sticky left-0 bg-white z-10 min-w-[140px]">
                  <div className="font-semibold text-brand-dark text-xs">{tech.name}</div>
                  {tech.techCode && (
                    <div className="text-[10px] text-gray-400 mt-0.5">{tech.techCode}</div>
                  )}
                </td>
                {weekDates.map((date) => (
                  <DroppableCell
                    key={date}
                    techId={tech.id}
                    date={date}
                    wos={grid[tech.id]?.[date] ?? []}
                    isToday={date === todayStr}
                  />
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
