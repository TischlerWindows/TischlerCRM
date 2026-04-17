'use client';

import {
  MessageSquare,
  CheckCircle2,
  RotateCcw,
  Paperclip,
  AlertTriangle,
  ArrowRight,
  User as UserIcon,
} from 'lucide-react';
import type {
  TicketComment,
  TicketEvent,
  TicketEventType,
  UserRef,
} from '@/lib/tickets-client';

interface TimelineProps {
  events: TicketEvent[];
  comments: TicketComment[];
}

type TimelineItem =
  | { kind: 'event'; event: TicketEvent }
  | { kind: 'comment'; comment: TicketComment };

function actorName(actor: UserRef | null): string {
  if (!actor) return 'System';
  return actor.name ?? actor.email;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function eventIcon(type: TicketEventType) {
  switch (type) {
    case 'COMMENT':
      return <MessageSquare className="w-3.5 h-3.5" />;
    case 'RESOLVED':
      return <CheckCircle2 className="w-3.5 h-3.5" />;
    case 'REOPENED':
      return <RotateCcw className="w-3.5 h-3.5" />;
    case 'ATTACHMENT_ADDED':
      return <Paperclip className="w-3.5 h-3.5" />;
    case 'ERROR_LOG_ATTACHED':
      return <AlertTriangle className="w-3.5 h-3.5" />;
    case 'STATUS_CHANGED':
    case 'PRIORITY_CHANGED':
    case 'CATEGORY_CHANGED':
    case 'ASSIGNED':
      return <ArrowRight className="w-3.5 h-3.5" />;
    case 'CREATED':
    default:
      return <UserIcon className="w-3.5 h-3.5" />;
  }
}

function eventDescription(event: TicketEvent): string {
  const p = (event.payload ?? {}) as Record<string, any>;
  switch (event.type) {
    case 'CREATED':
      return 'opened this ticket';
    case 'STATUS_CHANGED':
      return `changed status from ${p.fromStatus} to ${p.toStatus}`;
    case 'PRIORITY_CHANGED':
      return `changed priority from ${p.from} to ${p.to}`;
    case 'CATEGORY_CHANGED':
      return `changed category from ${p.from} to ${p.to}`;
    case 'ASSIGNED':
      return p.to
        ? `assigned the ticket${p.from ? ' (reassigned)' : ''}`
        : 'unassigned the ticket';
    case 'ATTACHMENT_ADDED':
      return `attached ${p.fileName ?? 'a file'}`;
    case 'ERROR_LOG_ATTACHED':
      return 'linked a client error log';
    case 'RESOLVED':
      return 'marked the ticket as resolved';
    case 'REOPENED':
      return 'reopened the ticket';
    case 'COMMENT':
      return 'commented';
    default:
      return event.type;
  }
}

export function TicketTimeline({ events, comments }: TimelineProps) {
  // Interleave events and comments chronologically. Comments are also
  // surfaced as COMMENT events by the server, so prefer the comment
  // rendering when a COMMENT event points to a known comment id.
  const commentById = new Map(comments.map((c) => [c.id, c]));
  const items: TimelineItem[] = [];
  for (const ev of events) {
    if (ev.type === 'COMMENT') {
      const commentId = (ev.payload as any)?.commentId;
      const comment = commentId ? commentById.get(commentId) : undefined;
      if (comment) {
        items.push({ kind: 'comment', comment });
        continue;
      }
    }
    items.push({ kind: 'event', event: ev });
  }
  items.sort((a, b) => {
    const aDate = a.kind === 'event' ? a.event.createdAt : a.comment.createdAt;
    const bDate = b.kind === 'event' ? b.event.createdAt : b.comment.createdAt;
    return aDate.localeCompare(bDate);
  });

  if (items.length === 0) {
    return <p className="text-sm text-gray-500">No activity yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {items.map((item, idx) => {
        if (item.kind === 'comment') {
          const c = item.comment;
          return (
            <li key={`c-${c.id}-${idx}`} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-navy/10 text-brand-navy flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {(actorName(c.author).charAt(0) || '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-medium text-brand-dark">{actorName(c.author)}</span>
                  <span className="text-xs text-gray-500">{formatDate(c.createdAt)}</span>
                </div>
                <p className="text-sm text-brand-dark/90 mt-1 whitespace-pre-wrap break-words">
                  {c.body}
                </p>
              </div>
            </li>
          );
        }
        const e = item.event;
        return (
          <li key={`e-${e.id}-${idx}`} className="flex gap-3 items-start text-sm">
            <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center flex-shrink-0">
              {eventIcon(e.type)}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <span className="text-brand-dark/80">
                <span className="font-medium text-brand-dark">{actorName(e.actor)}</span>{' '}
                {eventDescription(e)}
              </span>
              <div className="text-xs text-gray-500 mt-0.5">{formatDate(e.createdAt)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
