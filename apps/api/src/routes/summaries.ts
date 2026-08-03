import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

/**
 * Estimating Summaries live as a single flat array in the `summaries` Setting
 * key (see apps/web/app/summary/page.tsx) rather than as generic Records.
 * Saving used to be a client-side "fetch whole array, edit one entry,
 * PUT the whole array back" via /settings/summaries — a classic read-modify
 * -write race: if two people have the page open, whoever PUTs last wins and
 * silently discards the other person's save (even to a DIFFERENT summary).
 *
 * These routes fix that by doing the read-modify-write to a single summary
 * atomically inside one DB transaction, and add a short-lived edit lock so
 * only one person can have a given summary open for editing at a time.
 */

const LOCK_TTL_MS = 3 * 60 * 1000; // 3 minutes; frontend heartbeats every ~60s while open

function isLockActive(lock: { userId: string; lockedAt: string } | undefined, now: number): boolean {
  if (!lock) return false;
  return now - new Date(lock.lockedAt).getTime() < LOCK_TTL_MS;
}

export async function summaryRoutes(app: FastifyInstance) {
  // ── Upsert a single summary atomically ──────────────────────────────
  app.put('/summaries/:id', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { id } = req.params as { id: string };
    const schema = z.object({ value: z.record(z.unknown()) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Request body must include a "value" object' });
    if ((parsed.data.value as any).id !== id) {
      return reply.code(400).send({ error: 'Body "value.id" must match the :id route param' });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.setting.findUnique({ where: { key: 'summaries' } });
        const arr: any[] = Array.isArray(row?.value) ? (row!.value as any[]) : [];
        const idx = arr.findIndex((s) => s?.id === id);
        if (idx >= 0) arr[idx] = parsed.data.value;
        else arr.unshift(parsed.data.value);

        await tx.setting.upsert({
          where: { key: 'summaries' },
          create: { id: generateId('Setting'), key: 'summaries', value: arr as any },
          update: { value: arr as any },
        });
        return arr;
      });
      reply.send({ ok: true, count: updated.length });
    } catch (err: any) {
      app.log.error(err, 'PUT /summaries/:id failed');
      reply.code(500).send({ error: 'Failed to save summary', detail: err?.message });
    }
  });

  // ── Delete a single summary atomically ───────────────────────────────
  app.delete('/summaries/:id', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { id } = req.params as { id: string };
    try {
      await prisma.$transaction(async (tx) => {
        const row = await tx.setting.findUnique({ where: { key: 'summaries' } });
        const arr: any[] = Array.isArray(row?.value) ? (row!.value as any[]) : [];
        const next = arr.filter((s) => s?.id !== id);
        await tx.setting.upsert({
          where: { key: 'summaries' },
          create: { id: generateId('Setting'), key: 'summaries', value: next as any },
          update: { value: next as any },
        });

        const lockRow = await tx.setting.findUnique({ where: { key: 'summary-locks' } });
        const locks: Record<string, unknown> = (lockRow?.value as any) || {};
        if (id in locks) {
          delete locks[id];
          await tx.setting.upsert({
            where: { key: 'summary-locks' },
            create: { id: generateId('Setting'), key: 'summary-locks', value: locks as any },
            update: { value: locks as any },
          });
        }
      });
      reply.code(204).send();
    } catch (err: any) {
      app.log.error(err, 'DELETE /summaries/:id failed');
      reply.code(500).send({ error: 'Failed to delete summary', detail: err?.message });
    }
  });

  // ── Acquire (or renew) the edit lock for a summary ───────────────────
  app.post('/summaries/:id/lock', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as { id: string };

    try {
      const result = await prisma.$transaction(async (tx) => {
        const row = await tx.setting.findUnique({ where: { key: 'summary-locks' } });
        const locks: Record<string, { userId: string; userName: string; lockedAt: string }> = (row?.value as any) || {};
        const now = Date.now();
        const existing = locks[id];

        if (existing && existing.userId !== userId && isLockActive(existing, now)) {
          return { ok: false as const, lockedBy: existing };
        }

        const me = await tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        locks[id] = { userId, userName: me?.name || me?.email || 'Someone', lockedAt: new Date().toISOString() };
        await tx.setting.upsert({
          where: { key: 'summary-locks' },
          create: { id: generateId('Setting'), key: 'summary-locks', value: locks as any },
          update: { value: locks as any },
        });
        return { ok: true as const };
      });

      if (!result.ok) {
        // apiClient only preserves the "error" string on thrown errors (not
        // the full JSON body), so bake the human-readable message in here.
        return reply.code(409).send({
          error: `This summary is currently being edited by ${result.lockedBy.userName}. Please try again in a few minutes.`,
          lockedBy: result.lockedBy,
        });
      }
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'POST /summaries/:id/lock failed');
      reply.code(500).send({ error: 'Failed to acquire lock', detail: err?.message });
    }
  });

  // ── Release the edit lock (only the current holder can release it) ──
  app.post('/summaries/:id/unlock', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });
    const { id } = req.params as { id: string };

    try {
      await prisma.$transaction(async (tx) => {
        const row = await tx.setting.findUnique({ where: { key: 'summary-locks' } });
        const locks: Record<string, { userId: string; lockedAt: string }> = (row?.value as any) || {};
        if (locks[id]?.userId === userId) {
          delete locks[id];
          await tx.setting.upsert({
            where: { key: 'summary-locks' },
            create: { id: generateId('Setting'), key: 'summary-locks', value: locks as any },
            update: { value: locks as any },
          });
        }
      });
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'POST /summaries/:id/unlock failed');
      reply.code(500).send({ error: 'Failed to release lock', detail: err?.message });
    }
  });
}
