import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderInstallProgressPDF } from '../lib/install-progress-pdf/renderer.js';

const renderSchema = z.object({
  installationName: z.string(),
  stageColumns: z.array(z.object({ key: z.string(), label: z.string() })),
  rows: z.array(
    z.object({
      page: z.unknown().optional(),
      unitType: z.unknown().optional(),
      code: z.unknown().optional(),
      openingNumber: z.unknown().optional(),
      location: z.unknown().optional(),
      remarks: z.unknown().optional(),
      sequence: z.unknown().optional(),
      stages: z.record(z.string(), z.boolean()),
    }),
  ),
});

export async function installProgressPdfRoutes(app: FastifyInstance) {
  /**
   * POST /install-progress-pdf/render
   *
   * Renders the Install Progress Report as a PDF, server-side, using
   * PDFKit. The frontend sends the same rows it renders on screen
   * (apps/web/widgets/internal/install-progress-report/index.tsx); this
   * returns the PDF binary as `application/pdf`.
   */
  app.post('/install-progress-pdf/render', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    let pdfBuffer: Buffer;
    try {
      const stageColumns = parsed.data.stageColumns.map((c) => ({ key: c.key, label: c.label }));
      const rows = parsed.data.rows.map((r) => ({
        page: r.page,
        unitType: r.unitType,
        code: r.code,
        openingNumber: r.openingNumber,
        location: r.location,
        remarks: r.remarks,
        sequence: r.sequence,
        stages: r.stages ?? {},
      }));
      pdfBuffer = await renderInstallProgressPDF(parsed.data.installationName, stageColumns, rows);
    } catch (err) {
      app.log.error({ err }, 'Install Progress Report PDF render failed');
      return reply.code(500).send({ error: 'Failed to render Install Progress Report PDF' });
    }

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'inline; filename="Install_Progress_Report.pdf"')
      .header('Content-Length', String(pdfBuffer.length))
      .send(pdfBuffer);
  });
}
