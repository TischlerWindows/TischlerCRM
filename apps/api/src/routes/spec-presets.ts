import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(['CONTAINS', 'EQUALS', 'NOT_EMPTY', 'IS_TRUE', 'IS_FALSE']),
  value: z.string().nullable().optional(),
  logic: z.enum(['AND', 'OR']).default('AND'),
}).superRefine((condition, ctx) => {
  if ((condition.operator === 'CONTAINS' || condition.operator === 'EQUALS') && !condition.value?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: `${condition.operator} conditions require a value`,
    });
  }
});

const variantSchema = z.object({
  matchValue: z.string().min(1),
  matchLabel: z.string().nullable().optional(),
  body: z.string().min(1),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

const createPresetSchema = z.object({
  templateId: z.string().min(1),
  order: z.number().int().min(0),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  section: z.enum(['SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION', 'CONSTANT']),
  isAlwaysIncluded: z.boolean().optional(),
  driverField: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(conditionSchema).optional(),
  variants: z.array(variantSchema).optional(),
});

const updatePresetSchema = z.object({
  order: z.number().int().min(0).optional(),
  title: z.string().min(1).optional(),
  body: z.string().nullable().optional(),
  section: z.enum(['SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION', 'CONSTANT']).optional(),
  isAlwaysIncluded: z.boolean().optional(),
  driverField: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  conditions: z.array(conditionSchema).optional(),
  variants: z.array(variantSchema).optional(),
});

const reorderSchema = z.array(z.object({
  id: z.string().min(1),
  order: z.number().int().min(0),
}));

export async function specPresetRoutes(app: FastifyInstance) {
  // GET /spec-presets?templateId=X — list presets for template
  app.get('/spec-presets', async (req, reply) => {
    const { templateId } = req.query as { templateId?: string };
    if (!templateId) {
      return reply.code(400).send({ error: 'templateId query parameter is required' });
    }

    try {
      const presets = await prisma.specPreset.findMany({
        where: { templateId },
        orderBy: { order: 'asc' },
        include: {
          conditions: true,
          variants: { orderBy: { order: 'asc' } },
        },
      });
      reply.send(presets);
    } catch (err: any) {
      app.log.error(err, 'GET /spec-presets failed');
      reply.code(500).send({ error: 'Failed to fetch presets', detail: err?.message });
    }
  });

  // POST /spec-presets — create preset with conditions (admin only)
  app.post('/spec-presets', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const parsed = createPresetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    const { conditions, variants, ...presetData } = parsed.data;

    try {
      // Verify the referenced template exists
      const template = await prisma.quoteTemplate.findUnique({ where: { id: presetData.templateId } });
      if (!template) {
        return reply.code(404).send({ error: 'Template not found', detail: `No template with id "${presetData.templateId}"` });
      }

      const preset = await prisma.$transaction(async (tx) => {
        const created = await tx.specPreset.create({
          data: {
            id: generateId('SpecPreset'),
            ...presetData,
          },
        });

        if (conditions && conditions.length > 0) {
          await tx.specCondition.createMany({
            data: conditions.map((c) => ({
              id: generateId('SpecCondition'),
              presetId: created.id,
              field: c.field,
              operator: c.operator,
              value: c.value ?? null,
              logic: c.logic,
            })),
          });
        }

        if (variants && variants.length > 0) {
          await tx.specVariant.createMany({
            data: variants.map((v) => ({
              id: generateId('SpecVariant'),
              presetId: created.id,
              matchValue: v.matchValue,
              matchLabel: v.matchLabel ?? null,
              body: v.body,
              order: v.order,
              isActive: v.isActive ?? true,
            })),
          });
        }

        return tx.specPreset.findUnique({
          where: { id: created.id },
          include: {
            conditions: true,
            variants: { orderBy: { order: 'asc' } },
          },
        });
      });

      reply.code(201).send(preset);
    } catch (err: any) {
      app.log.error(err, 'POST /spec-presets failed');
      reply.code(500).send({ error: 'Failed to create preset', detail: err?.message });
    }
  });

  // PATCH /spec-presets/reorder — batch update order values (admin only)
  app.patch('/spec-presets/reorder', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    if (parsed.data.length === 0) {
      return reply.send({ ok: true });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Verify all IDs exist and belong to the same template
        const ids = parsed.data.map((item) => item.id);
        const existing = await tx.specPreset.findMany({
          where: { id: { in: ids } },
          select: { id: true, templateId: true },
        });

        if (existing.length !== ids.length) {
          const found = new Set(existing.map((e) => e.id));
          const missing = ids.filter((id) => !found.has(id));
          throw new Error(`Presets not found: ${missing.join(', ')}`);
        }

        const templateIds = new Set(existing.map((e) => e.templateId));
        if (templateIds.size > 1) {
          throw new Error('All presets in a reorder batch must belong to the same template');
        }

        // Apply order updates
        for (const item of parsed.data) {
          await tx.specPreset.update({
            where: { id: item.id },
            data: { order: item.order },
          });
        }
      });
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'PATCH /spec-presets/reorder failed');
      const status = err.message?.includes('not found') || err.message?.includes('same template') ? 400 : 500;
      reply.code(status).send({ error: 'Failed to reorder presets', detail: err?.message });
    }
  });

  // PATCH /spec-presets/:id — update preset and replace conditions (admin only)
  app.patch('/spec-presets/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    const parsed = updatePresetSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    const { conditions, variants, ...presetData } = parsed.data;

    try {
      const preset = await prisma.$transaction(async (tx) => {
        await tx.specPreset.update({
          where: { id },
          data: presetData,
        });

        if (conditions !== undefined) {
          await tx.specCondition.deleteMany({ where: { presetId: id } });

          if (conditions.length > 0) {
            await tx.specCondition.createMany({
              data: conditions.map((c) => ({
                id: generateId('SpecCondition'),
                presetId: id,
                field: c.field,
                operator: c.operator,
                value: c.value ?? null,
                logic: c.logic,
              })),
            });
          }
        }

        if (variants !== undefined) {
          await tx.specVariant.deleteMany({ where: { presetId: id } });

          if (variants.length > 0) {
            await tx.specVariant.createMany({
              data: variants.map((v) => ({
                id: generateId('SpecVariant'),
                presetId: id,
                matchValue: v.matchValue,
                matchLabel: v.matchLabel ?? null,
                body: v.body,
                order: v.order,
                isActive: v.isActive ?? true,
              })),
            });
          }
        }

        return tx.specPreset.findUnique({
          where: { id },
          include: {
            conditions: true,
            variants: { orderBy: { order: 'asc' } },
          },
        });
      });

      reply.send(preset);
    } catch (err: any) {
      app.log.error(err, 'PATCH /spec-presets/:id failed');
      reply.code(500).send({ error: 'Failed to update preset', detail: err?.message });
    }
  });

  // DELETE /spec-presets/:id — delete preset (admin only, cascades conditions)
  app.delete('/spec-presets/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    try {
      await prisma.specPreset.delete({ where: { id } });
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'DELETE /spec-presets/:id failed');
      reply.code(500).send({ error: 'Failed to delete preset', detail: err?.message });
    }
  });
}
