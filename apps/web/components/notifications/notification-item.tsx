'use client';

import {
  MessageSquare,
  LifeBuoy,
  UserPlus,
  CheckCircle2,
  ArrowRight,
  Bell,
} from 'lucide-react';
import type { NotificationDTO, NotificationKind } from '@/lib/notifications-client';

function iconForKind(kind: NotificationKind) {
  switch (kind) {
    case 'ticket.created':
      return <LifeBuoy className="w-4 h-4" />;
    case 'ticket.commented':
      return <MessageSquare className="w-4 h-4" />;
    case 'ticket.assigned':
      return <UserPlus className="w-4 h-4" />;
    case 'ticket.resolved':
      return <CheckCircle2 className="w-4 h-4" />;
    case 'ticket.status_changed':
      return <ArrowRight className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function colorForKind(kind: NotificationKind, unread: boolean): string {
  const base = unread ? 'text-brand-navy' : 'text-gray-400';
  return base;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const sec = Math.round(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

interface NotificationItemProps {
  notification: NotificationDTO;
  onClick: () => void;
  compact?: boolean;
}

export function NotificationItem({ notification, onClick, compact }: NotificationItemProps) {
  const unread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 hover:bg-brand-light transition-colors border-b border-gray-100 last:border-b-0 flex gap-3 items-start ${
        unread ? 'bg-blue-50/40' : ''
      }`}
    >
      <div
        className={`mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center ${colorForKind(
          notification.kind,
          unread,
        )}`}
      >
        {iconForKind(notification.kind)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p
            className={`text-sm ${
              unread ? 'text-brand-dark font-medium' : 'text-brand-dark/80'
            } ${compact ? 'line-clamp-2' : ''} break-words`}
          >
            {notification.title}
          </p>
          {unread && (
            <span
              aria-label="Unread"
              className="mt-1.5 flex-shrink-0 w-2 h-2 rounded-full bg-brand-red"
            />
          )}
        </div>
        {notification.body && (
          <p className={`text-xs text-brand-dark/60 mt-0.5 ${compact ? 'line-clamp-2' : ''}`}>
            {notification.body}
          </p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-gray-500">{relativeTime(notification.createdAt)}</span>
          {notification.count > 1 && (
            <span className="text-[10px] font-semibold bg-brand-navy/10 text-brand-navy px-1.5 py-0.5 rounded-full">
              {notification.count} new
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
