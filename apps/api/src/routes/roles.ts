import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

const roleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function roleRoutes(app: FastifyInstance) {
  // List all roles with hierarchy
  app.get('/roles', async (req, reply) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    reply.send(roles);
  });

  // Get single role with subordinates
  app.get('/roles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true } },
        children: {
          select: { id: true, name: true, isActive: true },
          orderBy: { name: 'asc' },
        },
        users: {
          select: { id: true, name: true, email: true, isActive: true, title: true },
          orderBy: { name: 'asc' },
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) return reply.code(404).send({ error: 'Role not found' });
    reply.send(role);
  });

  // Create role
  app.post('/roles', async (req, reply) => {
    const parsed = roleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const role = await prisma.role.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        parentId: parsed.data.parentId,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    reply.code(201).send(role);
  });

  // Update role
  app.put('/roles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = roleSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Role not found' });
    if (parsed.data.parentId === id) {
      return reply.code(400).send({ error: 'Role cannot be its own parent' });
    }
    const role = await prisma.role.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    reply.send(role);
  });

  // Delete role
  app.delete('/roles/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Role not found' });
    const userCount = await prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete role: ${userCount} users are assigned. Reassign them first.` });
    }
    await prisma.role.delete({ where: { id } });
    reply.code(204).send();
  });
}
