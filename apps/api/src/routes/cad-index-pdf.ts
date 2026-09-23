import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderCadIndexPDF } from '../lib/cad-index-pdf/renderer.js';

const renderSchema = z.object({
  title: z.string(),
  projectName: z.string(),
  columns: z.array(z.object({ key: z.string(), label: z.string(), type: z.enum(['text', 'number', 'checkbox']) })),
  rows: z.array(z.record(z.string(), z.unknown())),
});

export async function cadIndexPdfRoutes(app: FastifyInstance) {
  /**
   * POST /cad-index-pdf/render
   *
   * Renders a CAD Index List report (one of 4 types, column set supplied by
   * the frontend — see apps/web/widgets/internal/cad-index-list/index.tsx)
   * as a PDF, server-side, using PDFKit.
   */
  app.post('/cad-index-pdf/render', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    let pdfBuffer: Buffer;
    try {
      const columns = parsed.data.columns.map((c) => ({ key: c.key, label: c.label, type: c.type }));
      pdfBuffer = await renderCadIndexPDF(parsed.data.title, parsed.data.projectName, columns, parsed.data.rows);
    } catch (err) {
      app.log.error({ err }, 'CAD Index List PDF render failed');
      return reply.code(500).send({ error: 'Failed to render CAD Index List PDF' });
    }

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'inline; filename="CAD_Index_List.pdf"')
      .header('Content-Length', String(pdfBuffer.length))
      .send(pdfBuffer);
  });
}
