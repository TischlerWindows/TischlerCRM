import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

export async function preferenceRoutes(app: FastifyInstance) {
  // Get all preferences for current user
  app.get('/user/preferences', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    try {
      const prefs = await prisma.userPreference.findMany({
        where: { userId },
      });

      const result: Record<string, any> = {};
      for (const p of prefs) {
        result[p.key] = p.value;
      }
      reply.send(result);
    } catch (err: any) {
      app.log.error(err, 'GET /user/preferences failed');
      reply.code(500).send({ error: 'Failed to load preferences', detail: err?.message });
    }
  });

  // Get a single preference
  app.get('/user/preferences/:key', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { key } = req.params as { key: string };
    const pref = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (!pref) {
      return reply.code(404).send({ error: 'Preference not found' });
    }
    reply.send({ key: pref.key, value: pref.value });
  });

  // Set (upsert) a preference
  app.put('/user/preferences/:key', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { key } = req.params as { key: string };
    const schema = z.object({ value: z.unknown() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Request body must include a "value" field' });

    const pref = await prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: parsed.data.value as any },
      update: { value: parsed.data.value as any },
    });

    reply.send({ key: pref.key, value: pref.value });
  });

  // Delete a preference
  app.delete('/user/preferences/:key', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { key } = req.params as { key: string };
    try {
      await prisma.userPreference.delete({
        where: { userId_key: { userId, key } },
      });
      reply.code(204).send();
    } catch {
      reply.code(404).send({ error: 'Preference not found' });
    }
  });

  // Bulk set preferences (for batch operations)
  app.put('/user/preferences', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return reply.code(400).send({ error: 'Request body must be a JSON object of key-value pairs' });
    }
    const entries = Object.entries(body);
    if (entries.length > 100) {
      return reply.code(400).send({ error: 'Too many preferences in a single request (max 100)' });
    }

    const results: Record<string, any> = {};
    for (const [key, value] of entries) {
      const pref = await prisma.userPreference.upsert({
        where: { userId_key: { userId, key } },
        create: { userId, key, value },
        update: { value },
      });
      results[pref.key] = pref.value;
    }

    reply.send(results);
  });
}
