import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

// Keys that non-ADMIN users are allowed to read. Everything else in the settings
// table may contain integration config, branding internals, or feature flags that
// should not be exposed to every authenticated employee. Admins receive the full
// bag; non-admins receive only the keys below.
//
// Derived from a grep of apps/web for getSetting(...) / loadAllSettings() callers
// on 2026-04-22. If a new non-admin page starts reading a setting, add its key
// here (and prefer moving it to a dedicated endpoint if it's user-specific).
const PUBLIC_SETTING_KEYS = new Set<string>([
  'tabConfiguration',
  'customReports',
  'dashboards',
  'tempReport',
  'summaries',
  'homeLayoutTemplates',
  'tces-object-manager-schema',
  'tces-object-manager-versions',
]);

export async function settingRoutes(app: FastifyInstance) {
  // Get all settings. Admins receive the full settings bag; non-admins only see
  // keys on the PUBLIC_SETTING_KEYS allowlist so that sensitive config is not
  // leaked to every authenticated user.
  app.get('/settings', async (req, reply) => {
    try {
      const isAdmin = req.user?.role === 'ADMIN';
      const settings = await prisma.setting.findMany();
      const result: Record<string, any> = {};
      for (const s of settings) {
        if (isAdmin || PUBLIC_SETTING_KEYS.has(s.key)) {
          result[s.key] = s.value;
        }
      }
      reply.send(result);
    } catch (err: any) {
      app.log.error(err, 'GET /settings failed');
      reply.code(500).send({ error: 'Failed to load settings', detail: err?.message });
    }
  });

  // Get a single setting by key. Non-admins may only read keys on the allowlist;
  // any other key returns 403 regardless of whether the row exists, so we don't
  // leak which non-public keys are configured.
  app.get('/settings/:key', async (req, reply) => {
    try {
      const { key } = req.params as { key: string };
      const isAdmin = req.user?.role === 'ADMIN';
      if (!isAdmin && !PUBLIC_SETTING_KEYS.has(key)) {
        return reply.code(403).send({ error: 'Insufficient permissions.' });
      }
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

  // Set (upsert) a setting (admin only)
  app.put('/settings/:key', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
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

  // Delete a setting (admin only)
  app.delete('/settings/:key', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { key } = req.params as { key: string };
    try {
      await prisma.setting.delete({ where: { key } });
      reply.code(204).send();
    } catch {
      reply.code(404).send({ error: 'Setting not found' });
    }
  });
}
