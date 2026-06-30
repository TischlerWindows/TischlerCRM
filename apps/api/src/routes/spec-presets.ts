import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import { blockTypeSchema, validateBlockConfig, type BlockType } from '@crm/types';

type ConfigOk = { ok: true; blockType: BlockType | null; config: unknown };
type ConfigErr = { ok: false; error: string };

function parseBlockTypeAndConfig(
  blockType: string | null | undefined,
  config: unknown,
): ConfigOk | ConfigErr {
  if (!blockType) {
    // Legacy create/update — no blockType, allow any config (typically null)
    return { ok: true, blockType: null, config: config ?? null };
  }
  const parsed = blockTypeSchema.safeParse(blockType);
  if (!parsed.success) {
    return { ok: false, error: `Invalid blockType "${blockType}"` };
  }
  const validated = validateBlockConfig(parsed.data, config);
  if (validated.ok === false) {
    return { ok: false, error: validated.error };
  }
  return { ok: true, blockType: parsed.data, config: validated.value };
}

function isConfigErr(result: ConfigOk | ConfigErr): result is ConfigErr {
  return result.ok === false;
}

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
  title: z.string().nullable().optional(),
  // Empty string is allowed: a body variant with no body falls through to the
  // block's own body at render time.
  body: z.string(),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

const createPresetSchema = z.object({
  templateId: z.string().min(1),
  order: z.number().int().min(0),
  title: z.string().min(1),
  body: z.string().nullable().optional(),
  section: z.enum(['SPECIFICATION', 'OPTION', 'EXCLUSION', 'INSTALLATION', 'CONSTANT']),
  blockType: z.string().nullable().optional(),
  config: z.unknown().optional(),
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
  blockType: z.string().nullable().optional(),
  config: z.unknown().optional(),
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

    const { conditions, variants, blockType: rawBlockType, config: rawConfig, ...presetData } = parsed.data;

    const validated = parseBlockTypeAndConfig(rawBlockType, rawConfig);
    if (isConfigErr(validated)) {
      return reply.code(400).send({ error: validated.error });
    }

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
            blockType: validated.blockType,
            config: (validated.config ?? null) as object | null,
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
              title: v.title ?? null,
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

    const { conditions, variants, blockType: rawBlockType, config: rawConfig, ...presetData } = parsed.data;

    // blockType is optional on PATCH — only validate if provided. Config is
    // re-validated whenever it's present (even if blockType isn't sent) so
    // PATCHing {config:{...}} on an existing preset checks the shape.
    const hasBlockTypeUpdate = rawBlockType !== undefined;
    const hasConfigUpdate = rawConfig !== undefined;
    let validatedBlockType: BlockType | null | undefined = undefined;
    let validatedConfig: unknown = undefined;
    if (hasBlockTypeUpdate || hasConfigUpdate) {
      // Need current blockType if only config is being updated
      let effectiveBlockType: string | null = rawBlockType ?? null;
      if (!hasBlockTypeUpdate) {
        const existing = await prisma.specPreset.findUnique({
          where: { id },
          select: { blockType: true },
        });
        effectiveBlockType = existing?.blockType ?? null;
      }
      const validated = parseBlockTypeAndConfig(effectiveBlockType, rawConfig);
      if (isConfigErr(validated)) {
        return reply.code(400).send({ error: validated.error });
      }
      if (hasBlockTypeUpdate) validatedBlockType = validated.blockType;
      if (hasConfigUpdate) validatedConfig = validated.config;
    }

    try {
      const preset = await prisma.$transaction(async (tx) => {
        await tx.specPreset.update({
          where: { id },
          data: {
            ...presetData,
            ...(hasBlockTypeUpdate ? { blockType: validatedBlockType } : {}),
            ...(hasConfigUpdate ? { config: (validatedConfig ?? null) as object | null } : {}),
          },
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
                title: v.title ?? null,
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

  // POST /spec-presets/seed-defaults — seed a template with the standard
  // block layout (admin only). Appends Letterhead / Pricing / Base Bid /
  // Additions / Exclusions header / Closing / Footer blocks onto the
  // end of the existing block list. Idempotent in the sense that a second
  // call adds another set — caller is expected to confirm with the user.
  app.post('/spec-presets/seed-defaults', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const schema = z.object({ templateId: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }
    const { templateId } = parsed.data;

    try {
      const template = await prisma.quoteTemplate.findUnique({ where: { id: templateId } });
      if (!template) return reply.code(404).send({ error: 'Template not found' });

      // Append after any existing blocks to avoid clobbering custom work.
      const existingCount = await prisma.specPreset.count({ where: { templateId } });
      const baseOrder = existingCount;

      const defaults: Array<{
        title: string;
        section: 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION' | 'CONSTANT';
        blockType: BlockType;
        body?: string;
      }> = [
        { title: 'Letterhead', section: 'CONSTANT', blockType: 'LETTERHEAD' },
        { title: 'Pricing Table', section: 'CONSTANT', blockType: 'PRICING_TABLE' },
        { title: 'Base Bid Total', section: 'CONSTANT', blockType: 'BASE_BID_LINE' },
        { title: 'Additions Table', section: 'CONSTANT', blockType: 'ADDITIONS_TABLE' },
        { title: 'Exclusions Header', section: 'CONSTANT', blockType: 'EXCLUSIONS_HEADER' },
        { title: 'Closing Signature', section: 'CONSTANT', blockType: 'CLOSING_SIGNATURE' },
        { title: 'Footer', section: 'CONSTANT', blockType: 'FOOTER' },
      ];

      await prisma.specPreset.createMany({
        data: defaults.map((d, i) => ({
          id: generateId('SpecPreset'),
          templateId,
          order: baseOrder + i,
          title: d.title,
          body: d.body ?? null,
          section: d.section,
          blockType: d.blockType,
          isAlwaysIncluded: true,
        })),
      });

      const presets = await prisma.specPreset.findMany({
        where: { templateId },
        orderBy: { order: 'asc' },
        include: { conditions: true, variants: { orderBy: { order: 'asc' } } },
      });
      reply.send(presets);
    } catch (err: any) {
      app.log.error(err, 'POST /spec-presets/seed-defaults failed');
      reply.code(500).send({ error: 'Failed to seed defaults', detail: err?.message });
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
