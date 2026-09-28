import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderFactoryOrderSpecPDF } from '../lib/factory-order-spec-pdf/renderer.js';

const text = z.string().max(4000);
const renderSchema = z.object({
  projectName: z.string().max(300),
  spec: z.object({
    re: text, project: text, to: text, from: text,
    products: z.array(z.string().max(80)).max(4),
    approvedDrawings: text, onHoldItems: text,
    specifications: z.record(z.object({ specification: text, remarks: text })),
    hardware: z.record(z.object({ suppliedBy: text, finishType: text })),
    jobsiteAddress: text, destinationPort: text, shippingWeek: text,
    additionalRemarks: text, signatureName: text, signatureTitle: text,
  }),
});

export async function factoryOrderSpecPdfRoutes(app: FastifyInstance) {
  app.post('/factory-order-spec-pdf/render', async (req, reply) => {
    if (!req.user?.sub) return reply.code(401).send({ error: 'Authentication required' });
    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid factory order spec' });
    try {
      const pdf = await renderFactoryOrderSpecPDF(parsed.data.spec, parsed.data.projectName);
      return reply.header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'inline; filename="Factory_Order_Spec.pdf"')
        .header('Content-Length', String(pdf.length)).send(pdf);
    } catch (err) {
      app.log.error({ err }, 'Factory Order Spec PDF render failed');
      return reply.code(500).send({ error: 'Failed to render Factory Order Spec PDF' });
    }
  });
}