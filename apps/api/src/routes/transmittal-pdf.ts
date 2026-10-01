import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderTransmittalPDF } from '../lib/transmittal-pdf/renderer.js';

const text = z.string().max(4000);
const renderSchema = z.object({
  projectName: z.string().max(300),
  transmittal: z.object({
    date: text, submittedFor: text, to: text, attn: text, re: text,
    submittedBy: text, deliveryVia: z.union([z.array(text).max(5), text]),
    rows: z.array(z.object({ qty: text, description: text, code: text })).min(1).max(30),
    approvalInstructions: text, remarks: text, copiesTo: text, signature: text,
  }),
});

export async function transmittalPdfRoutes(app: FastifyInstance) {
  app.post('/transmittal-pdf/render', async (req, reply) => {
    if (!req.user?.sub) return reply.code(401).send({ error: 'Authentication required' });
    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid transmittal' });
    try {
      const pdf = await renderTransmittalPDF(parsed.data.transmittal, parsed.data.projectName);
      return reply.header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'inline; filename="Transmittal.pdf"')
        .header('Content-Length', String(pdf.length)).send(pdf);
    } catch (err) {
      app.log.error({ err }, 'Transmittal PDF render failed');
      return reply.code(500).send({ error: 'Failed to render transmittal PDF' });
    }
  });
}