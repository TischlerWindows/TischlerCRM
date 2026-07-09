import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderProjectListPDF } from '../lib/project-list-pdf/renderer.js';

const renderSchema = z.object({
  projects: z.array(z.record(z.string(), z.unknown())),
});

export async function projectListPdfRoutes(app: FastifyInstance) {
  /**
   * POST /project-list-pdf/render
   *
   * Renders the Project List Report as a PDF, server-side, using PDFKit.
   * The frontend sends the same flattened project rows it already renders
   * on screen (apps/web/app/projects/_components/project-list-report-modal.tsx);
   * this returns the PDF binary as `application/pdf`.
   */
  app.post('/project-list-pdf/render', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderProjectListPDF(parsed.data.projects);
    } catch (err) {
      app.log.error({ err }, 'Project List Report PDF render failed');
      return reply.code(500).send({ error: 'Failed to render Project List Report PDF' });
    }

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'inline; filename="Project_List_Report.pdf"')
      .header('Content-Length', String(pdfBuffer.length))
      .send(pdfBuffer);
  });
}
