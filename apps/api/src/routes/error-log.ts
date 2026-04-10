import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

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
});

/* ------------------------------------------------------------------ */
/*  In-memory ring-buffer (capped at 500 entries)                      */
/* ------------------------------------------------------------------ */

interface ErrorEntry {
  id: string;
  message: string;
  stack?: string;
  source: string;
  url?: string;
  userAgent?: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
  createdAt: string;
}

const MAX_ENTRIES = 500;
const errors: ErrorEntry[] = [];
let nextId = 1;

// Simple per-IP throttle — max 30 error reports per minute
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
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

export async function errorLogRoutes(app: FastifyInstance) {
  // POST /api/error-log — accept client-side error reports
  // Accessible by any authenticated user (they're reporting their own errors)
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
    const entry: ErrorEntry = {
      id: String(nextId++),
      message: data.message,
      stack: data.stack,
      source: data.source,
      url: data.url,
      userAgent: data.userAgent,
      componentStack: data.componentStack,
      metadata: data.metadata,
      userId: req.user?.id,
      userEmail: req.user?.email,
      createdAt: new Date().toISOString(),
    };

    errors.push(entry);
    // Trim to cap
    while (errors.length > MAX_ENTRIES) {
      errors.shift();
    }

    app.log.warn({ errorReport: { message: data.message, url: data.url, user: req.user?.email } }, 'Client error reported');

    return reply.code(201).send({ ok: true });
  });

  // GET /admin/error-log — admin-only, list recent errors
  app.get('/admin/error-log', async (req, reply) => {
    const page = Math.max(1, Number((req.query as any).page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number((req.query as any).pageSize) || 50));
    const source = (req.query as any).source as string | undefined;

    let filtered = errors;
    if (source && (source === 'client' || source === 'server')) {
      filtered = errors.filter((e) => e.source === source);
    }

    // Most recent first
    const sorted = [...filtered].reverse();
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  // DELETE /admin/error-log — admin-only, clear all
  app.delete('/admin/error-log', async (_req, reply) => {
    errors.length = 0;
    return reply.send({ ok: true });
  });
}
