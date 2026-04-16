'use client';

import { useAuth } from '@/lib/auth-context';
import { recordsService } from '@/lib/records-service';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Filter } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a field that might be stored with or without an object prefix. */
function f(record: Record<string, any>, field: string, prefix?: string): any {
  if (record[field] !== undefined) return record[field];
  if (prefix && record[`${prefix}__${field}`] !== undefined) return record[`${prefix}__${field}`];
  return undefined;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

/** Return the Monday of the week containing `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Build an array of 7 dates (Mon-Sun) starting from `monday`. */
function getWeekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const year = monday.getFullYear();
  return `Week of ${monday.toLocaleDateString('en-US', opts)} - ${sunday.toLocaleDateString('en-US', opts)}, ${year}`;
}

// ---------------------------------------------------------------------------
// Status color map
// ---------------------------------------------------------------------------

const STATUS_BG: Record<string, string> = {
  Scheduled: 'bg-blue-200 border-blue-400 text-blue-900',
  'In Progress': 'bg-green-200 border-green-400 text-green-900',
  Completed: 'bg-yellow-200 border-yellow-400 text-yellow-900',
  Closed: 'bg-gray-200 border-gray-400 text-gray-700',
};

const STATUS_BG_DEFAULT = 'bg-purple-100 border-purple-300 text-purple-900';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TechRow {
  id: string;
  name: string;
}

interface CalendarBlock {
  workOrderId: string;
  workOrderName: string;
  status: string;
  category: string; // 'Client Service' | 'Internal' | ''
  /** 0-based day offset within the week (0=Mon, 6=Sun), clipped. */
  dayStart: number;
  /** 0-based day offset of end (inclusive). */
  dayEnd: number;
  techId: string | null;
}

type CategoryFilter = 'All' | 'Client Service' | 'Internal';
type StatusFilter = 'All' | 'Scheduled' | 'In Progress' | 'Completed';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ScheduleCalendarPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Raw data
  const [technicians, setTechnicians] = useState<Record<string, any>[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, any>[]>([]);

  // Controls
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');

  // ------------------------------------------------------------------
  // Data fetch
  // ------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);

      const [techRaw, assignRaw, woRaw] = await Promise.all([
        recordsService.getRecords('Technician'),
        recordsService.getRecords('WorkOrderAssignment'),
        recordsService.getRecords('WorkOrder'),
      ]);

      setTechnicians(recordsService.flattenRecords(techRaw));
      setAssignments(recordsService.flattenRecords(assignRaw));
      setWorkOrders(recordsService.flattenRecords(woRaw));
    } catch (err) {
      console.error('Schedule fetch error:', err);
      setError('Failed to load schedule data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------------------------------------------------------------------
  // Derived data
  // ------------------------------------------------------------------

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  /** Active service technicians. */
  const activeTechs: TechRow[] = useMemo(() => {
    return technicians
      .filter((t) => {
        // Check active status
        const active = f(t, 'active', 'Technician');
        const status = f(t, 'status', 'Technician');
        const isActive = active === true || active === 'true' || status === 'Active' || (active === undefined && status === undefined);

        // Check department contains Service
        const dept = f(t, 'departmentTags', 'Technician') || f(t, 'department', 'Technician') || '';
        const deptStr = Array.isArray(dept) ? dept.join(',') : String(dept);
        const isService = deptStr.toLowerCase().includes('service') || deptStr === '';

        return isActive && isService;
      })
      .map((t) => ({
        id: t.id,
        name: f(t, 'name', 'Technician') || f(t, 'fullName', 'Technician') || 'Unnamed Tech',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [technicians]);

  /** Map techId -> set of workOrderIds via assignments. */
  const techToWOIds = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const assignedWOs = new Set<string>();

    for (const a of assignments) {
      const techId = f(a, 'technician', 'WorkOrderAssignment') as string;
      const woId = f(a, 'workOrder', 'WorkOrderAssignment') as string;
      if (!techId || !woId) continue;
      if (!map.has(techId)) map.set(techId, new Set());
      map.get(techId)!.add(woId);
      assignedWOs.add(woId);
    }

    return { map, assignedWOs };
  }, [assignments]);

  /** Build work order lookup. */
  const woById = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const wo of workOrders) m.set(wo.id, wo);
    return m;
  }, [workOrders]);

  /** Determine WO category. */
  function getWOCategory(wo: Record<string, any>): string {
    const cat = f(wo, 'category', 'WorkOrder') || f(wo, 'workOrderType', 'WorkOrder') || f(wo, 'type', 'WorkOrder') || '';
    const catStr = String(cat).toLowerCase();
    if (catStr.includes('internal')) return 'Internal';
    if (catStr.includes('client') || catStr.includes('service')) return 'Client Service';
    return '';
  }

  /** Compute a CalendarBlock from a WO clipped to the current week. Returns null if outside. */
  function woToBlock(wo: Record<string, any>, techId: string | null): CalendarBlock | null {
    const start = parseDate(f(wo, 'scheduledStartDate', 'WorkOrder'));
    const end = parseDate(f(wo, 'scheduledEndDate', 'WorkOrder'));

    if (!start) return null;

    const effectiveEnd = end || start; // single-day if no end

    // Check overlap with the current week
    const woStart = new Date(start);
    woStart.setHours(0, 0, 0, 0);
    const woEnd = new Date(effectiveEnd);
    woEnd.setHours(23, 59, 59, 999);

    if (woEnd < weekStart || woStart > weekEnd) return null;

    // Clip to visible week
    const clippedStart = woStart < weekStart ? weekStart : woStart;
    const clippedEnd = woEnd > weekEnd ? weekEnd : woEnd;

    // Day offsets (0-based: 0=Mon, 6=Sun)
    const dayStart = Math.round((clippedStart.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));
    const dayEnd = Math.round((clippedEnd.getTime() - weekStart.getTime()) / (1000 * 60 * 60 * 24));

    const status = f(wo, 'workOrderStatus', 'WorkOrder') || f(wo, 'workStatus', 'WorkOrder') || f(wo, 'status', 'WorkOrder') || '';
    const woName = f(wo, 'name', 'WorkOrder') || f(wo, 'title', 'WorkOrder') || 'Untitled WO';
    const category = getWOCategory(wo);

    return {
      workOrderId: wo.id,
      workOrderName: woName,
      status,
      category,
      dayStart: Math.max(0, Math.min(6, dayStart)),
      dayEnd: Math.max(0, Math.min(6, dayEnd)),
      techId,
    };
  }

  /** All blocks per tech + unassigned row. */
  const { techBlocks, unassignedBlocks } = useMemo(() => {
    const techBlocks = new Map<string, CalendarBlock[]>();
    const unassignedBlocks: CalendarBlock[] = [];

    // Initialize each tech row
    for (const t of activeTechs) {
      techBlocks.set(t.id, []);
    }

    // Assigned WOs
    for (const [techId, woIds] of techToWOIds.map) {
      if (!techBlocks.has(techId)) continue; // not an active service tech
      const blocks = techBlocks.get(techId)!;
      for (const woId of woIds) {
        const wo = woById.get(woId);
        if (!wo) continue;
        const block = woToBlock(wo, techId);
        if (block) blocks.push(block);
      }
    }

    // Unassigned WOs
    for (const wo of workOrders) {
      if (techToWOIds.assignedWOs.has(wo.id)) continue;
      const block = woToBlock(wo, null);
      if (block) unassignedBlocks.push(block);
    }

    return { techBlocks, unassignedBlocks };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTechs, techToWOIds, woById, workOrders, weekStart, weekEnd]);

  /** Apply category and status filters to blocks. */
  function filterBlocks(blocks: CalendarBlock[]): CalendarBlock[] {
    return blocks.filter((b) => {
      if (categoryFilter !== 'All') {
        if (categoryFilter === 'Client Service' && b.category !== 'Client Service') return false;
        if (categoryFilter === 'Internal' && b.category !== 'Internal') return false;
      }
      if (statusFilter !== 'All' && b.status !== statusFilter) return false;
      return true;
    });
  }

  // ------------------------------------------------------------------
  // Navigation
  // ------------------------------------------------------------------

  function prevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function nextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  function goToToday() {
    setWeekStart(getMonday(new Date()));
  }

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  function renderBlock(block: CalendarBlock) {
    const colorClasses = STATUS_BG[block.status] || STATUS_BG_DEFAULT;
    const isInternal = block.category === 'Internal';
    // Position: percentage-based within the 7-column day grid
    const leftPct = (block.dayStart / 7) * 100;
    const widthPct = ((block.dayEnd - block.dayStart + 1) / 7) * 100;

    return (
      <button
        key={block.workOrderId}
        onClick={() => router.push(`/workorders/${block.workOrderId}`)}
        className={`
          absolute rounded px-1.5 py-0.5 text-xs font-medium truncate border cursor-pointer
          hover:opacity-80 transition-opacity text-left leading-tight
          ${colorClasses}
          ${isInternal ? 'border-dashed opacity-75' : ''}
        `}
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          top: '2px',
          height: 'calc(100% - 4px)',
        }}
        title={`${block.workOrderName} (${block.status})${isInternal ? ' - Internal' : ''}`}
      >
        {block.workOrderName}
      </button>
    );
  }

  /** Arrange blocks into stacked lanes so overlapping WOs don't collide. */
  function arrangeBlocks(blocks: CalendarBlock[]): { block: CalendarBlock; lane: number }[] {
    // Sort by start day, then by span length (longer first)
    const sorted = [...blocks].sort((a, b) => {
      if (a.dayStart !== b.dayStart) return a.dayStart - b.dayStart;
      return (b.dayEnd - b.dayStart) - (a.dayEnd - a.dayStart);
    });

    const lanes: number[][] = []; // each lane tracks the end-day of the last block in it
    const result: { block: CalendarBlock; lane: number }[] = [];

    for (const block of sorted) {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lastEnd = lanes[i]![lanes[i]!.length - 1]!;
        if (block.dayStart > lastEnd) {
          lanes[i]!.push(block.dayEnd);
          result.push({ block, lane: i });
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([block.dayEnd]);
        result.push({ block, lane: lanes.length - 1 });
      }
    }

    return result;
  }

  function renderBlockInLane(block: CalendarBlock, lane: number, totalLanes: number) {
    const colorClasses = STATUS_BG[block.status] || STATUS_BG_DEFAULT;
    const isInternal = block.category === 'Internal';
    const leftPct = (block.dayStart / 7) * 100;
    const widthPct = ((block.dayEnd - block.dayStart + 1) / 7) * 100;
    const laneHeight = totalLanes > 0 ? 100 / totalLanes : 100;
    const topPct = lane * laneHeight;

    return (
      <button
        key={block.workOrderId}
        onClick={() => router.push(`/workorders/${block.workOrderId}`)}
        className={`
          absolute rounded px-1.5 text-xs font-medium truncate border cursor-pointer
          hover:opacity-80 transition-opacity text-left leading-tight flex items-center
          ${colorClasses}
          ${isInternal ? 'border-dashed opacity-75' : ''}
        `}
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          top: `calc(${topPct}% + 2px)`,
          height: `calc(${laneHeight}% - 4px)`,
          minHeight: '22px',
        }}
        title={`${block.workOrderName} (${block.status})${isInternal ? ' - Internal' : ''}`}
      >
        {block.workOrderName}
      </button>
    );
  }

  function renderDayCells(bgClass?: string) {
    return weekDays.map((day, i) => (
      <div
        key={i}
        className={`border-r border-gray-200 ${
          isSameDay(day, today) ? 'bg-blue-50/60' : bgClass || ''
        }`}
      />
    ));
  }

  function renderTechRow(tech: TechRow) {
    const blocks = filterBlocks(techBlocks.get(tech.id) || []);
    const arranged = arrangeBlocks(blocks);
    const totalLanes = arranged.length > 0 ? Math.max(...arranged.map((a) => a.lane)) + 1 : 0;
    const rowHeight = Math.max(48, totalLanes * 28 + 8);

    return (
      <div key={tech.id} className="flex border-b border-gray-200" style={{ minHeight: `${rowHeight}px` }}>
        {/* Tech name */}
        <div className="sticky left-0 z-10 bg-white border-r border-gray-200 px-3 py-2 text-sm font-medium text-gray-900 flex items-start pt-3 flex-shrink-0" style={{ width: '180px', minWidth: '180px' }}>
          {tech.name}
        </div>
        {/* Day grid with overlaid blocks */}
        <div className="flex-1 relative">
          {/* Background day columns */}
          <div className="absolute inset-0 grid grid-cols-7">
            {renderDayCells()}
          </div>
          {/* WO blocks */}
          {arranged.map(({ block, lane }) =>
            renderBlockInLane(block, lane, totalLanes)
          )}
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Main render
  // ------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-navy border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading schedule...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center max-w-md">
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={fetchData}
            className="px-4 py-2 text-sm font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const filteredUnassigned = filterBlocks(unassignedBlocks);
  const totalAssigned = Array.from(techBlocks.values()).reduce(
    (sum, blocks) => sum + filterBlocks(blocks).length, 0
  );

  return (
    <div className="p-4 sm:p-6 max-w-full">
      {/* Header / Controls */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Title row */}
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-6 h-6 text-brand-navy" />
          <h1 className="text-xl font-bold text-brand-navy">Schedule Calendar</h1>
        </div>

        {/* Controls row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Week navigation */}
          <div className="flex items-center gap-0 bg-white border border-gray-200 rounded-lg shadow-sm">
            <button
              onClick={prevWeek}
              className="p-2 hover:bg-gray-100 rounded-l-lg transition-colors"
              title="Previous week"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors whitespace-nowrap"
              title="Go to current week"
            >
              {formatWeekLabel(weekStart)}
            </button>
            <button
              onClick={nextWeek}
              className="p-2 hover:bg-gray-100 rounded-r-lg transition-colors"
              title="Next week"
            >
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {/* Category filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-navy"
              >
                <option value="All">All Categories</option>
                <option value="Client Service">Client Service</option>
                <option value="Internal">Internal</option>
              </select>
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-brand-navy"
            >
              <option value="All">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-400" /> Scheduled</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 border border-green-400" /> In Progress</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400" /> Completed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200 border border-gray-400" /> Closed</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-gray-400 opacity-75" /> Internal</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header row */}
          <div className="flex border-b border-gray-300">
            <div className="bg-gray-50 border-r border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center flex-shrink-0" style={{ width: '180px', minWidth: '180px' }}>
              Technician
            </div>
            <div className="flex-1 grid grid-cols-7">
              {weekDays.map((day, i) => (
                <div
                  key={i}
                  className={`border-r border-gray-200 px-2 py-2.5 text-xs font-semibold text-center uppercase tracking-wider ${
                    isSameDay(day, today) ? 'bg-blue-50 text-blue-700' : 'bg-gray-50 text-gray-500'
                  }`}
                >
                  {formatShortDate(day)}
                </div>
              ))}
            </div>
          </div>

          {/* Technician rows */}
          {activeTechs.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No active service technicians found.
            </div>
          ) : (
            activeTechs.map((tech) => renderTechRow(tech))
          )}

          {/* Unassigned row */}
          {filteredUnassigned.length > 0 && (
            <>
              {/* Separator */}
              <div className="border-t-2 border-gray-300" />
              <div className="flex border-b border-gray-200" style={{ minHeight: '48px' }}>
                <div className="sticky left-0 z-10 bg-orange-50 border-r border-gray-200 px-3 py-2 text-sm font-medium text-orange-700 flex items-start pt-3 flex-shrink-0" style={{ width: '180px', minWidth: '180px' }}>
                  Unassigned
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-0 grid grid-cols-7">
                    {renderDayCells('bg-orange-50/30')}
                  </div>
                  {(() => {
                    const arranged = arrangeBlocks(filteredUnassigned);
                    const totalLanes = arranged.length > 0 ? Math.max(...arranged.map((a) => a.lane)) + 1 : 0;
                    return arranged.map(({ block, lane }) =>
                      renderBlockInLane(block, lane, totalLanes)
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary stats */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">
        <span>{activeTechs.length} technician{activeTechs.length !== 1 ? 's' : ''}</span>
        <span>
          {totalAssigned} assigned work order{totalAssigned !== 1 ? 's' : ''} this week
        </span>
        {filteredUnassigned.length > 0 && (
          <span className="text-orange-600 font-medium">
            {filteredUnassigned.length} unassigned
          </span>
        )}
      </div>
    </div>
  );
}
