'use client';

import type { TicketStatus } from '@/lib/tickets-client';

const STYLES: Record<TicketStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-800 border-amber-200',
  WAITING_ON_USER: 'bg-purple-100 text-purple-800 border-purple-200',
  RESOLVED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  CLOSED: 'bg-gray-100 text-gray-700 border-gray-200',
};

const LABELS: Record<TicketStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  WAITING_ON_USER: 'Waiting on user',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function TicketStatusPill({ status }: { status: TicketStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
