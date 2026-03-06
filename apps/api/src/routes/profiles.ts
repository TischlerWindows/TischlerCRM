import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

const profileSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  permissions: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  // List all profiles with user count
  app.get('/profiles', async (req, reply) => {
    const profiles = await prisma.profile.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true } },
      },
    });
    reply.send(profiles);
  });

  // Get single profile
  app.get('/profiles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const profile = await prisma.profile.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true } },
        users: {
          select: { id: true, name: true, email: true, isActive: true },
          take: 100,
        },
      },
    });
    if (!profile) return reply.code(404).send({ error: 'Profile not found' });
    reply.send(profile);
  });

  // Create profile
  app.post('/profiles', async (req, reply) => {
    const parsed = profileSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    // Check for duplicate name
    const existing = await prisma.profile.findUnique({ where: { name: parsed.data.name } });
    if (existing) return reply.code(409).send({ error: `A profile named "${parsed.data.name}" already exists` });
    const profile = await prisma.profile.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: parsed.data.permissions || {},
        isActive: parsed.data.isActive ?? true,
      },
    });
    reply.code(201).send(profile);
  });

  // Update profile
  app.put('/profiles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = profileSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Profile not found' });
    // Check for duplicate name if name is being changed
    if (parsed.data.name && parsed.data.name !== existing.name) {
      const dup = await prisma.profile.findUnique({ where: { name: parsed.data.name } });
      if (dup) return reply.code(409).send({ error: `A profile named "${parsed.data.name}" already exists` });
    }
    const profile = await prisma.profile.update({
      where: { id },
      data: parsed.data,
    });
    reply.send(profile);
  });

  // Delete profile (block system profiles)
  app.delete('/profiles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.profile.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Profile not found' });
    if (existing.isSystemProfile) {
      return reply.code(403).send({ error: 'Cannot delete a system profile' });
    }
    // Check if users are assigned
    const userCount = await prisma.user.count({ where: { profileId: id } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete profile: ${userCount} users are assigned to it. Reassign them first.` });
    }
    await prisma.profile.delete({ where: { id } });
    reply.code(204).send();
  });

  // Clone profile
  app.post('/profiles/:id/clone', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { name } = req.body as { name?: string };
    if (!name) return reply.code(400).send({ error: 'name is required for clone' });
    const source = await prisma.profile.findUnique({ where: { id } });
    if (!source) return reply.code(404).send({ error: 'Source profile not found' });
    const clone = await prisma.profile.create({
      data: {
        name,
        description: `Cloned from ${source.name}`,
        permissions: source.permissions as any,
        isSystemProfile: false,
      },
    });
    reply.code(201).send(clone);
  });
}
