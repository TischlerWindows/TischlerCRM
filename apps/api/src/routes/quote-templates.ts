import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
  // Brand wiring — admin picks which Company Resources the template uses.
  letterheadLogoId: z.string().nullable().optional(),
  signatureFontId: z.string().nullable().optional(),
  accentColorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be #RRGGBB')
    .nullable()
    .optional(),
  emphasisColorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Must be #RRGGBB')
    .nullable()
    .optional(),
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
}
