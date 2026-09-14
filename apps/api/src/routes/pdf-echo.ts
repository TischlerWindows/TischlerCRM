/**
 * Ephemeral one-time PDF handoff — lets a client-generated PDF (e.g. the
 * jsPDF-built record/project-list/installation reports) be opened in a new
 * tab via a real HTTP GET with a proper Content-Disposition filename,
 * instead of a client-side blob: URL. Browsers' built-in PDF viewers don't
 * reliably use a blob: URL's document title/File.name for the tab title or
 * "Save as" suggestion — they show the blob's raw id — but they DO respect
 * a real response's Content-Disposition filename (same reasoning as the
 * /proposal-pdf/render GET route).
 *
 * Flow: POST the base64 PDF bytes + desired filename (normal Bearer auth) →
 * get back a random one-time id → navigate the preview tab to
 * GET /pdf-echo/:id (no auth — the random id itself is the capability,
 * same pattern used for other single-use share links) → bytes are served
 * once and immediately discarded.
 */
import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const TTL_MS = 2 * 60_000;

interface StoredPdf {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
}

const store = new Map<string, StoredPdf>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, entry] of store) {
    if (entry.expiresAt <= now) store.delete(id);
  }
}

const uploadSchema = z.object({
  filename: z.string().min(1),
  dataBase64: z.string().min(1),
});

export async function pdfEchoRoutes(app: FastifyInstance) {
  app.post('/pdf-echo', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }
    const parsed = uploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    pruneExpired();
    const id = randomUUID();
    store.set(id, {
      buffer: Buffer.from(parsed.data.dataBase64, 'base64'),
      filename: parsed.data.filename,
      expiresAt: Date.now() + TTL_MS,
    });
    reply.send({ id });
  });

  app.get('/pdf-echo/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const entry = store.get(id);
    store.delete(id);
    if (!entry || entry.expiresAt <= Date.now()) {
      return reply.code(404).send({ error: 'This preview link has expired.' });
    }
    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${entry.filename}"`)
      .header('Content-Length', String(entry.buffer.length))
      .send(entry.buffer);
  });
}
