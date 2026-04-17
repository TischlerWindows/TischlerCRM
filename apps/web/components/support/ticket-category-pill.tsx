'use client';

import type { TicketCategory } from '@/lib/tickets-client';

const STYLES: Record<TicketCategory, string> = {
  UNTRIAGED: 'bg-gray-100 text-gray-600 border-gray-200',
  CRM_ISSUE: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  IT_ISSUE: 'bg-sky-100 text-sky-800 border-sky-200',
  FEATURE_REQUEST: 'bg-teal-100 text-teal-800 border-teal-200',
  QUESTION: 'bg-violet-100 text-violet-800 border-violet-200',
};

const LABELS: Record<TicketCategory, string> = {
  UNTRIAGED: 'Untriaged',
  CRM_ISSUE: 'CRM issue',
  IT_ISSUE: 'IT issue',
  FEATURE_REQUEST: 'Feature request',
  QUESTION: 'Question',
};

export function TicketCategoryPill({ category }: { category: TicketCategory }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STYLES[category]}`}
    >
      {LABELS[category]}
    </span>
  );
}
