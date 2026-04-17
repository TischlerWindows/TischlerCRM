'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Loader2, Inbox } from 'lucide-react';
import { ticketsClient, type TicketListItem } from '@/lib/tickets-client';
import { TicketStatusPill } from './ticket-status-pill';
import { TicketPriorityPill } from './ticket-priority-pill';

interface MyTicketsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MyTicketsDrawer({ open, onClose }: MyTicketsDrawerProps) {
  const [tickets, setTickets] = useState<TicketListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await ticketsClient.list({ mine: true, pageSize: 50 });
        setTickets(res.items);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load tickets');
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[65] flex justify-end">
      <button
        type="button"
        aria-label="Close"
        className="flex-1 bg-black/40"
        onClick={onClose}
      />
      <aside className="w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">My tickets</h2>
            <p className="text-xs text-gray-500">Tickets you&apos;ve submitted.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
            </div>
          )}

          {!loading && error && (
            <div className="m-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          {!loading && !error && tickets.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <Inbox className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm font-medium text-brand-dark/80">No tickets yet</p>
              <p className="text-xs text-gray-500 mt-1">
                When you submit one, it&apos;ll show up here.
              </p>
            </div>
          )}

          {!loading && !error && tickets.length > 0 && (
            <ul>
              {tickets.map((t) => (
                <li key={t.id} className="border-b border-gray-100 last:border-b-0">
                  <Link
                    href={`/support/tickets/${t.id}`}
                    onClick={onClose}
                    className="block px-4 py-3 hover:bg-brand-light transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs text-gray-500 font-mono">
                        #T-{String(t.ticketNumber).padStart(5, '0')}
                      </span>
                      <TicketStatusPill status={t.status} />
                    </div>
                    <p className="text-sm font-medium text-brand-dark mt-1 line-clamp-2">
                      {t.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <TicketPriorityPill priority={t.priority} />
                      <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}
