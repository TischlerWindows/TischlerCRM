import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  categoriesArraySchema,
  findOrphanKeys,
  getCategoriesOrDefault,
  writeCategories,
} from '../lib/support-tickets/categories.js';

export async function supportTicketConfigRoutes(app: FastifyInstance) {
  /* ---------- GET /ticket-categories — any authed user ---------- */
  app.get('/ticket-categories', async (_req, reply) => {
    const items = await getCategoriesOrDefault();
    return reply.send({ items });
  });

  /* ---------- GET /admin/ticket-categories — admin: list + orphans ---------- */
  app.get('/admin/ticket-categories', async (_req, reply) => {
    const items = await getCategoriesOrDefault();
    const orphans = await findOrphanKeys(items.map((c) => c.key));
    return reply.send({ items, orphans });
  });

  /* ---------- PUT /admin/ticket-categories — admin: replace whole list ---------- */
  app.put('/admin/ticket-categories', async (req, reply) => {
    const bodySchema = z.object({ categories: categoriesArraySchema });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const saved = await writeCategories(parsed.data.categories);
    const orphans = await findOrphanKeys(saved.map((c) => c.key));
    return reply.send({ items: saved, orphans });
  });
}
