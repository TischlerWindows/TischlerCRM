import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderAutoCadPDF } from '../lib/autocad-pdf/renderer.js';

const renderSchema = z.object({
  projectName: z.string(),
  projectManager: z.string(),
  rows: z.array(
    z.object({
      tusProjectManager: z.unknown().optional(),
      fastener: z.unknown().optional(),
      totalQty: z.unknown().optional(),
    }),
  ),
});

export async function autocadPdfRoutes(app: FastifyInstance) {
  /**
   * POST /autocad-pdf/render
   *
   * Renders the AutoCad widget's fastener schedule as a PDF, server-side,
   * using PDFKit. The frontend sends the same rows it renders on screen
   * (apps/web/widgets/internal/autocad/index.tsx); this returns the PDF
   * binary as `application/pdf`.
   */
  app.post('/autocad-pdf/render', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    let pdfBuffer: Buffer;
    try {
      const rows = parsed.data.rows.map((r) => ({
        tusProjectManager: r.tusProjectManager,
        fastener: r.fastener,
        totalQty: r.totalQty,
      }));
      pdfBuffer = await renderAutoCadPDF(parsed.data.projectName, parsed.data.projectManager, rows);
    } catch (err) {
      app.log.error({ err }, 'AutoCad PDF render failed');
      return reply.code(500).send({ error: 'Failed to render AutoCad PDF' });
    }

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'inline; filename="AutoCad_Fastener_Schedule.pdf"')
      .header('Content-Length', String(pdfBuffer.length))
      .send(pdfBuffer);
  });
}
