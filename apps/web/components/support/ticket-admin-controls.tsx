'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ticketsClient,
  type SupportTicket,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
  type UserRef,
} from '@/lib/tickets-client';

const STATUS_OPTIONS: TicketStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_USER',
  'RESOLVED',
  'CLOSED',
];
const PRIORITY_OPTIONS: TicketPriority[] = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const CATEGORY_OPTIONS: TicketCategory[] = [
  'UNTRIAGED',
  'CRM_ISSUE',
  'IT_ISSUE',
  'FEATURE_REQUEST',
  'QUESTION',
];

const STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on user',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};
const CATEGORY_LABELS: Record<TicketCategory, string> = {
  UNTRIAGED: 'Untriaged',
  CRM_ISSUE: 'CRM issue',
  IT_ISSUE: 'IT issue',
  FEATURE_REQUEST: 'Feature request',
  QUESTION: 'Question',
};
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

interface Props {
  ticket: SupportTicket;
  onUpdated: (ticket: SupportTicket) => void;
}

export function TicketAdminControls({ ticket, onUpdated }: Props) {
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignableUsers, setAssignableUsers] = useState<UserRef[]>([]);

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
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
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
