import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import { pageLogosSchema } from '@crm/types';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  summaryType: z.string().nullable().optional(),
});

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Must be #RRGGBB')
  .nullable()
  .optional();

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  summaryType: z.string().nullable().optional(),
  // Brand wiring — admin picks which Company Resources the template uses.
  // Each font role maps to a BrandFont. The renderer registers them with
  // PDFKit and falls back to Helvetica variants when unset.
  signatureFontId:  z.string().nullable().optional(),
  titleFontId:      z.string().nullable().optional(),
  subtitleFontId:   z.string().nullable().optional(),
  headingFontId:    z.string().nullable().optional(),
  bodyFontId:       z.string().nullable().optional(),
  accentColorHex:   hexColor,
  emphasisColorHex: hexColor,
});

const pageLogosUpdateSchema = z.object({
  pageLogos: pageLogosSchema,
});

export async function quoteTemplateRoutes(app: FastifyInstance) {
  // GET /quote-templates — list all templates with preset count
  app.get('/quote-templates', async (_req, reply) => {
    try {
      const templates = await prisma.quoteTemplate.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { presets: true } },
        },
      });
      reply.send(templates);
    } catch (err: any) {
      app.log.error(err, 'GET /quote-templates failed');
      reply.code(500).send({ error: 'Failed to fetch quote templates', detail: err?.message });
    }
  });

  // GET /quote-templates/default — get the default template with all presets + conditions
  app.get('/quote-templates/default', async (_req, reply) => {
    try {
      const template = await prisma.quoteTemplate.findFirst({
        where: { isDefault: true, isActive: true },
        orderBy: { updatedAt: 'desc' },
        include: {
          presets: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
            include: {
              conditions: true,
              variants: { orderBy: { order: 'asc' } },
            },
          },
        },
      });
      if (!template) {
        return reply.code(404).send({ error: 'No default template found' });
      }
      reply.send(template);
    } catch (err: any) {
      app.log.error(err, 'GET /quote-templates/default failed');
      reply.code(500).send({ error: 'Failed to fetch default template', detail: err?.message });
    }
  });

  // GET /quote-templates/:id — get template with all presets + conditions
  app.get('/quote-templates/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const template = await prisma.quoteTemplate.findUnique({
        where: { id },
        include: {
          presets: {
            orderBy: { order: 'asc' },
            include: {
              conditions: true,
              variants: { orderBy: { order: 'asc' } },
            },
          },
        },
      });
      if (!template) {
        return reply.code(404).send({ error: 'Template not found' });
      }
      reply.send(template);
    } catch (err: any) {
      app.log.error(err, 'GET /quote-templates/:id failed');
      reply.code(500).send({ error: 'Failed to fetch template', detail: err?.message });
    }
  });

  // POST /quote-templates — create template (admin only)
  app.post('/quote-templates', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      const template = await prisma.$transaction(async (tx) => {
        // If setting as default, unset other defaults first (atomic)
        if (parsed.data.isDefault) {
          await tx.quoteTemplate.updateMany({
            where: { isDefault: true },
            data: { isDefault: false },
          });
        }

        return tx.quoteTemplate.create({
          data: {
            id: generateId('QuoteTemplate'),
            ...parsed.data,
          },
        });
      });
      reply.code(201).send(template);
    } catch (err: any) {
      app.log.error(err, 'POST /quote-templates failed');
      reply.code(500).send({ error: 'Failed to create template', detail: err?.message });
    }
  });

  // PATCH /quote-templates/:id — update template (admin only)
  app.patch('/quote-templates/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      const template = await prisma.$transaction(async (tx) => {
        // If setting as default, unset other defaults first (atomic)
        if (parsed.data.isDefault) {
          await tx.quoteTemplate.updateMany({
            where: { isDefault: true, id: { not: id } },
            data: { isDefault: false },
          });
        }

        return tx.quoteTemplate.update({
          where: { id },
          data: parsed.data,
        });
      });
      reply.send(template);
    } catch (err: any) {
      app.log.error(err, 'PATCH /quote-templates/:id failed');
      reply.code(500).send({ error: 'Failed to update template', detail: err?.message });
    }
  });

  // PATCH /quote-templates/:id/page-logos — replace the per-page logo rules
  // (admin only). The body is the full new array; the route does a single
  // wholesale replace rather than merging. Validates each rule via the
  // shared Zod schema in @crm/types.
  app.patch('/quote-templates/:id/page-logos', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    const parsed = pageLogosUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      // Prisma's Json column types as `InputJsonValue` which the Zod-parsed
      // PageLogoRule[] satisfies structurally. Cast through `unknown` to
      // avoid TS widening complaints about the parameterized array type.
      const template = await prisma.quoteTemplate.update({
        where: { id },
        data: { pageLogos: parsed.data.pageLogos as unknown as object },
      });
      reply.send(template);
    } catch (err: any) {
      app.log.error(err, 'PATCH /quote-templates/:id/page-logos failed');
      reply.code(500).send({ error: 'Failed to update page logos', detail: err?.message });
    }
  });

  // DELETE /quote-templates/:id — delete template (admin only, cascades presets + conditions)
  app.delete('/quote-templates/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    try {
      await prisma.quoteTemplate.delete({ where: { id } });
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'DELETE /quote-templates/:id failed');
      reply.code(500).send({ error: 'Failed to delete template', detail: err?.message });
    }
  });

  // POST /quote-templates/:id/duplicate — deep-copy a template with all presets,
  // conditions, variants, and token mappings (admin only).
  app.post('/quote-templates/:id/duplicate', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    try {
      const source = await prisma.quoteTemplate.findUnique({
        where: { id },
        include: {
          presets: {
            include: { conditions: true, variants: true },
          },
          tokenMappings: true,
        },
      });
      if (!source) return reply.code(404).send({ error: 'Template not found' });

      const newTemplateId = generateId('QuoteTemplate');
      const newTemplate = await prisma.$transaction(async (tx) => {
        const tmpl = await tx.quoteTemplate.create({
          data: {
            id: newTemplateId,
            name: `${source.name} (Copy)`,
            description: source.description,
            isDefault: false,
            isActive: source.isActive,
            summaryType: source.summaryType,
            pageLogos: source.pageLogos as object,
            signatureFontId: source.signatureFontId,
            titleFontId: source.titleFontId,
            subtitleFontId: source.subtitleFontId,
            headingFontId: source.headingFontId,
            bodyFontId: source.bodyFontId,
            accentColorHex: source.accentColorHex,
            emphasisColorHex: source.emphasisColorHex,
          },
        });

        // Deep-copy presets, conditions, variants
        for (const preset of source.presets) {
          const newPresetId = generateId('SpecPreset');
          await tx.specPreset.create({
            data: {
              id: newPresetId,
              templateId: newTemplateId,
              order: preset.order,
              title: preset.title,
              body: preset.body,
              section: preset.section,
              blockType: preset.blockType,
              config: preset.config as object | undefined,
              isAlwaysIncluded: preset.isAlwaysIncluded,
              driverField: preset.driverField,
              isActive: preset.isActive,
              conditions: {
                create: preset.conditions.map((c) => ({
                  id: generateId('SpecCondition'),
                  field: c.field,
                  operator: c.operator,
                  value: c.value,
                  logic: c.logic,
                })),
              },
              variants: {
                create: preset.variants.map((v) => ({
                  id: generateId('SpecVariant'),
                  matchValue: v.matchValue,
                  matchLabel: v.matchLabel,
                  title: v.title,
                  body: v.body,
                  order: v.order,
                  isActive: v.isActive,
                })),
              },
            },
          });
        }

        // Deep-copy token mappings
        for (const tm of source.tokenMappings) {
          await tx.tokenMapping.create({
            data: {
              id: generateId('TokenMapping'),
              templateId: newTemplateId,
              tokenName: tm.tokenName,
              sourceObject: tm.sourceObject,
              sourcePath: tm.sourcePath,
              format: tm.format,
              label: tm.label,
              category: tm.category,
              isBuiltIn: tm.isBuiltIn,
              isActive: tm.isActive,
            },
          });
        }

        return tmpl;
      });

      reply.code(201).send(newTemplate);
    } catch (err: any) {
      app.log.error(err, 'POST /quote-templates/:id/duplicate failed');
      reply.code(500).send({ error: 'Failed to duplicate template', detail: err?.message });
    }
  });
}
