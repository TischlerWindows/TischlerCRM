import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const conditionOpSchema = z.enum([
  '==',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  'IN',
  'INCLUDES',
  'CONTAINS',
  'STARTS_WITH',
]);

const conditionExprSchema = z.object({
  left: z.string(),
  op: conditionOpSchema,
  right: z.any(),
});

const formattingRuleTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('field'), fieldApiName: z.string() }),
  z.object({ kind: z.literal('section'), sectionId: z.string() }),
  z.object({ kind: z.literal('tab'), tabId: z.string() }),
]);

const formattingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  order: z.number(),
  when: z.array(conditionExprSchema),
  target: formattingRuleTargetSchema,
  effects: z.object({
    hidden: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    badge: z.enum(['success', 'warning', 'destructive']).optional(),
    highlightToken: z
      .enum(['none', 'subtle', 'attention', 'positive', 'critical'])
      .optional(),
  }),
});

const fieldPresentationSchema = z
  .object({
    labelBold: z.boolean().optional(),
    labelColorToken: z
      .enum(['default', 'brand', 'muted', 'danger', 'success'])
      .optional(),
  })
  .strict();

const layoutFieldSchema = z.object({
  id: z.string().optional(),
  fieldApiName: z.string(),
  column: z.number(),
  order: z.number(),
  colSpan: z.number().min(1).max(3).optional(),
  rowSpan: z.number().min(1).max(6).optional(),
  presentation: fieldPresentationSchema.optional(),
  hideOnNew: z.boolean().optional(),
  hideOnView: z.boolean().optional(),
  hideOnEdit: z.boolean().optional(),
  // Deprecated — kept for backwards compatibility
  hideOnExisting: z.boolean().optional(),
});

const layoutSectionSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  columns: z.number().min(1).max(3),
  order: z.number(),
  showInRecord: z.boolean().optional(),
  showInTemplate: z.boolean().optional(),
  visibleIf: z.array(conditionExprSchema).optional(),
  description: z.string().max(500).optional().nullable(),
  fields: z.array(layoutFieldSchema),
  hideOnNew: z.boolean().optional(),
  hideOnView: z.boolean().optional(),
  hideOnEdit: z.boolean().optional(),
  // Deprecated — kept for backwards compatibility
  hideOnExisting: z.boolean().optional(),
});

const layoutTabSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  order: z.number(),
  sections: z.array(layoutSectionSchema),
  hideOnNew: z.boolean().optional(),
  hideOnView: z.boolean().optional(),
  hideOnEdit: z.boolean().optional(),
  // Deprecated — kept for backwards compatibility
  hideOnExisting: z.boolean().optional(),
});

const extensionsObjectSchema = z
  .object({
    formattingRules: z.array(formattingRuleSchema).optional(),
    version: z.number().optional(),
  })
  .passthrough();

const createLayoutSchema = z.object({
  objectApiName: z.string(),
  name: z.string().min(1),
  layoutType: z.string(),
  isDefault: z.boolean().optional(),
  tabs: z.array(layoutTabSchema),
  extensions: extensionsObjectSchema.optional(),
  formattingRules: z.array(formattingRuleSchema).optional(),
});

const updateLayoutSchema = createLayoutSchema.omit({ objectApiName: true }).partial();

function buildExtensionsJson(
  extensions?: z.infer<typeof extensionsObjectSchema>,
  formattingRules?: z.infer<typeof formattingRuleSchema>[]
): Prisma.InputJsonValue | undefined {
  const base =
    extensions && typeof extensions === 'object'
      ? ({ ...extensions } as Record<string, unknown>)
      : ({} as Record<string, unknown>);
  if (formattingRules && formattingRules.length > 0) {
    base.formattingRules = formattingRules;
  }
  if (Object.keys(base).length === 0) return undefined;
  return base as Prisma.InputJsonValue;
}

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
            return reply
              .code(400)
              .send({ error: `Field "${field.fieldApiName}" not found on object "${apiName}"` });
          }
        }
      }
    }

    const extensionsJson = buildExtensionsJson(parsed.data.extensions, parsed.data.formattingRules);

    const layout = await prisma.pageLayout.create({
      data: {
        id: generateId('PageLayout'),
        objectId: object.id,
        name: parsed.data.name,
        layoutType: parsed.data.layoutType,
        isDefault: parsed.data.isDefault ?? false,
        createdById: userId,
        modifiedById: userId,
        ...(extensionsJson !== undefined ? { extensions: extensionsJson } : {}),
        tabs: {
          create: parsed.data.tabs.map((tab) => ({
            id: tab.id ?? generateId('LayoutTab'),
            label: tab.label,
            order: tab.order,
            sections: {
              create: tab.sections.map((section) => ({
                id: section.id ?? generateId('LayoutSection'),
                label: section.label,
                columns: section.columns,
                order: section.order,
                showInRecord: section.showInRecord ?? true,
                showInTemplate: section.showInTemplate ?? true,
                ...(section.visibleIf && section.visibleIf.length > 0
                  ? { visibleIf: section.visibleIf as Prisma.InputJsonValue }
                  : {}),
                description: section.description ?? null,
                fields: {
                  create: section.fields.map((field) => {
                    const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName)!;
                    return {
                      id: field.id ?? generateId('LayoutField'),
                      fieldId: fieldDef.id,
                      column: field.column,
                      order: field.order,
                      colSpan: field.colSpan ?? 1,
                      rowSpan: field.rowSpan ?? 1,
                      ...(field.presentation && Object.keys(field.presentation).length > 0
                        ? { presentation: field.presentation as Prisma.InputJsonValue }
                        : {}),
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
              return reply
                .code(400)
                .send({ error: `Field "${field.fieldApiName}" not found on this object` });
            }
          }
        }
      }
    }

    if (parsed.data.tabs) {
      await prisma.layoutTab.deleteMany({
        where: { layoutId },
      });
    }

    const extensionsJson =
      parsed.data.extensions !== undefined || parsed.data.formattingRules !== undefined
        ? buildExtensionsJson(parsed.data.extensions, parsed.data.formattingRules)
        : undefined;

    const layout = await prisma.pageLayout.update({
      where: { id: layoutId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.layoutType !== undefined ? { layoutType: parsed.data.layoutType } : {}),
        ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
        modifiedById: userId,
        ...(extensionsJson !== undefined ? { extensions: extensionsJson } : {}),
        ...(parsed.data.tabs && {
          tabs: {
            create: parsed.data.tabs.map((tab) => ({
              id: tab.id ?? generateId('LayoutTab'),
              label: tab.label,
              order: tab.order,
              sections: {
                create: tab.sections.map((section) => ({
                  id: section.id ?? generateId('LayoutSection'),
                  label: section.label,
                  columns: section.columns,
                  order: section.order,
                  showInRecord: section.showInRecord ?? true,
                  showInTemplate: section.showInTemplate ?? true,
                  ...(section.visibleIf && section.visibleIf.length > 0
                    ? { visibleIf: section.visibleIf as Prisma.InputJsonValue }
                    : {}),
                  description: section.description ?? null,
                  fields: {
                    create: section.fields.map((field) => {
                      const fieldDef = existingLayout.object.fields.find(
                        (f) => f.apiName === field.fieldApiName
                      )!;
                      return {
                        id: field.id ?? generateId('LayoutField'),
                        fieldId: fieldDef.id,
                        column: field.column,
                        order: field.order,
                        colSpan: field.colSpan ?? 1,
                        rowSpan: field.rowSpan ?? 1,
                        ...(field.presentation && Object.keys(field.presentation).length > 0
                          ? { presentation: field.presentation as Prisma.InputJsonValue }
                          : {}),
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
