import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

export async function settingRoutes(app: FastifyInstance) {
  // Get all settings
  app.get('/settings', async (_req, reply) => {
    try {
      const settings = await prisma.setting.findMany();
      const result: Record<string, any> = {};
      for (const s of settings) {
        result[s.key] = s.value;
      }
      reply.send(result);
    } catch (err: any) {
      app.log.error(err, 'GET /settings failed');
      reply.code(500).send({ error: 'Failed to load settings', detail: err?.message });
    }
  });

  // Get a single setting by key
  app.get('/settings/:key', async (req, reply) => {
    try {
      const { key } = req.params as { key: string };
      const setting = await prisma.setting.findUnique({ where: { key } });
      if (!setting) {
        return reply.code(404).send({ error: 'Setting not found' });
      }
      reply.send({ key: setting.key, value: setting.value });
    } catch (err: any) {
      app.log.error(err, 'GET /settings/:key failed');
      reply.code(500).send({ error: 'Failed to load setting', detail: err?.message });
    }
  });

  // Set (upsert) a setting
  app.put('/settings/:key', async (req, reply) => {
    try {
      const { key } = req.params as { key: string };
      const schema = z.object({ value: z.unknown() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: 'Request body must include a "value" field' });

      const setting = await prisma.setting.upsert({
        where: { key },
        create: { id: generateId('Setting'), key, value: parsed.data.value as any },
        update: { value: parsed.data.value as any },
      });

      reply.send({ key: setting.key, value: setting.value });
    } catch (err: any) {
      app.log.error(err, 'PUT /settings/:key failed');
      reply.code(500).send({ error: 'Failed to save setting', detail: err?.message });
    }
  });

  // Delete a setting
  app.delete('/settings/:key', async (req, reply) => {
    const { key } = req.params as { key: string };
    try {
      await prisma.setting.delete({ where: { key } });
      reply.code(204).send();
    } catch {
      reply.code(404).send({ error: 'Setting not found' });
    }
  });
}
