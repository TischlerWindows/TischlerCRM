/**
 * Singleton Postgres LISTEN connection + in-process fan-out.
 *
 * Why this exists: notify() calls pg_notify('notifications', <payload>) from
 * whichever API process handled the request. To deliver to SSE clients that
 * might be connected to a different process, we keep one long-lived LISTEN
 * connection per process and fan the notifications out to in-process
 * subscribers keyed by recipientId.
 *
 * The connection is NOT pulled from a pool — pooled clients can be returned
 * and reused, which would drop our LISTEN registration. We use a dedicated
 * pg.Client with exponential-backoff reconnect on errors.
 */

import pg from 'pg';

const CHANNEL = 'notifications';

export interface NotificationBroadcast {
  recipientId: string;
  id: string;
}

type Handler = (payload: NotificationBroadcast) => void;

const subscribers = new Map<string, Set<Handler>>();

let client: pg.Client | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let reconnectDelayMs = 1000;
let shuttingDown = false;

function dispatch(payload: string): void {
  let parsed: NotificationBroadcast | null = null;
  try {
    parsed = JSON.parse(payload) as NotificationBroadcast;
  } catch {
    return;
  }
  if (!parsed?.recipientId || !parsed.id) return;
  const handlers = subscribers.get(parsed.recipientId);
  if (!handlers) return;
  for (const h of handlers) {
    try {
      h(parsed);
    } catch {
      // A misbehaving handler must not kill the rest.
    }
  }
}

async function connect(): Promise<void> {
  if (shuttingDown) return;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('[notifications] DATABASE_URL not set — listen-manager disabled');
    return;
  }

  const next = new pg.Client({ connectionString });
  next.on('notification', (msg) => {
    if (msg.channel !== CHANNEL) return;
    dispatch(msg.payload ?? '');
  });
  next.on('error', (err) => {
    console.error('[notifications] LISTEN client error:', err);
    scheduleReconnect();
  });
  next.on('end', () => {
    if (!shuttingDown) scheduleReconnect();
  });

  try {
    await next.connect();
    await next.query(`LISTEN ${CHANNEL}`);
    client = next;
    reconnectDelayMs = 1000; // reset backoff after a successful connect
    console.log('[notifications] LISTEN connection established');
  } catch (err) {
    console.error('[notifications] LISTEN connect failed:', err);
    try {
      await next.end();
    } catch {
      // ignore
    }
    scheduleReconnect();
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer || shuttingDown) return;
  const delay = Math.min(reconnectDelayMs, 30_000);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, 30_000);
    if (client) {
      try {
        await client.end();
      } catch {
        // ignore
      }
      client = null;
    }
    await connect();
  }, delay);
}

export async function initNotificationListener(): Promise<void> {
  await connect();
}

export async function shutdownNotificationListener(): Promise<void> {
  shuttingDown = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (client) {
    try {
      await client.end();
    } catch {
      // ignore
    }
    client = null;
  }
}

export function subscribeToNotifications(recipientId: string, handler: Handler): () => void {
  let set = subscribers.get(recipientId);
  if (!set) {
    set = new Set();
    subscribers.set(recipientId, set);
  }
  set.add(handler);
  return () => {
    const s = subscribers.get(recipientId);
    if (!s) return;
    s.delete(handler);
    if (s.size === 0) subscribers.delete(recipientId);
  };
}
