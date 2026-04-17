'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Loader2, CheckCheck } from 'lucide-react';
import {
  notificationsClient,
  type NotificationDTO,
} from '@/lib/notifications-client';
import { NotificationItem } from '@/components/notifications/notification-item';

type Filter = 'all' | 'unread';

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);
      try {
        const res = await notificationsClient.list({
          cursor: reset ? undefined : cursor ?? undefined,
          limit: 50,
          unreadOnly: filter === 'unread',
        });
        setItems((prev) => (reset ? res.items : [...prev, ...res.items]));
        setCursor(res.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load notifications');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [cursor, filter],
  );

  useEffect(() => {
    setCursor(null);
    void load(true);
    // Reload when filter changes; `load` depends on cursor which we reset first
    // so this is safe — the reset flag re-fetches from the top.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const handleClick = async (n: NotificationDTO) => {
    try {
      if (!n.readAt) await notificationsClient.markRead(n.id);
    } finally {
      router.push(n.linkUrl);
    }
  };

  const handleMarkAll = async () => {
    await notificationsClient.markAllRead();
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-brand-dark">Notifications</h1>
          <p className="text-sm text-brand-dark/60 mt-1">Everything you&apos;ve been pinged about.</p>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          className="flex items-center gap-1.5 text-sm text-brand-navy hover:text-brand-red"
        >
          <CheckCheck className="w-4 h-4" />
          Mark all read
        </button>
      </header>

      <div className="mb-4 flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-gray hover:text-brand-dark'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'unread' ? 'bg-white text-brand-dark shadow-sm' : 'text-brand-gray hover:text-brand-dark'
          }`}
        >
          Unread only
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading…
        </div>
      ) : error ? (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-sm font-medium text-brand-dark/80">No notifications</p>
          <p className="text-xs text-gray-500 mt-1">
            {filter === 'unread' ? "You're all caught up!" : 'Nothing has pinged you yet.'}
          </p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <NotificationItem notification={n} onClick={() => handleClick(n)} />
              </li>
            ))}
          </ul>
          {cursor && (
            <div className="p-3 border-t border-gray-100 flex justify-center">
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => void load(false)}
                className="text-sm text-brand-navy hover:text-brand-red disabled:opacity-60 flex items-center gap-2"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
