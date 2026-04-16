'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordsService } from '@/lib/records-service';

// ---------- helpers ----------

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isWithinDays(date: Date, from: Date, days: number): boolean {
  const target = startOfDay(date);
  const start = startOfDay(from);
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return target > start && target <= end;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(value: unknown): string {
  const d = parseDate(value);
  if (!d) return '-';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Read a field that might be stored with or without an object prefix
function f(record: Record<string, any>, field: string, prefix?: string): any {
  if (record[field] !== undefined) return record[field];
  if (prefix && record[`${prefix}__${field}`] !== undefined) return record[`${prefix}__${field}`];
  return undefined;
}

// ---------- status badge ----------

const STATUS_COLORS: Record<string, string> = {
  Scheduled: 'bg-blue-100 text-blue-800',
  'In Progress': 'bg-green-100 text-green-800',
  Completed: 'bg-yellow-100 text-yellow-800',
  Closed: 'bg-gray-100 text-gray-700',
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full ${color}`}>
      {status || 'Unknown'}
    </span>
  );
}

// ---------- section component ----------

interface SectionProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  emptyMessage: string;
  children: React.ReactNode;
}

function Section({ title, count, icon, emptyMessage, children }: SectionProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-lg font-semibold text-brand-navy">
          {title} ({count})
        </h2>
      </div>
      {count === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center text-gray-500 text-sm">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
      )}
    </div>
  );
}

// ---------- work order card ----------

interface WOCardProps {
  wo: Record<string, any>;
  properties: Record<string, any>[];
}

function WOCard({ wo, properties }: WOCardProps) {
  const name = f(wo, 'name', 'WorkOrder') || f(wo, 'title', 'WorkOrder') || 'Untitled Work Order';
  const status = f(wo, 'workOrderStatus', 'WorkOrder') || f(wo, 'workStatus', 'WorkOrder') || '';
  const start = f(wo, 'scheduledStartDate', 'WorkOrder');
  const end = f(wo, 'scheduledEndDate', 'WorkOrder');

  // Try to resolve the property name / address
  const propertyId = f(wo, 'property', 'WorkOrder');
  const propertyRecord = propertyId
    ? properties.find((p) => p.id === propertyId)
    : null;
  const propertyName =
    propertyRecord
      ? f(propertyRecord, 'name', 'Property') || f(propertyRecord, 'address', 'Property') || ''
      : '';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{name}</h3>
        <StatusBadge status={status} />
      </div>

      {propertyName && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-1">{propertyName}</p>
      )}

      <div className="text-xs text-gray-500 mb-3 space-y-0.5">
        {start && (
          <p>
            <span className="font-medium">Start:</span> {formatDate(start)}
          </p>
        )}
        {end && (
          <p>
            <span className="font-medium">End:</span> {formatDate(end)}
          </p>
        )}
      </div>

      <Link
        href={`/workorders/${wo.id}`}
        className="inline-flex items-center text-xs font-medium text-brand-navy hover:underline"
      >
        View Details
        <ChevronRight className="w-3 h-3 ml-0.5" />
      </Link>
    </div>
  );
}

// ---------- main page ----------

export default function TechDashboardPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [techName, setTechName] = useState<string>('');
  const [workOrders, setWorkOrders] = useState<Record<string, any>[]>([]);
  const [myAssignmentWOIds, setMyAssignmentWOIds] = useState<Set<string>>(new Set());
  const [timeEntries, setTimeEntries] = useState<Record<string, any>[]>([]);
  const [properties, setProperties] = useState<Record<string, any>[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      setError(null);

      // Fetch all needed objects in parallel
      const [techRaw, assignmentRaw, woRaw, teRaw, propRaw] = await Promise.all([
        recordsService.getRecords('Technician'),
        recordsService.getRecords('WorkOrderAssignment'),
        recordsService.getRecords('WorkOrder'),
        recordsService.getRecords('TimeEntry').catch(() => []),
        recordsService.getRecords('Property').catch(() => []),
      ]);

      const techs = recordsService.flattenRecords(techRaw);
      const assignments = recordsService.flattenRecords(assignmentRaw);
      const allWOs = recordsService.flattenRecords(woRaw);
      const allTEs = recordsService.flattenRecords(teRaw);
      const allProps = recordsService.flattenRecords(propRaw);

      // Find current user's technician record
      const myTech = techs.find(
        (t) =>
          f(t, 'user', 'Technician') === user.id ||
          f(t, 'userId', 'Technician') === user.id,
      );

      if (!myTech) {
        setTechName('');
        setWorkOrders([]);
        setMyAssignmentWOIds(new Set());
        setTimeEntries([]);
        setProperties(allProps);
        setLoading(false);
        return;
      }

      setTechName(
        f(myTech, 'name', 'Technician') ||
          f(myTech, 'fullName', 'Technician') ||
          user.name ||
          '',
      );

      // Find assignments for this tech
      const myAssigns = assignments.filter((a) => {
        const techId = f(a, 'technician', 'WorkOrderAssignment');
        return techId === myTech.id;
      });

      const woIdSet = new Set<string>(
        myAssigns
          .map((a) => f(a, 'workOrder', 'WorkOrderAssignment') as string)
          .filter(Boolean),
      );

      // Also filter time entries for this tech
      const myTEs = allTEs.filter((te) => {
        const teTechId = f(te, 'technician', 'TimeEntry');
        return teTechId === myTech.id;
      });

      setMyAssignmentWOIds(woIdSet);
      setWorkOrders(allWOs);
      setTimeEntries(myTEs);
      setProperties(allProps);
    } catch (err) {
      console.error('Tech dashboard fetch error:', err);
      setError('Failed to load dashboard data. Please try refreshing.');
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.name]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter WOs to only those assigned to this tech
  const myWorkOrders = useMemo(
    () => workOrders.filter((wo) => myAssignmentWOIds.has(wo.id)),
    [workOrders, myAssignmentWOIds],
  );

  // Build a set of WO ids that have time entries from this tech
  const woIdsWithTime = useMemo(() => {
    const ids = new Set<string>();
    for (const te of timeEntries) {
      const woId = f(te, 'workOrder', 'TimeEntry');
      if (woId) ids.add(woId);
    }
    return ids;
  }, [timeEntries]);

  // Categorize
  const now = new Date();
  const today = startOfDay(now);

  const todaysWork = useMemo(
    () =>
      myWorkOrders.filter((wo) => {
        const start = parseDate(f(wo, 'scheduledStartDate', 'WorkOrder'));
        const end = parseDate(f(wo, 'scheduledEndDate', 'WorkOrder'));
        if (start && isSameDay(start, today)) return true;
        if (start && end && start <= today && end >= today) return true;
        return false;
      }),
    [myWorkOrders, today],
  );

  const upcoming = useMemo(
    () =>
      myWorkOrders.filter((wo) => {
        const start = parseDate(f(wo, 'scheduledStartDate', 'WorkOrder'));
        if (!start) return false;
        // Exclude ones already in Today's Work
        if (isSameDay(start, today)) return false;
        const startOfStart = startOfDay(start);
        if (startOfStart <= today) return false;
        return isWithinDays(start, today, 14);
      }),
    [myWorkOrders, today],
  );

  const pendingReview = useMemo(
    () =>
      myWorkOrders.filter((wo) => {
        const status = f(wo, 'workOrderStatus', 'WorkOrder') || f(wo, 'workStatus', 'WorkOrder');
        if (status !== 'Completed') return false;
        const completed = parseDate(f(wo, 'completedDate', 'WorkOrder'));
        if (!completed) return true; // Completed status but no date — show it
        const hoursSince = (now.getTime() - completed.getTime()) / (1000 * 60 * 60);
        return hoursSince <= 24;
      }),
    [myWorkOrders, now],
  );

  const missingHours = useMemo(
    () =>
      myWorkOrders.filter((wo) => {
        const status = f(wo, 'workOrderStatus', 'WorkOrder') || f(wo, 'workStatus', 'WorkOrder');
        if (status !== 'Completed' && status !== 'Closed') return false;
        return !woIdsWithTime.has(wo.id);
      }),
    [myWorkOrders, woIdsWithTime],
  );

  // ---------- render ----------

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-500 text-sm">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-brand-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-navy">My Dashboard</h1>
            {techName && (
              <p className="text-sm text-gray-500">{techName}</p>
            )}
          </div>
        </div>
        <button
          onClick={fetchData}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* No technician record */}
      {!loading && myAssignmentWOIds.size === 0 && !techName && (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center mb-6">
          <LayoutDashboard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-1">No Technician Record Found</h2>
          <p className="text-sm text-gray-500">
            Your user account is not linked to a Technician record. Please contact your administrator.
          </p>
        </div>
      )}

      {/* Sections */}
      <Section
        title="Today's Work"
        count={todaysWork.length}
        icon={<CalendarDays className="w-5 h-5 text-blue-600" />}
        emptyMessage="No work orders scheduled for today."
      >
        {todaysWork.map((wo) => (
          <WOCard key={wo.id} wo={wo} properties={properties} />
        ))}
      </Section>

      <Section
        title="Upcoming"
        count={upcoming.length}
        icon={<Clock className="w-5 h-5 text-indigo-600" />}
        emptyMessage="No upcoming work orders in the next 14 days."
      >
        {upcoming.map((wo) => (
          <WOCard key={wo.id} wo={wo} properties={properties} />
        ))}
      </Section>

      <Section
        title="Pending Review"
        count={pendingReview.length}
        icon={<Clock className="w-5 h-5 text-yellow-600" />}
        emptyMessage="No work orders pending review."
      >
        {pendingReview.map((wo) => (
          <WOCard key={wo.id} wo={wo} properties={properties} />
        ))}
      </Section>

      <Section
        title="Missing Hours"
        count={missingHours.length}
        icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
        emptyMessage="All completed work orders have time entries."
      >
        {missingHours.map((wo) => (
          <WOCard key={wo.id} wo={wo} properties={properties} />
        ))}
      </Section>
    </div>
  );
}
