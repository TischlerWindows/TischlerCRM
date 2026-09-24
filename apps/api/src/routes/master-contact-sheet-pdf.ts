import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderMasterContactSheetPDF } from '../lib/master-contact-sheet-pdf/renderer.js';

const renderSchema = z.object({
  projectName: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      fields: z.array(
        z.object({
          label: z.string(),
          type: z.enum(['text', 'phone', 'email', 'checkbox']),
          value: z.unknown().optional(),
        }),
      ),
    }),
  ),
});

export async function masterContactSheetPdfRoutes(app: FastifyInstance) {
  /**
   * POST /master-contact-sheet-pdf/render
   *
   * Renders the Master Contact Sheet widget's current field values as a
   * PDF, server-side, using PDFKit.
   */
  app.post('/master-contact-sheet-pdf/render', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    let pdfBuffer: Buffer;
    try {
      const sections = parsed.data.sections.map((s) => ({
        title: s.title,
        fields: s.fields.map((f) => ({ label: f.label, type: f.type, value: f.value })),
      }));
      pdfBuffer = await renderMasterContactSheetPDF(parsed.data.projectName, sections);
    } catch (err) {
      app.log.error({ err }, 'Master Contact Sheet PDF render failed');
      return reply.code(500).send({ error: 'Failed to render Master Contact Sheet PDF' });
    }

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'inline; filename="Master_Contact_Sheet.pdf"')
      .header('Content-Length', String(pdfBuffer.length))
      .send(pdfBuffer);
  });
}
