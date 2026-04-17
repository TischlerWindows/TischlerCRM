'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { ticketsClient, type SupportTicket } from '@/lib/tickets-client';
import { getSessionId } from '@/lib/session-id';
import { getRecentClientErrors, type RecentClientError } from '@/lib/error-reporter';
import { AttachmentsSlot } from './attachments-slot';

interface SubmitTicketModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (ticket: SupportTicket) => void;
}

export function SubmitTicketModal({ open, onClose, onCreated }: SubmitTicketModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [recentErrors, setRecentErrors] = useState<RecentClientError[]>([]);
  const [checkedErrorIds, setCheckedErrorIds] = useState<Set<string>>(new Set());
  const [showErrorsSection, setShowErrorsSection] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessionId = useMemo(() => getSessionId(), []);

  useEffect(() => {
    if (!open) return;
    const ringErrors = getRecentClientErrors().filter((e) => e.id);
    if (ringErrors.length > 0) {
      setRecentErrors(ringErrors);
      setCheckedErrorIds(new Set(ringErrors.map((e) => e.id!).filter(Boolean)));
      return;
    }
    // Ring buffer empty (fresh load after refresh) — fall back to server
    (async () => {
      try {
        const { items } = await ticketsClient.getMyRecentErrors(sessionId, 20);
        const available = items.filter((i) => !i.ticketId);
        const asRecent: RecentClientError[] = available.map((i) => ({
          id: i.id,
          message: i.message,
          url: i.url,
          createdAt: i.createdAt,
          sessionId,
        }));
        setRecentErrors(asRecent);
        setCheckedErrorIds(new Set(available.map((i) => i.id)));
      } catch {
        // Best-effort; modal is still usable without auto-attach
      }
    })();
  }, [open, sessionId]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setTitle('');
      setDescription('');
      setRecentErrors([]);
      setCheckedErrorIds(new Set());
      setShowErrorsSection(true);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const toggleError = (id: string) => {
    setCheckedErrorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ticket = await ticketsClient.create({
        title: title.trim(),
        description: description.trim(),
        sessionId,
        errorLogIds: Array.from(checkedErrorIds),
      });
      onCreated?.(ticket);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit ticket');
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-xl mx-4 max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-dark">Submit a support ticket</h2>
            <p className="text-sm text-brand-dark/60 mt-0.5">
              Describe the problem and we&apos;ll take it from there.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1" htmlFor="ticket-title">
              Title
            </label>
            <input
              id="ticket-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              required
              placeholder="Short summary of the issue"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1" htmlFor="ticket-description">
              Description
            </label>
            <textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              required
              placeholder="What happened? What did you expect instead? Steps to reproduce help a lot."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy resize-y"
            />
          </div>

          {recentErrors.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowErrorsSection((v) => !v)}
                className="flex items-center gap-2 text-sm font-medium text-brand-dark/80 hover:text-brand-dark"
              >
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Attach recent errors from this session ({recentErrors.length})
              </button>
              {showErrorsSection && (
                <ul className="mt-2 space-y-1.5 border border-gray-200 rounded-md p-2 bg-gray-50">
                  {recentErrors.map((err, idx) => {
                    const checkable = !!err.id;
                    const checked = err.id ? checkedErrorIds.has(err.id) : false;
                    return (
                      <li
                        key={err.id ?? `pending-${idx}`}
                        className={`flex items-start gap-2 text-xs ${checkable ? '' : 'opacity-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checkable}
                          onChange={() => err.id && toggleError(err.id)}
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-brand-dark truncate">{err.message}</div>
                          {err.url && (
                            <div className="text-gray-500 truncate">{err.url}</div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brand-dark mb-1">Attachments</label>
            <AttachmentsSlot ticketId={null} folderRef={null} attachments={[]} />
          </div>

          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error}
            </div>
          )}
        </form>

        <div className="border-t border-gray-200 px-6 py-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-brand-dark/80"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="px-4 py-2 text-sm font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy-light transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit ticket
          </button>
        </div>
      </div>
    </div>
  );
}
