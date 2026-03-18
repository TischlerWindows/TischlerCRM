import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import { logAudit, extractIp } from '../audit';

const departmentSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional().nullable(),
  parentId: z.string().min(1).optional().nullable(),
  isActive: z.boolean().optional(),
  permissions: z.any().optional(),
});

const idParam = z.object({ id: z.string().min(1) });

export async function departmentRoutes(app: FastifyInstance) {
  app.get('/departments', async (req, reply) => {
    const departments = await prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    reply.send(departments.map((d: any) => ({ ...d, permissions: d.permissions || {} })));
  });

  app.get('/departments/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid department ID' });
    const { id } = pp.data;
    const dept = await prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        users: {
          where: { deletedAt: null },
          select: { id: true, name: true, email: true, isActive: true, title: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { users: true } },
      },
    });
    if (!dept) return reply.code(404).send({ error: 'Department not found' });
    reply.send(dept);
  });

  app.post('/departments', async (req, reply) => {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const dept = await prisma.department.create({
      data: {
        id: generateId('Department'),
        name: parsed.data.name,
        description: parsed.data.description,
        parentId: parsed.data.parentId,
        isActive: parsed.data.isActive ?? true,
        permissions: parsed.data.permissions || {},
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'CREATE',
      objectType: 'Department',
      objectId: dept.id,
      objectName: dept.name,
      after: { name: dept.name, description: dept.description, parentId: dept.parentId },
      ipAddress: extractIp(req),
    });

    reply.code(201).send(dept);
  });

  app.put('/departments/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid department ID' });
    const { id } = pp.data;
    const parsed = departmentSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Department not found' });
    if (parsed.data.parentId === id) {
      return reply.code(400).send({ error: 'Department cannot be its own parent' });
    }

    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) {
        before[key] = (existing as any)[key];
        after[key] = value;
      }
    }

    const dept = await prisma.department.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });

    const actorId = req.user!.sub;
    await logAudit({
      actorId,
      action: 'UPDATE',
      objectType: 'Department',
      objectId: dept.id,
      objectName: dept.name,
      before,
      after,
      ipAddress: extractIp(req),
    });

    reply.send(dept);
  });

  app.delete('/departments/:id', async (req, reply) => {
    const pp = idParam.safeParse(req.params);
    if (!pp.success) return reply.code(400).send({ error: 'Invalid department ID' });
    const { id } = pp.data;
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Department not found' });
    if (existing.deletedAt) return reply.code(400).send({ error: 'Department is already deleted' });

    const userCount = await prisma.user.count({ where: { departmentId: id, deletedAt: null } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete department: ${userCount} users are assigned. Reassign them first.` });
    }

    const actorId = req.user!.sub;
    await prisma.department.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actorId, isActive: false },
    });

    await logAudit({
      actorId,
      action: 'DELETE',
      objectType: 'Department',
      objectId: id,
      objectName: existing.name,
      before: { name: existing.name, description: existing.description, isActive: existing.isActive },
      ipAddress: extractIp(req),
    });

    reply.code(204).send();
  });
}
