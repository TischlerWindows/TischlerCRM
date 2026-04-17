'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ticketsClient,
  type SupportTicket,
  type TicketPriority,
  type TicketStatus,
  type UserRef,
} from '@/lib/tickets-client';
import { categoriesClient } from '@/lib/support-ticket-categories-client';

const STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_USER',
  'RESOLVED',
  'CLOSED',
];
const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on user',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

interface CategoryOption {
  key: string;
  label: string;
  isOrphan: boolean;
}

interface Props {
  ticket: SupportTicket;
  onUpdated: (ticket: SupportTicket) => void;
}

export function TicketAdminControls({ ticket, onUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<UserRef[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategoryOption[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { users } = await ticketsClient.getAssignableUsers();
        setAssignableUsers(users);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { items, orphans } = await categoriesClient.listAdmin();
        const active: CategoryOption[] = items.map((c) => ({
          key: c.key,
          label: c.label,
          isOrphan: false,
        }));
        const orphanOptions: CategoryOption[] = orphans
          .filter((o) => !items.find((i) => i.key === o.key))
          .map((o) => ({ key: o.key, label: `${o.key} (deleted)`, isOrphan: true }));
        // Keep the currently-selected orphan in the list even if the orphans
        // response didn't surface it (e.g. freshly renamed).
        if (
          ticket.category &&
          !active.find((a) => a.key === ticket.category) &&
          !orphanOptions.find((o) => o.key === ticket.category)
        ) {
          orphanOptions.push({
            key: ticket.category,
            label: `${ticket.category} (deleted)`,
            isOrphan: true,
          });
        }
        setCategoryOptions([...active, ...orphanOptions]);
      } catch {
        // Non-fatal; dropdown is empty and admin can reload.
      }
    })();
  }, [ticket.category]);

  const apply = async (field: string, body: Record<string, unknown>) => {
    setSaving(field);
    setError(null);
    try {
      const next = await ticketsClient.patch(ticket.id, body as any);
      onUpdated(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="border border-gray-200 rounded-md bg-gray-50 p-4 grid gap-3 md:grid-cols-2">
      <label className="text-sm">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-1 flex items-center gap-2">
          Status {saving === 'status' && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        <select
          value={ticket.status}
          onChange={(e) => apply('status', { status: e.target.value })}
          disabled={!!saving}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-1 flex items-center gap-2">
          Priority {saving === 'priority' && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        <select
          value={ticket.priority}
          onChange={(e) => apply('priority', { priority: e.target.value })}
          disabled={!!saving}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-1 flex items-center gap-2">
          Category {saving === 'category' && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        <select
          value={ticket.category}
          onChange={(e) => apply('category', { category: e.target.value })}
          disabled={!!saving}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          {categoryOptions.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm">
        <span className="block text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-1 flex items-center gap-2">
          Assignee {saving === 'assignedToId' && <Loader2 className="w-3 h-3 animate-spin" />}
        </span>
        <select
          value={ticket.assignedTo?.id ?? ''}
          onChange={(e) =>
            apply('assignedToId', { assignedToId: e.target.value === '' ? null : e.target.value })
          }
          disabled={!!saving}
          className="w-full border border-gray-300 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Unassigned</option>
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="md:col-span-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}
    </div>
  );
}
