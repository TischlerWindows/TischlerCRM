'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// ── Types ──────────────────────────────────────────────────────────────────

export interface UnassignedWO {
  id: string
  name: string
  status: string
  workOrderType?: string
  scheduledStartDate?: string
}

// ── Status colors ──────────────────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  Open: 'bg-gray-100 text-gray-700 border-gray-300',
  Scheduled: 'bg-blue-100 text-blue-700 border-blue-300',
  'In Progress': 'bg-green-100 text-green-700 border-green-300',
  'On Hold': 'bg-yellow-100 text-yellow-700 border-yellow-300',
  Completed: 'bg-purple-100 text-purple-700 border-purple-300',
  Closed: 'bg-gray-50 text-gray-500 border-gray-200',
  Cancelled: 'bg-red-100 text-red-700 border-red-300',
}

function statusClass(status: string): string {
  return STATUS_BG[status] ?? 'bg-gray-100 text-gray-600 border-gray-300'
}

// ── Single draggable card ──────────────────────────────────────────────────

function DraggableCard({ wo }: { wo: UnassignedWO }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: wo.id,
    data: { wo },
  })

  const isInternal = wo.workOrderType?.toLowerCase().includes('internal')

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 9999 : undefined,
    position: isDragging ? 'relative' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-lg border px-3 py-2 text-xs select-none shadow-sm hover:shadow-md transition-shadow ${statusClass(wo.status)} ${
        isInternal ? 'border-dashed' : ''
      }`}
      title={`Drag to assign: ${wo.name}`}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="font-semibold break-words leading-snug">{wo.name || wo.id}</span>
        {isInternal && (
          <span className="shrink-0 text-[9px] font-bold bg-white/60 border border-current rounded px-1 py-0.5 leading-none">
            INT
          </span>
        )}
      </div>
      <div className="mt-1 opacity-70 truncate">{wo.status}</div>
    </div>
  )
}

// ── Unassigned pool panel ──────────────────────────────────────────────────

interface UnassignedPoolProps {
  wos: UnassignedWO[]
  categoryFilter: 'all' | 'client' | 'internal'
  statusFilter: string
  onCategoryFilterChange: (v: 'all' | 'client' | 'internal') => void
  onStatusFilterChange: (v: string) => void
}

export function UnassignedPool({
  wos,
  categoryFilter,
  statusFilter,
  onCategoryFilterChange,
  onStatusFilterChange,
}: UnassignedPoolProps) {
  const filtered = wos.filter((w) => {
    const isInternal = w.workOrderType?.toLowerCase().includes('internal')
    if (categoryFilter === 'client' && isInternal) return false
    if (categoryFilter === 'internal' && !isInternal) return false
    if (statusFilter !== 'all' && w.status !== statusFilter) return false
    return true
  })

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-gray-100">
        <h2 className="text-xs font-bold text-gray-700 uppercase tracking-wide">
          Unassigned
          <span className="ml-1.5 text-gray-400 font-normal normal-case">({filtered.length})</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="px-3 py-2 border-b border-gray-100 space-y-2">
        {/* Category filter */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value as 'all' | 'client' | 'internal')}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy/40"
          >
            <option value="all">All</option>
            <option value="client">Client</option>
            <option value="internal">Internal</option>
          </select>
        </div>
        {/* Status filter */}
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wide">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-brand-navy/40"
          >
            <option value="all">All</option>
            <option value="Open">Open</option>
            <option value="Scheduled">Scheduled</option>
          </select>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-[11px] text-gray-400 text-center mt-6">No unassigned WOs</p>
        ) : (
          filtered.map((wo) => <DraggableCard key={wo.id} wo={wo} />)
        )}
      </div>
    </aside>
  )
}
