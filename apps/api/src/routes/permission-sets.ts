import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

const permSetSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  permissions: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

export async function permissionSetRoutes(app: FastifyInstance) {
  // List all permission sets
  app.get('/permission-sets', async (req, reply) => {
    const sets = await prisma.permissionSet.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { assignments: true } },
      },
    });
    reply.send(sets);
  });

  // Get single permission set with assignments
  app.get('/permission-sets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ps = await prisma.permissionSet.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, name: true, email: true, isActive: true } },
          },
        },
        _count: { select: { assignments: true } },
      },
    });
    if (!ps) return reply.code(404).send({ error: 'Permission set not found' });
    reply.send(ps);
  });

  // Create permission set
  app.post('/permission-sets', async (req, reply) => {
    const parsed = permSetSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const ps = await prisma.permissionSet.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        permissions: parsed.data.permissions || {},
        isActive: parsed.data.isActive ?? true,
      },
    });
    reply.code(201).send(ps);
  });

  // Update permission set
  app.put('/permission-sets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = permSetSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.permissionSet.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Permission set not found' });
    const ps = await prisma.permissionSet.update({
      where: { id },
      data: parsed.data,
    });
    reply.send(ps);
  });

  // Delete permission set
  app.delete('/permission-sets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.permissionSet.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Permission set not found' });
    await prisma.permissionSet.delete({ where: { id } });
    reply.code(204).send();
  });

  // Assign permission set to user(s)
  app.post('/permission-sets/:id/assign', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { userIds } = req.body as { userIds?: string[] };
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return reply.code(400).send({ error: 'userIds array is required' });
    }
    const existing = await prisma.permissionSet.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Permission set not found' });
    const results = await Promise.allSettled(
      userIds.map((userId) =>
        prisma.permissionSetAssignment.upsert({
          where: { userId_permissionSetId: { userId, permissionSetId: id } },
          create: { userId, permissionSetId: id },
          update: {},
        })
      )
    );
    const created = results.filter((r) => r.status === 'fulfilled').length;
    reply.send({ assigned: created, total: userIds.length });
  });

  // Remove user assignment
  app.delete('/permission-sets/:id/assign/:userId', async (req, reply) => {
    const { id, userId } = req.params as { id: string; userId: string };
    try {
      await prisma.permissionSetAssignment.delete({
        where: { userId_permissionSetId: { userId, permissionSetId: id } },
      });
      reply.code(204).send();
    } catch {
      reply.code(404).send({ error: 'Assignment not found' });
    }
  });
}
