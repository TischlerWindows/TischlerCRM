import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { logAudit, extractIp } from '../audit';

const createRoleSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  label: z.string().min(1).max(200).trim(),
  description: z.string().max(1000).optional().nullable(),
  level: z.number().int().min(1).max(99),
  parentId: z.string().uuid().optional().nullable(),
  permissions: z.record(z.any()).optional(),
  visibility: z.record(z.any()).optional(),
}).strict();

const updateRoleSchema = createRoleSchema.partial().strict();
const uuidParam = z.object({ id: z.string().uuid() });

export async function rolesRoutes(app: FastifyInstance) {
  app.get('/admin/roles', async (req, reply) => {
    const roles = await prisma.role.findMany({
      orderBy: [{ level: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true, label: true } },
        children: { select: { id: true, name: true, label: true, level: true } },
        _count: { select: { users: true } },
      },
    });
    reply.send(roles);
  });

  app.get('/admin/roles/:id', async (req, reply) => {
    const paramParsed = uuidParam.safeParse(req.params);
    if (!paramParsed.success) return reply.code(400).send({ error: 'Invalid role ID' });
    const { id } = paramParsed.data;
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, label: true } },
        children: { select: { id: true, name: true, label: true, level: true } },
        users: {
          select: { id: true, name: true, email: true, isActive: true },
          take: 100,
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) return reply.code(404).send({ error: 'Role not found' });
    reply.send(role);
  });

  app.post('/admin/roles', async (req, reply) => {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const existing = await prisma.role.findUnique({ where: { name: parsed.data.name } });
    if (existing) return reply.code(409).send({ error: `A role named "${parsed.data.name}" already exists` });

    const role = await prisma.role.create({
      data: {
        name: parsed.data.name,
        label: parsed.data.label,
        description: parsed.data.description,
        level: parsed.data.level,
        parentId: parsed.data.parentId,
        permissions: parsed.data.permissions || {},
        visibility: parsed.data.visibility || {},
      },
      include: {
        parent: { select: { id: true, name: true, label: true } },
        _count: { select: { users: true } },
      },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'CREATE',
      objectType: 'Role',
      objectId: role.id,
      objectName: role.label,
      after: { name: role.name, label: role.label, level: role.level },
      ipAddress: extractIp(req),
    });

    reply.code(201).send(role);
  });

  app.put('/admin/roles/:id', async (req, reply) => {
    const paramParsed = uuidParam.safeParse(req.params);
    if (!paramParsed.success) return reply.code(400).send({ error: 'Invalid role ID' });
    const { id } = paramParsed.data;
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Validation failed', details: parsed.error.flatten() });

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Role not found' });

    if (parsed.data.name && parsed.data.name !== existing.name) {
      const dup = await prisma.role.findUnique({ where: { name: parsed.data.name } });
      if (dup) return reply.code(409).send({ error: `A role named "${parsed.data.name}" already exists` });
    }

    if (parsed.data.parentId === id) {
      return reply.code(400).send({ error: 'Role cannot be its own parent' });
    }

    const role = await prisma.role.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true, label: true } },
        _count: { select: { users: true } },
      },
    });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'UPDATE',
      objectType: 'Role',
      objectId: role.id,
      objectName: role.label,
      before: { name: existing.name, label: existing.label, level: existing.level },
      after: { name: role.name, label: role.label, level: role.level },
      ipAddress: extractIp(req),
    });

    reply.send(role);
  });

  app.delete('/admin/roles/:id', async (req, reply) => {
    const paramParsed = uuidParam.safeParse(req.params);
    if (!paramParsed.success) return reply.code(400).send({ error: 'Invalid role ID' });
    const { id } = paramParsed.data;
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Role not found' });

    if (existing.isSystem) {
      return reply.code(403).send({ error: 'Cannot delete a system role' });
    }

    const userCount = await prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete role: ${userCount} users are assigned. Reassign them first.` });
    }

    await prisma.role.delete({ where: { id } });

    const actorId = (req as any).user.sub;
    await logAudit({
      actorId,
      action: 'DELETE',
      objectType: 'Role',
      objectId: id,
      objectName: existing.label,
      before: { name: existing.name, label: existing.label, level: existing.level },
      ipAddress: extractIp(req),
    });

    reply.code(204).send();
  });
}
