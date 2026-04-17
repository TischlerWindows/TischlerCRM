'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Inbox, Search } from 'lucide-react';
import { usePermissions } from '@/lib/permissions-context';
import {
  ticketsClient,
  type TicketListItem,
  type TicketStatus,
  type TicketCategory,
  type TicketPriority,
} from '@/lib/tickets-client';
import { TicketStatusPill } from '@/components/support/ticket-status-pill';
import { TicketPriorityPill } from '@/components/support/ticket-priority-pill';
import { TicketCategoryPill } from '@/components/support/ticket-category-pill';

type StatusFilter = TicketStatus | 'ALL';
type CategoryFilter = TicketCategory | 'ALL';
type PriorityFilter = TicketPriority | 'ALL';

export default function AdminTicketsPage() {
  const router = useRouter();
  const { hasAppPermission, loading: permsLoading } = usePermissions();
  const canManage = hasAppPermission('manageSupportTickets');

  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (permsLoading) return;
    if (!canManage) {
      router.replace('/');
      return;
    }
  }, [permsLoading, canManage, router]);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await ticketsClient.list({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          category: categoryFilter === 'ALL' ? undefined : categoryFilter,
          priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
          q: search.trim() || undefined,
          pageSize: 100,
        });
        setTickets(res.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tickets');
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, categoryFilter, priorityFilter, search],
  );

  useEffect(() => {
    if (!canManage) return;
    void load();
  }, [canManage, load]);

  if (!canManage) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-brand-dark">Support tickets</h1>
        <p className="text-sm text-brand-dark/60 mt-1">
          Triage, respond, and resolve internal support tickets.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap gap-3 items-end">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search titles…"
            className="w-full border border-gray-300 rounded-md pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
        >
          <option value="ALL">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="WAITING_ON_USER">Waiting on user</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
        >
          <option value="ALL">All categories</option>
          <option value="UNTRIAGED">Untriaged</option>
          <option value="CRM_ISSUE">CRM issue</option>
          <option value="IT_ISSUE">IT issue</option>
          <option value="FEATURE_REQUEST">Feature request</option>
          <option value="QUESTION">Question</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
          className="border border-gray-300 rounded-md px-2 py-2 text-sm bg-white"
        >
          <option value="ALL">All priorities</option>
          <option value="URGENT">Urgent</option>
          <option value="HIGH">High</option>
          <option value="NORMAL">Normal</option>
          <option value="LOW">Low</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading tickets…
        </div>
      ) : error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-sm font-medium text-brand-dark/80">No tickets match these filters</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-brand-dark/70">
              <tr>
                <th className="text-left font-medium px-4 py-2">#</th>
                <th className="text-left font-medium px-4 py-2">Title</th>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-left font-medium px-4 py-2">Category</th>
                <th className="text-left font-medium px-4 py-2">Priority</th>
                <th className="text-left font-medium px-4 py-2">Submitter</th>
                <th className="text-left font-medium px-4 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-100 last:border-b-0 hover:bg-brand-light/50 cursor-pointer"
                  onClick={() => router.push(`/support/tickets/${t.id}`)}
                >
                  <td className="px-4 py-2 text-xs text-gray-500 font-mono">
                    T-{String(t.ticketNumber).padStart(5, '0')}
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/support/tickets/${t.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-navy hover:underline"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2"><TicketStatusPill status={t.status} /></td>
                  <td className="px-4 py-2"><TicketCategoryPill category={t.category} /></td>
                  <td className="px-4 py-2"><TicketPriorityPill priority={t.priority} /></td>
                  <td className="px-4 py-2 text-brand-dark/80">
                    {t.submittedBy.name ?? t.submittedBy.email}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">
                    {new Date(t.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
