import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import crypto from 'crypto';

/* ------------------------------------------------------------------ */
/*  Schema                                                             */
/* ------------------------------------------------------------------ */

const errorBodySchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(8000).optional(),
  source: z.enum(['client', 'server']).default('client'),
  url: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
  componentStack: z.string().max(4000).optional(),
  metadata: z.record(z.unknown()).optional(),
  sessionId: z.string().max(128).optional(),
});

/* ------------------------------------------------------------------ */
/*  Per-IP throttle (in-memory — acceptable per-process)               */
/* ------------------------------------------------------------------ */

const throttle = new Map<string, { count: number; resetAt: number }>();
const THROTTLE_WINDOW = 60_000;
const THROTTLE_MAX = 30;

function isThrottled(ip: string): boolean {
  const now = Date.now();
  const entry = throttle.get(ip);
  if (!entry || now > entry.resetAt) {
    throttle.set(ip, { count: 1, resetAt: now + THROTTLE_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > THROTTLE_MAX;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function retentionCutoff(): Date {
  const days = Number(process.env.ERROR_LOG_RETENTION_DAYS ?? 30);
  const validDays = Number.isFinite(days) && days > 0 ? days : 30;
  return new Date(Date.now() - validDays * 86_400_000);
}

async function sweepExpiredLogs(): Promise<number> {
  const cutoff = retentionCutoff();
  const result = await prisma.errorLog.deleteMany({
    where: { createdAt: { lt: cutoff }, ticketId: null },
  });
  return result.count;
}

function computeDedupeKey(message: string, url?: string): string {
  return crypto
    .createHash('sha1')
    .update(`${message}::${url ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

export async function errorLogRoutes(app: FastifyInstance) {
  // POST /api/error-log — accept client-side error reports
  app.post('/api/error-log', async (req, reply) => {
    const ip = req.ip || 'unknown';
    if (isThrottled(ip)) {
      return reply.code(429).send({ error: 'Too many error reports' });
    }

    const parsed = errorBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid error payload' });
    }

    const data = parsed.data;
    const userId = req.user?.sub ?? null;
    const dedupeKey = computeDedupeKey(data.message, data.url);

    // Dedupe: skip insert if same key+owner within 60s
    const sinceCutoff = new Date(Date.now() - 60_000);
    const existing = await prisma.errorLog.findFirst({
      where: {
        dedupeKey,
        createdAt: { gte: sinceCutoff },
        ...(userId ? { userId } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      return reply.code(200).send({ ok: true, id: existing.id, deduped: true });
    }

    let userEmail: string | null = null;
    if (userId) {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      userEmail = u?.email ?? null;
    }

    const created = await prisma.errorLog.create({
      data: {
        id: generateId('ErrorLog'),
        message: data.message,
        stack: data.stack,
        source: data.source,
        url: data.url,
        userAgent: data.userAgent,
        componentStack: data.componentStack,
        metadata: (data.metadata ?? null) as any,
        userId,
        userEmail,
        sessionId: data.sessionId ?? null,
        dedupeKey,
      },
      select: { id: true },
    });

    app.log.warn(
      { errorReport: { id: created.id, message: data.message, url: data.url, user: userEmail } },
      'Client error reported',
    );

    // Probabilistic retention sweep — ~1% of writes
    if (Math.random() < 0.01) {
      sweepExpiredLogs().catch((err) => app.log.error({ err }, 'ErrorLog retention sweep failed'));
    }

    return reply.code(201).send({ ok: true, id: created.id });
  });

  // GET /admin/error-log — admin-only, list recent errors (now from DB)
  app.get('/admin/error-log', async (req, reply) => {
    const page = Math.max(1, Number((req.query as any).page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any).pageSize) || 50));
    const source = (req.query as any).source as string | undefined;

    const where: Record<string, unknown> = {};
    if (source === 'client' || source === 'server') where.source = source;

    const [total, items] = await Promise.all([
      prisma.errorLog.count({ where }),
      prisma.errorLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  // DELETE /admin/error-log — admin-only, clear all unattached logs
  app.delete('/admin/error-log', async (_req, reply) => {
    const result = await prisma.errorLog.deleteMany({ where: { ticketId: null } });
    return reply.send({ ok: true, deleted: result.count });
  });

  // POST /admin/error-log/cleanup — run retention sweep synchronously
  app.post('/admin/error-log/cleanup', async (_req, reply) => {
    const deleted = await sweepExpiredLogs();
    return reply.send({ ok: true, deleted });
  });

  // GET /me/error-log/recent — caller's own recent errors, for the ticket modal
  app.get('/me/error-log/recent', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const querySchema = z.object({
      sessionId: z.string().max(128).optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid query' });

    const limit = parsed.data.limit ?? 20;
    const where: Record<string, unknown> = parsed.data.sessionId
      ? { OR: [{ sessionId: parsed.data.sessionId }, { userId }] }
      : { userId };

    const items = await prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        message: true,
        url: true,
        createdAt: true,
        ticketId: true,
      },
    });
    return reply.send({ items });
  });
}
