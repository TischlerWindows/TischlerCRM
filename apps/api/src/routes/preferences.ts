import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';

export async function preferenceRoutes(app: FastifyInstance) {
  // Get all preferences for current user
  app.get('/user/preferences', async (req, reply) => {
    const userId = (req as any).user?.sub;
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
    const userId = (req as any).user?.sub;
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
    const userId = (req as any).user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { key } = req.params as { key: string };
    const body = req.body as any;

    const pref = await prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: body.value },
      update: { value: body.value },
    });

    reply.send({ key: pref.key, value: pref.value });
  });

  // Delete a preference
  app.delete('/user/preferences/:key', async (req, reply) => {
    const userId = (req as any).user?.sub;
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
    const userId = (req as any).user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const body = req.body as Record<string, any>;

    const results: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
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
