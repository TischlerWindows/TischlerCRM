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

const LAYOUT_EDITOR_LOCK_KEY = 'page-layout-editor-locks';
const LAYOUT_EDITOR_LOCK_TTL_MS = 90_000;

interface LayoutEditorLock {
  userId: string;
  sessionId: string;
  userName: string;
  lockedAt: string;
}

function readLayoutEditorLocks(value: unknown): Record<string, LayoutEditorLock> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, LayoutEditorLock>;
}

function isLayoutEditorLockActive(lock: LayoutEditorLock | undefined, now: number): boolean {
  if (!lock) return false;
  const lockedAt = Date.parse(lock.lockedAt);
  return Number.isFinite(lockedAt) && now - lockedAt < LAYOUT_EDITOR_LOCK_TTL_MS;
}

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
  app.post('/layouts/:layoutId/lock', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { layoutId } = req.params as { layoutId: string };
    const parsed = z.object({ sessionId: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'A valid editor sessionId is required' });

    try {
      const result = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${LAYOUT_EDITOR_LOCK_KEY}), hashtext(${layoutId}))`;

        const setting = await tx.setting.findUnique({ where: { key: LAYOUT_EDITOR_LOCK_KEY } });
        const locks = readLayoutEditorLocks(setting?.value);
        const existing = locks[layoutId];
        const now = Date.now();
        const sameSession = existing?.userId === userId && existing.sessionId === parsed.data.sessionId;
        if (existing && !sameSession && isLayoutEditorLockActive(existing, now)) {
          return { ok: false as const, lockedBy: existing };
        }

        const user = await tx.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        const lock: LayoutEditorLock = {
          userId,
          sessionId: parsed.data.sessionId,
          userName: user?.name || user?.email || 'Another user',
          lockedAt: new Date(now).toISOString(),
        };
        locks[layoutId] = lock;
        await tx.setting.upsert({
          where: { key: LAYOUT_EDITOR_LOCK_KEY },
          create: { id: generateId('Setting'), key: LAYOUT_EDITOR_LOCK_KEY, value: locks as Prisma.InputJsonValue },
          update: { value: locks as Prisma.InputJsonValue },
        });
        return { ok: true as const, lock };
      });

      if (!result.ok) {
        return reply.code(409).send({
          error: `This page layout is currently being edited by ${result.lockedBy.userName}.`,
          lockedBy: { userName: result.lockedBy.userName, lockedAt: result.lockedBy.lockedAt },
        });
      }
      return reply.send({ ok: true, expiresAt: new Date(Date.parse(result.lock.lockedAt) + LAYOUT_EDITOR_LOCK_TTL_MS).toISOString() });
    } catch (err: any) {
      app.log.error(err, 'POST /layouts/:layoutId/lock failed');
      return reply.code(500).send({ error: 'Failed to acquire layout edit lock' });
    }
  });

  app.post('/layouts/:layoutId/unlock', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const { layoutId } = req.params as { layoutId: string };
    const parsed = z.object({ sessionId: z.string().min(1).max(128) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'A valid editor sessionId is required' });

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${LAYOUT_EDITOR_LOCK_KEY}), hashtext(${layoutId}))`;

        const setting = await tx.setting.findUnique({ where: { key: LAYOUT_EDITOR_LOCK_KEY } });
        const locks = readLayoutEditorLocks(setting?.value);
        const existing = locks[layoutId];
        if (existing?.userId !== userId || existing.sessionId !== parsed.data.sessionId) return;

        delete locks[layoutId];
        await tx.setting.upsert({
          where: { key: LAYOUT_EDITOR_LOCK_KEY },
          create: { id: generateId('Setting'), key: LAYOUT_EDITOR_LOCK_KEY, value: locks as Prisma.InputJsonValue },
          update: { value: locks as Prisma.InputJsonValue },
        });
      });
      return reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'POST /layouts/:layoutId/unlock failed');
      return reply.code(500).send({ error: 'Failed to release layout edit lock' });
    }
  });

  // Get all layouts for an object.
  // Note: the runtime page-layout resolver lives on the web side
  // (apps/web/lib/layout-resolver.ts) and treats only `active === true` as
  // live — undefined / false both count as Draft. The Prisma `isActive`
  // column here uses the same semantics; the schema-blob path goes through
  // the JSON-stored `active` field on each layout.
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
