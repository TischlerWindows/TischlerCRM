'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { ticketsClient, type SupportTicket } from '@/lib/tickets-client';
import { TicketStatusPill } from './ticket-status-pill';
import { TicketPriorityPill } from './ticket-priority-pill';
import { TicketCategoryPill } from './ticket-category-pill';
import { TicketTimeline } from './ticket-timeline';
import { AttachmentsSlot } from './attachments-slot';
import { TicketAdminControls } from './ticket-admin-controls';

interface TicketDetailPanelProps {
  ticketId: string;
  mode: 'user' | 'admin';
  onClose?: () => void;
}

export function TicketDetailPanel({ ticketId, mode, onClose }: TicketDetailPanelProps) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [posting, setPosting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const t = await ticketsClient.get(ticketId);
      setTicket(t);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || posting) return;
    setPosting(true);
    try {
      const next = await ticketsClient.addComment(ticketId, commentBody.trim());
      setTicket(next);
      setCommentBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ticket…
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md">
        {error ?? 'Ticket not found.'}
      </div>
    );
  }

  const submitterName = ticket.submittedBy?.name ?? ticket.submittedBy?.email;
  const canResolve = mode === 'admin';

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs text-gray-500 font-mono">#T-{String(ticket.ticketNumber).padStart(5, '0')}</div>
          <h1 className="text-xl font-semibold text-brand-dark mt-1 break-words">{ticket.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TicketStatusPill status={ticket.status} />
            <TicketPriorityPill priority={ticket.priority} />
            <TicketCategoryPill category={ticket.category} />
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Submitted by <span className="font-medium text-brand-dark/80">{submitterName}</span> on{' '}
            {new Date(ticket.createdAt).toLocaleString()}
            {ticket.assignedTo && (
              <>
                {' · Assigned to '}
                <span className="font-medium text-brand-dark/80">
                  {ticket.assignedTo.name ?? ticket.assignedTo.email}
                </span>
              </>
            )}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-sm text-brand-dark/70 hover:text-brand-dark px-3 py-1.5 rounded-md hover:bg-gray-100"
          >
            Close
          </button>
        )}
      </header>

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-2">
          Description
        </h2>
        <p className="text-sm text-brand-dark/90 whitespace-pre-wrap break-words">
          {ticket.description}
        </p>
      </section>

      {mode === 'admin' && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-2">
            Admin controls
          </h2>
          <TicketAdminControls ticket={ticket} onUpdated={setTicket} />
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-2">
          Attachments
        </h2>
        <AttachmentsSlot
          ticketId={ticket.id}
          folderRef={ticket.attachmentFolderRef}
          attachments={ticket.attachments}
          onAttachmentAdded={refresh as any}
        />
      </section>

      {ticket.errorLogs.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Attached error logs ({ticket.errorLogs.length})
          </h2>
          <ul className="space-y-1.5">
            {ticket.errorLogs.map((log) => (
              <li
                key={log.id}
                className="text-xs bg-amber-50 border border-amber-200 rounded-md px-3 py-2"
              >
                <div className="text-brand-dark font-medium break-words">{log.message}</div>
                {log.url && <div className="text-gray-500 truncate">{log.url}</div>}
                <div className="text-gray-500 mt-0.5">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-dark/60 mb-3">
          Activity
        </h2>
        <TicketTimeline events={ticket.events} comments={ticket.comments} />
      </section>

      {ticket.status !== 'CLOSED' && (
        <form onSubmit={submitComment} className="border-t border-gray-200 pt-4 space-y-2">
          <label htmlFor="comment-body" className="block text-xs font-semibold uppercase tracking-wider text-brand-dark/60">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={3}
            placeholder={
              canResolve
                ? 'Reply to the user or add an internal note on progress…'
                : 'Add a reply or more context…'
            }
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy resize-y"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!commentBody.trim() || posting}
              className="px-4 py-2 text-sm font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {posting && <Loader2 className="w-4 h-4 animate-spin" />}
              Post comment
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
