import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { renderInstallationMaterialPDF } from '../lib/installation-material-pdf/renderer.js';

const text = z.string().max(4000);
const renderSchema = z.object({
  projectName: z.string().max(300),
  form: z.object({
    template: z.enum(['ACQ', 'Non-ACQ', 'US Supplied Inst.']),
    date: text, factory: text, project: text, location: text,
    projectManager: text, attn: text,
    installationBy: z.array(z.string().max(80)).max(3),
    orderedFrom: z.array(z.string().max(80)).max(4),
    rows: z.array(z.object({ qty: text, units: text, description: text, screwSize: text, unitPrice: text })).min(1).max(100),
    signature: text, signatureDate: text,
  }),
});

export async function installationMaterialPdfRoutes(app: FastifyInstance) {
  app.post('/installation-material-pdf/render', async (req, reply) => {
    if (!req.user?.sub) return reply.code(401).send({ error: 'Authentication required.' });
    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid installation material form.' });
    try {
      const pdf = await renderInstallationMaterialPDF(parsed.data.form, parsed.data.projectName);
      return reply.header('Content-Type', 'application/pdf')
        .header('Content-Disposition', 'inline; filename="Installation_Material.pdf"')
        .header('Content-Length', String(pdf.length)).send(pdf);
    } catch (err) {
      app.log.error({ err }, 'Installation Material PDF render failed');
      return reply.code(500).send({ error: 'Failed to render installation material PDF.' });
    }
  });
}