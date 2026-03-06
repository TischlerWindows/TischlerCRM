import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

const departmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function departmentRoutes(app: FastifyInstance) {
  // List all departments with hierarchy and user counts
  app.get('/departments', async (req, reply) => {
    const departments = await prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    reply.send(departments);
  });

  // Get single department with members
  app.get('/departments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const dept = await prisma.department.findUnique({
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
    if (!dept) return reply.code(404).send({ error: 'Department not found' });
    reply.send(dept);
  });

  // Create department
  app.post('/departments', async (req, reply) => {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const dept = await prisma.department.create({
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
    reply.code(201).send(dept);
  });

  // Update department
  app.put('/departments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = departmentSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Department not found' });
    // Prevent circular parent reference 
    if (parsed.data.parentId === id) {
      return reply.code(400).send({ error: 'Department cannot be its own parent' });
    }
    const dept = await prisma.department.update({
      where: { id },
      data: parsed.data,
      include: {
        parent: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    });
    reply.send(dept);
  });

  // Delete department
  app.delete('/departments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: 'Department not found' });
    const userCount = await prisma.user.count({ where: { departmentId: id } });
    if (userCount > 0) {
      return reply.code(409).send({ error: `Cannot delete department: ${userCount} users are assigned. Reassign them first.` });
    }
    await prisma.department.delete({ where: { id } });
    reply.code(204).send();
  });
}
