import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const layoutFieldSchema = z.object({
  fieldApiName: z.string(),
  column: z.number(),
  order: z.number(),
});

const layoutSectionSchema = z.object({
  label: z.string(),
  columns: z.number().min(1).max(3),
  order: z.number(),
  fields: z.array(layoutFieldSchema),
});

const layoutTabSchema = z.object({
  label: z.string(),
  order: z.number(),
  sections: z.array(layoutSectionSchema),
});

const createLayoutSchema = z.object({
  objectApiName: z.string(),
  name: z.string().min(1),
  layoutType: z.string(),
  isDefault: z.boolean().optional(),
  tabs: z.array(layoutTabSchema),
});

const updateLayoutSchema = createLayoutSchema.omit({ objectApiName: true }).partial();

export async function layoutRoutes(app: FastifyInstance) {
  // Get all layouts for an object
  app.get('/objects/:apiName/layouts', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: {
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
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    reply.send(object.pageLayouts);
  });

  // Get single layout
  app.get('/layouts/:layoutId', async (req, reply) => {
    const { layoutId } = req.params as { layoutId: string };

    const layout = await prisma.pageLayout.findUnique({
      where: { id: layoutId },
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
    });

    if (!layout) {
      return reply.code(404).send({ error: 'Layout not found' });
    }

    reply.send(layout);
  });

  // Create new layout
  app.post('/objects/:apiName/layouts', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const parsed = createLayoutSchema.safeParse({ ...req.body, objectApiName: apiName });

    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const userId = req.user!.sub;

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: {
        fields: true,
      },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    // Validate all field references before creating
    for (const tab of parsed.data.tabs) {
      for (const section of tab.sections) {
        for (const field of section.fields) {
          const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName);
          if (!fieldDef) {
            return reply.code(400).send({ error: `Field "${field.fieldApiName}" not found on object "${apiName}"` });
          }
        }
      }
    }

    const layout = await prisma.pageLayout.create({
      data: {
        id: generateId('PageLayout'),
        objectId: object.id,
        name: parsed.data.name,
        layoutType: parsed.data.layoutType,
        isDefault: parsed.data.isDefault ?? false,
        createdById: userId,
        modifiedById: userId,
        tabs: {
          create: parsed.data.tabs.map((tab) => ({
            id: generateId('LayoutTab'),
            label: tab.label,
            order: tab.order,
            sections: {
              create: tab.sections.map((section) => ({
                id: generateId('LayoutSection'),
                label: section.label,
                columns: section.columns,
                order: section.order,
                fields: {
                  create: section.fields.map((field) => {
                    const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName)!;
                    return {
                      id: generateId('LayoutField'),
                      fieldId: fieldDef.id,
                      column: field.column,
                      order: field.order,
                    };
                  }),
                },
              })),
            },
          })),
        },
      },
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
    });

    reply.code(201).send(layout);
  });

  // Update layout
  app.put('/layouts/:layoutId', async (req, reply) => {
    const { layoutId } = req.params as { layoutId: string };
    const parsed = updateLayoutSchema.safeParse(req.body);

    if (!parsed.success) {
      return reply.code(400).send(parsed.error.flatten());
    }

    const userId = req.user!.sub;

    const existingLayout = await prisma.pageLayout.findUnique({
      where: { id: layoutId },
      include: {
        object: {
          include: {
            fields: true,
          },
        },
        tabs: {
          include: {
            sections: {
              include: {
                fields: true,
              },
            },
          },
        },
      },
    });

    if (!existingLayout) {
      return reply.code(404).send({ error: 'Layout not found' });
    }

    // Validate all field references before updating
    if (parsed.data.tabs) {
      for (const tab of parsed.data.tabs) {
        for (const section of tab.sections) {
          for (const field of section.fields) {
            const fieldDef = existingLayout.object.fields.find((f) => f.apiName === field.fieldApiName);
            if (!fieldDef) {
              return reply.code(400).send({ error: `Field "${field.fieldApiName}" not found on this object` });
            }
          }
        }
      }
    }

    // Delete existing tabs (cascade will delete sections and fields)
    await prisma.layoutTab.deleteMany({
      where: { layoutId },
    });

    const layout = await prisma.pageLayout.update({
      where: { id: layoutId },
      data: {
        name: parsed.data.name,
        layoutType: parsed.data.layoutType,
        isDefault: parsed.data.isDefault,
        modifiedById: userId,
        ...(parsed.data.tabs && {
          tabs: {
            create: parsed.data.tabs.map((tab) => ({
              id: generateId('LayoutTab'),
              label: tab.label,
              order: tab.order,
              sections: {
                create: tab.sections.map((section) => ({
                  id: generateId('LayoutSection'),
                  label: section.label,
                  columns: section.columns,
                  order: section.order,
                  fields: {
                    create: section.fields.map((field) => {
                      const fieldDef = existingLayout.object.fields.find(
                        (f) => f.apiName === field.fieldApiName
                      )!;
                      return {
                        id: generateId('LayoutField'),
                        fieldId: fieldDef.id,
                        column: field.column,
                        order: field.order,
                      };
                    }),
                  },
                })),
              },
            })),
          },
        }),
      },
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
    });

    reply.send(layout);
  });

  // Delete layout (soft delete)
  app.delete('/layouts/:layoutId', async (req, reply) => {
    const { layoutId } = req.params as { layoutId: string };
    const userId = req.user!.sub;

    await prisma.pageLayout.update({
      where: { id: layoutId },
      data: {
        isActive: false,
        modifiedById: userId,
      },
    });

    reply.code(204).send();
  });
}
