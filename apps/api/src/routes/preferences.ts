import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const hourlyPayratesSchema = z.array(z.object({
  year: z.number().int().min(2000).max(2030),
  hourlyRate: z.number().finite().nonnegative().max(1_000_000),
}).strict()).max(200).superRefine((payrates, context) => {
  const years = new Set<number>();
  payrates.forEach((payrate, index) => {
    if (years.has(payrate.year)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [index, 'year'], message: 'Year must be unique' });
    }
    years.add(payrate.year);
  });
});
const profilePictureSchema = z.string()
  .max(1_000_000)
  .regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/);

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
      create: { id: generateId('UserPreference'), userId, key, value: parsed.data.value as any },
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
        create: { id: generateId('UserPreference'), userId, key, value },
        update: { value },
      });
      results[pref.key] = pref.value;
    }

    reply.send(results);
  });

  // Admin: set a preference for any user
  app.put('/admin/users/:userId/preferences/:key', async (req, reply) => {
    const adminId = (req as any).user?.sub;
    if (!adminId) return reply.code(401).send({ error: 'Unauthorized' });

    const requester = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (requester?.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin access required' });

    const { userId, key } = req.params as { userId: string; key: string };
    if (!userId || !key) return reply.code(400).send({ error: 'userId and key are required' });

    const schema = z.object({ value: z.unknown() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Request body must include a "value" field' });

    const pref = await prisma.userPreference.upsert({
      where: { userId_key: { userId, key } },
      create: { id: generateId('UserPreference'), userId, key, value: parsed.data.value as any },
      update: { value: parsed.data.value as any },
    });

    reply.send({ key: pref.key, value: pref.value });
  });

  app.get('/admin/users/:userId/hourly-payrates', async (req, reply) => {
    const adminId = (req as any).user?.sub;
    if (!adminId) return reply.code(401).send({ error: 'Unauthorized' });

    const requester = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (requester?.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin access required' });

    const { userId } = req.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) return reply.code(404).send({ error: 'User not found' });

    const preference = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key: 'hourlyPayrates' } },
    });
    const parsed = hourlyPayratesSchema.safeParse(preference?.value ?? []);
    return reply.send({ payrates: parsed.success ? parsed.data : [] });
  });

  app.put('/admin/users/:userId/hourly-payrates', async (req, reply) => {
    const adminId = (req as any).user?.sub;
    if (!adminId) return reply.code(401).send({ error: 'Unauthorized' });

    const requester = await prisma.user.findUnique({ where: { id: adminId }, select: { role: true } });
    if (requester?.role !== 'ADMIN') return reply.code(403).send({ error: 'Admin access required' });

    const { userId } = req.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) return reply.code(404).send({ error: 'User not found' });

    const parsed = z.object({ payrates: hourlyPayratesSchema }).strict().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid hourly payrates', details: parsed.error.flatten() });

    const preference = await prisma.userPreference.upsert({
      where: { userId_key: { userId, key: 'hourlyPayrates' } },
      create: {
        id: generateId('UserPreference'),
        userId,
        key: 'hourlyPayrates',
        value: parsed.data.payrates,
      },
      update: { value: parsed.data.payrates },
    });
    const saved = hourlyPayratesSchema.safeParse(preference.value);
    return reply.send({ payrates: saved.success ? saved.data : [] });
  });

  app.get('/admin/users/:userId/profile-picture', async (req, reply) => {
    const requesterId = (req as any).user?.sub;
    if (!requesterId) return reply.code(401).send({ error: 'Unauthorized' });

    const { userId } = req.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) return reply.code(404).send({ error: 'User not found' });

    const preference = await prisma.userPreference.findUnique({
      where: { userId_key: { userId, key: 'profilePicture' } },
    });
    const picture = typeof preference?.value === 'string' && profilePictureSchema.safeParse(preference.value).success
      ? preference.value
      : null;
    return reply.send({ picture });
  });

  app.put('/admin/users/:userId/profile-picture', async (req, reply) => {
    const requesterId = (req as any).user?.sub;
    if (!requesterId) return reply.code(401).send({ error: 'Unauthorized' });

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, profile: { select: { permissions: true } } },
    });
    const permissions = requester?.profile?.permissions as { app?: { manageUsers?: boolean } } | null;
    const canManageUsers = requester?.role === 'ADMIN' || permissions?.app?.manageUsers === true;

    const { userId } = req.params as { userId: string };
    const targetUser = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) return reply.code(404).send({ error: 'User not found' });
    if (!canManageUsers && requesterId !== userId) return reply.code(403).send({ error: 'User picture edit denied' });

    const parsed = z.object({ picture: profilePictureSchema.nullable() }).strict().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid profile picture', details: parsed.error.flatten() });

    if (parsed.data.picture === null) {
      await prisma.userPreference.deleteMany({ where: { userId, key: 'profilePicture' } });
      return reply.send({ picture: null });
    }

    await prisma.userPreference.upsert({
      where: { userId_key: { userId, key: 'profilePicture' } },
      create: {
        id: generateId('UserPreference'),
        userId,
        key: 'profilePicture',
        value: parsed.data.picture,
      },
      update: { value: parsed.data.picture },
    });
    return reply.send({ picture: parsed.data.picture });
  });

  app.get('/admin/users/profile-pictures', async (req, reply) => {
    const requesterId = (req as any).user?.sub;
    if (!requesterId) return reply.code(401).send({ error: 'Unauthorized' });

    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true, profile: { select: { permissions: true } } },
    });
    const appPermissions = requester?.profile?.permissions as { app?: { manageUsers?: boolean; viewAllUsers?: boolean } } | null;
    const canViewUsers = requester?.role === 'ADMIN'
      || appPermissions?.app?.manageUsers === true
      || appPermissions?.app?.viewAllUsers === true;
    if (!canViewUsers) return reply.code(403).send({ error: 'User list access required' });

    const query = z.object({ ids: z.string().min(1).max(20_000) }).safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: 'Provide user IDs to look up' });
    const userIds = [...new Set(query.data.ids.split(',').filter(Boolean))];
    if (userIds.length === 0 || userIds.length > 200) {
      return reply.code(400).send({ error: 'Request between 1 and 200 user IDs' });
    }

    const preferences = await prisma.userPreference.findMany({
      where: { userId: { in: userIds }, key: 'profilePicture' },
      select: { userId: true, value: true },
    });
    const pictures = Object.fromEntries(preferences.flatMap(preference => (
      typeof preference.value === 'string' && profilePictureSchema.safeParse(preference.value).success
        ? [[preference.userId, preference.value]]
        : []
    )));
    return reply.send({ pictures });
  });
}
