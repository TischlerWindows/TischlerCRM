import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';

const itemSchema = z.object({
  category: z.string(),
  productType: z.string(),
  qty: z.number(),
  fields: z.number(),
  sqFeet: z.number(),
  netEuro: z.number(),
});

const syncBodySchema = z.object({
  summaryId: z.string(),
  summaryName: z.string(),
  opportunityNumber: z.string(),
  linkedOpportunityId: z.string().nullable().optional(),
  date: z.string().optional(),
  items: z.array(itemSchema),
});

export async function productLogRoutes(app: FastifyInstance) {
  // GET /product-log — list all entries, optional filter by summaryId or linkedOpportunityId
  app.get('/product-log', async (req, reply) => {
    const q = req.query as { summaryId?: string; opportunityId?: string };
    try {
      const entries = await prisma.productLog.findMany({
        where: {
          ...(q.summaryId ? { summaryId: q.summaryId } : {}),
          ...(q.opportunityId ? { linkedOpportunityId: q.opportunityId } : {}),
        },
        orderBy: [{ summaryName: 'asc' }, { category: 'asc' }, { productType: 'asc' }],
      });
      reply.send(entries);
    } catch (err: any) {
      app.log.error(err, 'GET /product-log failed');
      reply.code(500).send({ error: 'Failed to fetch product log', detail: err?.message });
    }
  });

  // POST /product-log/sync — replace all entries for a summary (upsert by summaryId)
  app.post('/product-log/sync', async (req, reply) => {
    const parsed = syncBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    const { summaryId, summaryName, opportunityNumber, linkedOpportunityId, date, items } = parsed.data;

    try {
      // Delete existing entries for this summary, then insert fresh
      await prisma.$transaction([
        prisma.productLog.deleteMany({ where: { summaryId } }),
        ...items.map((item) =>
          prisma.productLog.create({
            data: {
              id: generateId('ProductLog'),
              summaryId,
              summaryName,
              opportunityNumber,
              linkedOpportunityId: linkedOpportunityId ?? null,
              date: date ?? null,
              category: item.category,
              productType: item.productType,
              qty: item.qty,
              fields: item.fields,
              sqFeet: item.sqFeet,
              netEuro: item.netEuro,
            },
          })
        ),
      ]);

      reply.send({ ok: true, count: items.length });
    } catch (err: any) {
      app.log.error(err, 'POST /product-log/sync failed');
      reply.code(500).send({ error: 'Failed to sync product log', detail: err?.message });
    }
  });

  // DELETE /product-log/:summaryId — remove all log entries for a summary
  app.delete('/product-log/:summaryId', async (req, reply) => {
    const { summaryId } = req.params as { summaryId: string };
    try {
      const { count } = await prisma.productLog.deleteMany({ where: { summaryId } });
      reply.send({ ok: true, deleted: count });
    } catch (err: any) {
      app.log.error(err, 'DELETE /product-log/:summaryId failed');
      reply.code(500).send({ error: 'Failed to delete product log entries', detail: err?.message });
    }
  });
}
