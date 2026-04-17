'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationsClient, type NotificationDTO } from './notifications-client';
import { useAuth } from './auth-context';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface UseNotificationStreamResult {
  items: NotificationDTO[];
  unreadCount: number;
  hasMoreUnread: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Subscribes to the server's SSE notification stream and keeps a small local
 * cache of the most recent notifications + the unread badge count. On each
 * SSE event the hook refetches — the event frame is a hint, not the payload.
 */
export function useNotificationStream(): UseNotificationStreamResult {
  const { isAuthenticated, token } = useAuth();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasMoreUnread, setHasMoreUnread] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [list, unread] = await Promise.all([
        notificationsClient.list({ limit: 15 }),
        notificationsClient.unreadCount(),
      ]);
      setItems(list.items);
      setUnreadCount(unread.count);
      setHasMoreUnread(unread.hasMore);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const markRead = useCallback(
    async (id: string) => {
      await notificationsClient.markRead(id);
      // Optimistically mark locally; refresh will reconcile.
      setItems((prev) =>
        prev.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      void refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    await notificationsClient.markAllRead();
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })),
    );
    setUnreadCount(0);
    setHasMoreUnread(false);
    void refresh();
  }, [refresh]);

  // Initial load + on-auth-change
  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setItems([]);
      setUnreadCount(0);
      setHasMoreUnread(false);
    }
  }, [isAuthenticated, refresh]);

  // SSE subscription
  useEffect(() => {
    if (!isAuthenticated || !token) return;
    if (typeof window === 'undefined') return;

    const url = `${API_BASE_URL}/me/notifications/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;

    const onNotification = () => {
      // Frame is a hint; refetch to get the authoritative state.
      void refresh();
    };
    es.addEventListener('notification', onNotification);
    es.onerror = () => {
      // EventSource auto-reconnects with its own backoff. We refetch on the
      // next successful reconnect via the 'open' handler.
    };
    es.onopen = () => {
      void refresh();
    };

    return () => {
      es.removeEventListener('notification', onNotification);
      es.close();
      esRef.current = null;
    };
  }, [isAuthenticated, token, refresh]);

  // Refetch when the tab regains focus — covers laptop-lid-close and mobile
  // backgrounding where SSE may have been silently dropped by the OS.
  useEffect(() => {
    if (!isAuthenticated) return;
    const handler = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [isAuthenticated, refresh]);

  return {
    items,
    unreadCount,
    hasMoreUnread,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
}
