'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotificationStream } from '@/lib/use-notification-stream';
import { NotificationItem } from './notification-item';

/**
 * The top-nav bell button + dropdown. Replaces the hardcoded stub that used
 * to live inline in app-wrapper.tsx. Owns its own open/close state.
 */
export function BellPanel() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { items, unreadCount, hasMoreUnread, loading, error, markRead, markAllRead } =
    useNotificationStream();

  const badge = unreadCount === 0 ? null : unreadCount > 99 || hasMoreUnread ? '99+' : String(unreadCount);

  const handleItemClick = async (id: string, linkUrl: string) => {
    setOpen(false);
    await markRead(id);
    router.push(linkUrl);
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="p-2 rounded-md hover:bg-white/10 transition-colors relative"
        title="Notifications"
        aria-label={`Notifications${badge ? ` (${badge} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="w-[18px] h-[18px] text-white/80" />
        {badge && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
            {badge}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-[45] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[32rem] flex flex-col">
            <header className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-xs text-brand-navy hover:text-brand-red flex items-center gap-1"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
            </header>

            <div className="overflow-y-auto flex-1">
              {loading && items.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
              ) : error ? (
                <div className="p-4 text-sm text-red-700 bg-red-50 border-y border-red-200">
                  {error}
                </div>
              ) : items.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No notifications yet</p>
                  <p className="text-xs text-gray-400 mt-1">You&apos;re all caught up!</p>
                </div>
              ) : (
                <ul>
                  {items.map((n) => (
                    <li key={n.id}>
                      <NotificationItem
                        notification={n}
                        onClick={() => handleItemClick(n.id, n.linkUrl)}
                        compact
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="border-t border-gray-100 p-2">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="block text-center text-sm text-brand-navy hover:text-brand-red py-1.5"
              >
                View all notifications
              </Link>
            </footer>
          </div>
        </>
      )}
    </div>
  );
}
