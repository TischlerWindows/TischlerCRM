'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { GripVertical, UserPlus, Inbox, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordsService } from '@/lib/records-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function f(record: Record<string, any>, field: string, prefix?: string): any {
  if (record[field] !== undefined) return record[field];
  if (prefix && record[`${prefix}__${field}`] !== undefined)
    return record[`${prefix}__${field}`];
  return undefined;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: unknown): string {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// ---------------------------------------------------------------------------
// Draggable WO Card (left panel)
// ---------------------------------------------------------------------------

function DraggableWOCard({
  wo,
}: {
  wo: Record<string, any>;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: wo.id,
    data: { type: 'workOrder', wo },
  });

  const name =
    f(wo, 'name', 'WorkOrder') ||
    f(wo, 'title', 'WorkOrder') ||
    'Untitled WO';
  const property =
    f(wo, 'propertyName', 'WorkOrder') ||
    f(wo, 'property', 'WorkOrder') ||
    '';
  const startDate = f(wo, 'scheduledStartDate', 'WorkOrder');
  const endDate = f(wo, 'scheduledEndDate', 'WorkOrder');

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-30' : 'opacity-100'
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          {property && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {typeof property === 'object' && property !== null
                ? (property as any).name || String(property)
                : String(property)}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
            <span>{formatDate(startDate)}</span>
            {endDate && startDate !== endDate && (
              <>
                <span>-</span>
                <span>{formatDate(endDate)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WO Card (static, shown inside tech card for assigned WOs)
// ---------------------------------------------------------------------------

function AssignedWOBadge({ name }: { name: string }) {
  return (
    <div className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-1 truncate">
      {name}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Droppable Tech Card (right panel)
// ---------------------------------------------------------------------------

function TechDropCard({
  tech,
  assignedWOs,
  isOver,
}: {
  tech: { id: string; name: string; code: string };
  assignedWOs: { id: string; name: string }[];
  isOver?: boolean;
}) {
  const { setNodeRef, isOver: dropping } = useDroppable({
    id: tech.id,
    data: { type: 'technician', tech },
  });

  const highlight = isOver || dropping;

  return (
    <div
      ref={setNodeRef}
      className={`bg-white rounded-lg border shadow-sm p-4 transition-all ${
        highlight
          ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-300'
          : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-navy flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {tech.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{tech.name}</p>
            {tech.code && (
              <p className="text-xs text-gray-400">{tech.code}</p>
            )}
          </div>
        </div>
        <span className="text-xs font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">
          {assignedWOs.length} WO{assignedWOs.length !== 1 ? 's' : ''}
        </span>
      </div>

      {assignedWOs.length > 0 ? (
        <div className="space-y-1 mt-2">
          {assignedWOs.slice(0, 5).map((wo) => (
            <AssignedWOBadge key={wo.id} name={wo.name} />
          ))}
          {assignedWOs.length > 5 && (
            <p className="text-xs text-gray-400 pl-2">
              +{assignedWOs.length - 5} more
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 py-3 border-2 border-dashed border-gray-200 rounded-md flex items-center justify-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-xs text-gray-400">Drop WO here</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag Overlay (ghost shown while dragging)
// ---------------------------------------------------------------------------

function DragOverlayCard({ wo }: { wo: Record<string, any> }) {
  const name =
    f(wo, 'name', 'WorkOrder') ||
    f(wo, 'title', 'WorkOrder') ||
    'Untitled WO';
  const property =
    f(wo, 'propertyName', 'WorkOrder') ||
    f(wo, 'property', 'WorkOrder') ||
    '';

  return (
    <div className="bg-white rounded-lg border border-blue-300 shadow-xl p-3 rotate-2 w-64">
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
          {property && (
            <p className="text-xs text-gray-500 truncate mt-0.5">
              {typeof property === 'object' && property !== null
                ? (property as any).name || String(property)
                : String(property)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AssignmentBoardPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Raw data
  const [technicians, setTechnicians] = useState<Record<string, any>[]>([]);
  const [assignments, setAssignments] = useState<Record<string, any>[]>([]);
  const [workOrders, setWorkOrders] = useState<Record<string, any>[]>([]);

  // Active drag
  const [activeWO, setActiveWO] = useState<Record<string, any> | null>(null);

  // Sensors — require 6px of movement before starting drag
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

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
      console.error('Assignment board fetch error:', err);
      setError('Failed to load data. Please try refreshing.');
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

  /** Active service technicians. */
  const activeTechs = useMemo(() => {
    return technicians
      .filter((t) => {
        const active = f(t, 'active', 'Technician');
        const status = f(t, 'status', 'Technician');
        const isActive =
          active === true ||
          active === 'true' ||
          status === 'Active' ||
          (active === undefined && status === undefined);

        const dept =
          f(t, 'departmentTags', 'Technician') ||
          f(t, 'department', 'Technician') ||
          '';
        const deptStr = Array.isArray(dept) ? dept.join(',') : String(dept);
        const isService =
          deptStr.toLowerCase().includes('service') || deptStr === '';

        return isActive && isService;
      })
      .map((t) => ({
        id: t.id,
        name:
          f(t, 'name', 'Technician') ||
          f(t, 'fullName', 'Technician') ||
          'Unnamed Tech',
        code:
          f(t, 'techCode', 'Technician') ||
          f(t, 'code', 'Technician') ||
          '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [technicians]);

  /** Set of WO IDs that have at least one assignment. */
  const assignedWOIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of assignments) {
      const woId =
        f(a, 'workOrder', 'WorkOrderAssignment') as string;
      if (woId) ids.add(woId);
    }
    return ids;
  }, [assignments]);

  /** Map tech ID -> array of assigned WO info (this week). */
  const weekStart = useMemo(() => getMonday(new Date()), []);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    d.setHours(23, 59, 59, 999);
    return d;
  }, [weekStart]);

  const woById = useMemo(() => {
    const m = new Map<string, Record<string, any>>();
    for (const wo of workOrders) m.set(wo.id, wo);
    return m;
  }, [workOrders]);

  const techAssignments = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const t of activeTechs) {
      map.set(t.id, []);
    }
    for (const a of assignments) {
      const techId = f(a, 'technician', 'WorkOrderAssignment') as string;
      const woId = f(a, 'workOrder', 'WorkOrderAssignment') as string;
      if (!techId || !woId) continue;
      const wo = woById.get(woId);
      if (!wo) continue;

      // Filter to this week
      const start = parseDate(f(wo, 'scheduledStartDate', 'WorkOrder'));
      const end = parseDate(f(wo, 'scheduledEndDate', 'WorkOrder'));
      const effectiveStart = start || end;
      const effectiveEnd = end || start;
      if (!effectiveStart) continue;

      const woStart = new Date(effectiveStart);
      woStart.setHours(0, 0, 0, 0);
      const woEnd = new Date(effectiveEnd!);
      woEnd.setHours(23, 59, 59, 999);

      if (woEnd < weekStart || woStart > weekEnd) continue;

      const woName =
        f(wo, 'name', 'WorkOrder') ||
        f(wo, 'title', 'WorkOrder') ||
        'Untitled WO';

      if (!map.has(techId)) map.set(techId, []);
      map.get(techId)!.push({ id: woId, name: woName });
    }
    return map;
  }, [assignments, activeTechs, woById, weekStart, weekEnd]);

  /** Unassigned WOs with status Scheduled. */
  const unassignedWOs = useMemo(() => {
    return workOrders.filter((wo) => {
      if (assignedWOIds.has(wo.id)) return false;
      const status =
        f(wo, 'workOrderStatus', 'WorkOrder') ||
        f(wo, 'workStatus', 'WorkOrder') ||
        f(wo, 'status', 'WorkOrder') ||
        '';
      return String(status) === 'Scheduled';
    });
  }, [workOrders, assignedWOIds]);

  // ------------------------------------------------------------------
  // Drag handlers
  // ------------------------------------------------------------------

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const woId = event.active.id as string;
      const wo = unassignedWOs.find((w) => w.id === woId);
      setActiveWO(wo || null);
    },
    [unassignedWOs],
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveWO(null);
      const { active, over } = event;
      if (!over) return;

      const woId = active.id as string;
      const techId = over.id as string;

      // Verify the drop target is a technician
      if (!activeTechs.some((t) => t.id === techId)) return;

      try {
        setSaving(true);
        await recordsService.createRecord('WorkOrderAssignment', {
          data: {
            workOrder: woId,
            technician: techId,
            isLead: false,
            notified: false,
          },
        });
        // Re-fetch to update UI
        const [assignRaw, woRaw] = await Promise.all([
          recordsService.getRecords('WorkOrderAssignment'),
          recordsService.getRecords('WorkOrder'),
        ]);
        setAssignments(recordsService.flattenRecords(assignRaw));
        setWorkOrders(recordsService.flattenRecords(woRaw));
      } catch (err) {
        console.error('Failed to create assignment:', err);
        setError('Failed to assign work order. Please try again.');
      } finally {
        setSaving(false);
      }
    },
    [activeTechs],
  );

  const handleDragCancel = useCallback(() => {
    setActiveWO(null);
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-gray-500">Please log in to view the assignment board.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Assignment Board</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Drag unassigned work orders onto technician cards to assign them.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-xs text-red-500 hover:text-red-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Saving indicator */}
      {saving && (
        <div className="mx-6 mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700 text-center">Assigning work order...</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500">Loading assignment board...</p>
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Unassigned Work Orders */}
            <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col">
              <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-900">
                    Unassigned
                  </h2>
                </div>
                <span className="text-xs font-medium text-white bg-brand-navy rounded-full px-2 py-0.5">
                  {unassignedWOs.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {unassignedWOs.length === 0 ? (
                  <div className="py-12 text-center">
                    <Inbox className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      No unassigned scheduled work orders
                    </p>
                  </div>
                ) : (
                  unassignedWOs.map((wo) => (
                    <DraggableWOCard key={wo.id} wo={wo} />
                  ))
                )}
              </div>
            </div>

            {/* Right Panel: Technician Cards */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              <div className="flex items-center gap-2 mb-4">
                <UserPlus className="w-4 h-4 text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-900">
                  Technicians
                </h2>
                <span className="text-xs text-gray-400">
                  ({activeTechs.length} active)
                </span>
              </div>

              {activeTechs.length === 0 ? (
                <div className="py-12 text-center">
                  <UserPlus className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">
                    No active service technicians found
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {activeTechs.map((tech) => (
                    <TechDropCard
                      key={tech.id}
                      tech={tech}
                      assignedWOs={techAssignments.get(tech.id) || []}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Drag Overlay */}
          <DragOverlay>
            {activeWO ? <DragOverlayCard wo={activeWO} /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
