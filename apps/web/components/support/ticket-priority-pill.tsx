'use client';

import type { TicketPriority } from '@/lib/tickets-client';

const STYLES: Record<TicketPriority, string> = {
  LOW: 'bg-gray-100 text-gray-700 border-gray-200',
  NORMAL: 'bg-slate-100 text-slate-700 border-slate-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  URGENT: 'bg-red-100 text-red-800 border-red-200',
};

const LABELS: Record<TicketPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Normal',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export function TicketPriorityPill({ priority }: { priority: TicketPriority }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[priority]}`}
    >
      {LABELS[priority]}
    </span>
  );
}
