import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const createObjectSchema = z.object({
  apiName: z.string().min(1).regex(/^[A-Z][A-Za-z0-9_]*$/),
  label: z.string().min(1),
  pluralLabel: z.string().min(1),
  description: z.string().optional(),
  enableHistory: z.boolean().optional(),
  enableSearch: z.boolean().optional(),
});

const updateObjectSchema = createObjectSchema.partial();

export async function objectRoutes(app: FastifyInstance) {
  // Get all objects
  app.get('/objects', async (req, reply) => {
    const objects = await prisma.customObject.findMany({
      where: { isActive: true },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            relationship: {
              include: {
                parentObject: true,
                childObject: true,
              },
            },
          },
        },
        pageLayouts: {
          where: { isActive: true },
          include: {
            tabs: {
              include: {
                sections: {
                  include: {
                    fields: {
                      include: {
                        field: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { label: 'asc' },
    });
    reply.send(objects);
  });

  // Get single object by apiName
  app.get('/objects/:apiName', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: {
        fields: {
          where: { isActive: true },
          include: {
            relationship: {
              include: {
                parentObject: true,
                childObject: true,
              },
            },
          },
        },
        pageLayouts: {
          where: { isActive: true },
          include: {
            tabs: {
              include: {
                sections: {
                  include: {
                    fields: {
                      include: {
                        field: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    reply.send(object);
  });

  // Create new object
  app.post('/objects', async (req, reply) => {
    const parsed = createObjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const userId = req.user!.sub;

    const object = await prisma.customObject.create({
      data: {
        id: generateId('CustomObject'),
        apiName: parsed.data.apiName,
        label: parsed.data.label,
        pluralLabel: parsed.data.pluralLabel,
        description: parsed.data.description,
        enableHistory: parsed.data.enableHistory,
        enableSearch: parsed.data.enableSearch,
        createdById: userId,
        modifiedById: userId,
      },
      include: {
        fields: true,
        pageLayouts: true,
      },
    });

    // Auto-grant full permissions on the new object to all "admin" departments
    try {
      const allDepts = await prisma.department.findMany({ select: { id: true, permissions: true } });
      const fullPerms = { read: true, create: true, edit: true, delete: true, viewAll: true, modifyAll: true };
      for (const dept of allDepts) {
        const perms = (dept.permissions as any) || {};
        if (perms.isAdmin) {
          const objPerms = perms.objectPermissions || {};
          objPerms[object.apiName] = fullPerms;
          await prisma.department.update({
            where: { id: dept.id },
            data: { permissions: { ...perms, objectPermissions: objPerms } },
          });
        }
      }
    } catch (err) {
      // Non-critical — don't fail the object creation
      console.error('Failed to auto-grant admin department permissions:', err);
    }

    reply.code(201).send(object);
  });

  // Update object
  app.put('/objects/:apiName', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const parsed = updateObjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const userId = req.user!.sub;

    const object = await prisma.customObject.update({
      where: { apiName },
      data: {
        ...parsed.data,
        modifiedById: userId,
      },
      include: {
        fields: true,
        pageLayouts: true,
      },
    });

    reply.send(object);
  });

  // Delete object (soft delete)
  app.delete('/objects/:apiName', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const userId = req.user!.sub;

    await prisma.customObject.update({
      where: { apiName },
      data: {
        isActive: false,
        modifiedById: userId,
      },
    });

    reply.code(204).send();
  });
}
