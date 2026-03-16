import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { logAudit, extractIp } from '../audit';

const uuidParam = z.object({ id: z.string().uuid() });

export async function recycleBinRoutes(app: FastifyInstance) {
  app.get('/admin/recycle-bin', async (req, reply) => {
    const [deletedUsers, deletedDepartments] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          deletedAt: true,
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.department.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          deletedAt: true,
          deletedBy: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    reply.send({ users: deletedUsers, departments: deletedDepartments });
  });

  app.post('/admin/recycle-bin/users/:id/restore', async (req, reply) => {
    const parsed = uuidParam.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid user ID' });

    const user = await prisma.user.findUnique({ where: { id: parsed.data.id } });
    if (!user) return reply.code(404).send({ error: 'User not found' });
    if (!user.deletedAt) return reply.code(400).send({ error: 'User is not deleted' });

    const restored = await prisma.user.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null, isActive: true },
      select: { id: true, name: true, email: true, isActive: true },
    });

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'RESTORE',
      objectType: 'User',
      objectId: restored.id,
      objectName: restored.name || restored.email,
      ipAddress: extractIp(req),
    });

    reply.send(restored);
  });

  app.post('/admin/recycle-bin/departments/:id/restore', async (req, reply) => {
    const parsed = uuidParam.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid department ID' });

    const dept = await prisma.department.findUnique({ where: { id: parsed.data.id } });
    if (!dept) return reply.code(404).send({ error: 'Department not found' });
    if (!dept.deletedAt) return reply.code(400).send({ error: 'Department is not deleted' });

    const restored = await prisma.department.update({
      where: { id: parsed.data.id },
      data: { deletedAt: null, deletedById: null, isActive: true },
      select: { id: true, name: true },
    });

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'RESTORE',
      objectType: 'Department',
      objectId: restored.id,
      objectName: restored.name,
      ipAddress: extractIp(req),
    });

    reply.send(restored);
  });
}
