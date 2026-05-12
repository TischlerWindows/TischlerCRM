import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const createMappingSchema = z.object({
  templateId: z.string().min(1),
  tokenName: z.string().min(1),
  sourceObject: z.enum(['SUMMARY', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY', 'PROJECT', 'SYSTEM']),
  sourcePath: z.string().min(1),
  format: z.enum(['TEXT', 'CURRENCY', 'DATE', 'PHONE', 'PERCENTAGE']).default('TEXT'),
  label: z.string().min(1),
  category: z.string().min(1),
  isBuiltIn: z.boolean().optional(),
});

const updateMappingSchema = z.object({
  tokenName: z.string().min(1).optional(),
  sourceObject: z.enum(['SUMMARY', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY', 'SYSTEM']).optional(),
  sourcePath: z.string().min(1).optional(),
  format: z.enum(['TEXT', 'CURRENCY', 'DATE', 'PHONE', 'PERCENTAGE']).optional(),
  label: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
});

export async function tokenMappingRoutes(app: FastifyInstance) {
  // GET /token-mappings?templateId=X — list all mappings for a template, grouped by category
  app.get('/token-mappings', async (req, reply) => {
    const { templateId } = req.query as { templateId?: string };
    if (!templateId) {
      return reply.code(400).send({ error: 'templateId query parameter is required' });
    }

    try {
      const mappings = await prisma.tokenMapping.findMany({
        where: { templateId, isActive: true },
        orderBy: [{ category: 'asc' }, { label: 'asc' }],
      });

      const grouped: Record<string, typeof mappings> = {};
      for (const m of mappings) {
        if (!grouped[m.category]) grouped[m.category] = [];
        grouped[m.category].push(m);
      }

      reply.send({ mappings, grouped });
    } catch (err: any) {
      app.log.error(err, 'GET /token-mappings failed');
      reply.code(500).send({ error: 'Failed to fetch token mappings', detail: err?.message });
    }
  });

  // POST /token-mappings — create custom mapping (admin only)
  app.post('/token-mappings', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const parsed = createMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      const template = await prisma.quoteTemplate.findUnique({ where: { id: parsed.data.templateId } });
      if (!template) {
        return reply.code(404).send({ error: 'Template not found' });
      }

      const mapping = await prisma.tokenMapping.create({
        data: {
          id: generateId('TokenMapping'),
          ...parsed.data,
          isBuiltIn: parsed.data.isBuiltIn ?? false,
        },
      });
      reply.code(201).send(mapping);
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.code(409).send({ error: 'A token with that name already exists for this template' });
      }
      app.log.error(err, 'POST /token-mappings failed');
      reply.code(500).send({ error: 'Failed to create token mapping', detail: err?.message });
    }
  });

  // PATCH /token-mappings/:id — update mapping (admin only, reject built-in name/path changes)
  app.patch('/token-mappings/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };
    const parsed = updateMappingSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    try {
      const existing = await prisma.tokenMapping.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Token mapping not found' });
      }

      if (existing.isBuiltIn && (parsed.data.tokenName || parsed.data.sourcePath || parsed.data.sourceObject)) {
        return reply.code(400).send({ error: 'Cannot change name, source object, or path of built-in tokens' });
      }

      const mapping = await prisma.tokenMapping.update({
        where: { id },
        data: parsed.data,
      });
      reply.send(mapping);
    } catch (err: any) {
      app.log.error(err, 'PATCH /token-mappings/:id failed');
      reply.code(500).send({ error: 'Failed to update token mapping', detail: err?.message });
    }
  });

  // DELETE /token-mappings/:id — delete mapping (admin only, reject built-in deletion)
  app.delete('/token-mappings/:id', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
    const { id } = req.params as { id: string };

    try {
      const existing = await prisma.tokenMapping.findUnique({ where: { id } });
      if (!existing) {
        return reply.code(404).send({ error: 'Token mapping not found' });
      }
      if (existing.isBuiltIn) {
        return reply.code(400).send({ error: 'Cannot delete built-in token mappings' });
      }

      await prisma.tokenMapping.delete({ where: { id } });
      reply.send({ ok: true });
    } catch (err: any) {
      app.log.error(err, 'DELETE /token-mappings/:id failed');
      reply.code(500).send({ error: 'Failed to delete token mapping', detail: err?.message });
    }
  });
}
