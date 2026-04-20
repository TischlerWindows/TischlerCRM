import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { NOTIFICATION_KINDS, isValidNotificationKind } from '../lib/notifications/kinds.js';
import { DEFAULT_ORG_ID, runNotificationRetentionSweep } from '../lib/notifications/notify.js';
import { subscribeToNotifications } from '../lib/notifications/listen-manager.js';
import { verifyJwt } from '../auth.js';
import { loadEnv } from '../config.js';

const UNREAD_COUNT_CAP = 99;

export async function notificationRoutes(app: FastifyInstance) {
  /* ---------- GET /me/notifications — keyset-paginated list ---------- */
  app.get('/me/notifications', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const querySchema = z.object({
      cursor: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(50).optional(),
      unreadOnly: z.coerce.boolean().optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const limit = parsed.data.limit ?? 20;

    const where: any = { recipientId: userId };
    if (parsed.data.unreadOnly) where.readAt = null;

    // Keyset pagination: cursor is the id of the last item from the prior page.
    if (parsed.data.cursor) {
      const cursorRow = await prisma.notification.findUnique({
        where: { id: parsed.data.cursor },
        select: { createdAt: true, id: true, recipientId: true },
      });
      if (cursorRow && cursorRow.recipientId === userId) {
        where.OR = [
          { createdAt: { lt: cursorRow.createdAt } },
          { createdAt: cursorRow.createdAt, id: { lt: cursorRow.id } },
        ];
      }
    }

    const items = await prisma.notification.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: {
        lastActor: { select: { id: true, name: true, email: true } },
      },
    });

    let nextCursor: string | null = null;
    if (items.length > limit) {
      const next = items.pop();
      if (next) nextCursor = next.id;
    }

    return reply.send({ items, nextCursor });
  });

  /* ---------- GET /me/notifications/unread-count ---------- */
  app.get('/me/notifications/unread-count', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const count = await prisma.notification.count({
      where: { recipientId: userId, readAt: null },
    });
    return reply.send({ count: Math.min(count, UNREAD_COUNT_CAP), hasMore: count > UNREAD_COUNT_CAP });
  });

  /* ---------- POST /me/notifications/:id/read ---------- */
  app.post('/me/notifications/:id/read', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as { id: string };

    const result = await prisma.notification.updateMany({
      where: { id, recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.send({ ok: true, updated: result.count });
  });

  /* ---------- POST /me/notifications/read-all ---------- */
  app.post('/me/notifications/read-all', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const result = await prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return reply.send({ ok: true, updated: result.count });
  });

  /* ---------- GET /me/notifications/stream — SSE ---------- */
  app.get('/me/notifications/stream', async (req, reply) => {
    // Auth: bearer from global hook OR query-param token (EventSource can't
    // set headers). Matches the /places/static-map convention.
    const query = req.query as Record<string, string>;
    let userId = req.user?.sub as string | undefined;
    if (!userId && query.token) {
      try {
        const env = loadEnv();
        const payload = verifyJwt(query.token, env.JWT_SECRET);
        if (payload) userId = payload.sub;
      } catch {
        // fall through to 401
      }
    }
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    // SSE bypasses @fastify/cors because we hijack the raw response; emit the
    // CORS headers manually so browsers accept events from cross-origin pages.
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
    const allowOrigin = (app as any).isAllowedOrigin?.(origin);
    const corsHeaders: Record<string, string> = {};
    if (allowOrigin) {
      corsHeaders['Access-Control-Allow-Origin'] = origin;
      corsHeaders['Vary'] = 'Origin';
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...corsHeaders,
    });
    reply.hijack();

    // Initial comment flushes headers through proxies.
    reply.raw.write(': connected\n\n');

    const unsubscribe = subscribeToNotifications(userId, (payload) => {
      try {
        reply.raw.write(`event: notification\n`);
        reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        // Writing to a closed socket — unsubscribe lazily via close event.
      }
    });

    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': keep-alive\n\n');
      } catch {
        // ignore
      }
    }, 25_000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      try {
        reply.raw.end();
      } catch {
        // ignore
      }
    };
    reply.raw.on('close', cleanup);
    reply.raw.on('error', cleanup);

    // Return a never-resolving promise so Fastify doesn't auto-end the response.
    return new Promise<void>(() => {});
  });

  /* ---------- GET /admin/notification-types ---------- */
  app.get('/admin/notification-types', async (_req, reply) => {
    const settings = await prisma.notificationTypeSetting.findMany({
      where: { orgId: DEFAULT_ORG_ID },
      select: { notificationKind: true, enabled: true },
    });
    const byKind = new Map(settings.map((s) => [s.notificationKind, s.enabled]));

    const items = NOTIFICATION_KINDS.map((k) => ({
      kind: k.kind,
      label: k.label,
      description: k.description,
      category: k.category,
      defaultEnabled: k.defaultEnabled,
      enabled: byKind.get(k.kind) ?? k.defaultEnabled,
    }));
    return reply.send({ items });
  });

  /* ---------- PUT /admin/notification-types/:kind ---------- */
  app.put('/admin/notification-types/:kind', async (req, reply) => {
    const { kind } = req.params as { kind: string };
    if (!isValidNotificationKind(kind)) {
      return reply.code(404).send({ error: 'Unknown notification kind' });
    }
    const schema = z.object({ enabled: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    await prisma.notificationTypeSetting.upsert({
      where: {
        orgId_notificationKind: { orgId: DEFAULT_ORG_ID, notificationKind: kind },
      },
      create: {
        orgId: DEFAULT_ORG_ID,
        notificationKind: kind,
        enabled: parsed.data.enabled,
      },
      update: { enabled: parsed.data.enabled },
    });
    return reply.send({ ok: true, kind, enabled: parsed.data.enabled });
  });

  /* ---------- POST /admin/notifications/cleanup — manual retention sweep ---------- */
  app.post('/admin/notifications/cleanup', async (_req, reply) => {
    const deleted = await runNotificationRetentionSweep();
    return reply.send({ ok: true, deleted });
  });
}
