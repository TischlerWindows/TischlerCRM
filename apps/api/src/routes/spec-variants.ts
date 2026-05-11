import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const createVariantSchema = z.object({
  presetId: z.string().min(1),
  matchValue: z.string().min(1),
  matchLabel: z.string().nullable().optional(),
  body: z.string().min(1),
  order: z.number().int().min(0),
  isActive: z.boolean().optional(),
});

const updateVariantSchema = z.object({
  matchValue: z.string().min(1).optional(),
  matchLabel: z.string().nullable().optional(),
  body: z.string().min(1).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export async function specVariantRoutes(app: FastifyInstance) {
  // POST /spec-variants — create variant for a preset (admin only)
  app.post('/spec-variants', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const parsed = createVariantSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      const preset = await prisma.specPreset.findUnique({ where: { id: parsed.data.presetId } });
      if (!preset) {
        return reply.code(404).send({ error: 'Preset not found' });
      }

      const variant = await prisma.specVariant.create({
        data: {
          id: generateId('SpecVariant'),
          presetId: parsed.data.presetId,
          matchValue: parsed.data.matchValue,
          matchLabel: parsed.data.matchLabel ?? null,
          body: parsed.data.body,
          order: parsed.data.order,
          isActive: parsed.data.isActive ?? true,
        },
      });
      reply.code(201).send(variant);
    } catch (err: any) {
      app.log.error(err, 'POST /spec-variants failed');
      reply.code(500).send({ error: 'Failed to create variant', detail: err?.message });
    }
  });

  // PATCH /spec-variants/:id — update variant (admin only)
  app.patch('/spec-variants/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    const parsed = updateVariantSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      const variant = await prisma.specVariant.update({
        where: { id },
        data: parsed.data,
      });
      reply.send(variant);
    } catch (err: any) {
      app.log.error(err, 'PATCH /spec-variants/:id failed');
      reply.code(500).send({ error: 'Failed to update variant', detail: err?.message });
    }
  });

  // DELETE /spec-variants/:id — delete variant (admin only)
  app.delete('/spec-variants/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    try {
      await prisma.specVariant.delete({ where: { id } });
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'DELETE /spec-variants/:id failed');
      reply.code(500).send({ error: 'Failed to delete variant', detail: err?.message });
    }
  });
}
