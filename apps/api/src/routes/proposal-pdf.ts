import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@crm/db/client';
import { assembleProposal, type TokenMappingRow } from '@crm/proposal-assembly';
import { renderProposalPDF, type BrandResources } from '../lib/proposal-pdf/renderer.js';

const renderSchema = z.object({
  summaryId: z.string().min(1),
  templateId: z.string().min(1),
});

export async function proposalPdfRoutes(app: FastifyInstance) {
  /**
   * POST /proposal-pdf/render
   *
   * Renders a proposal PDF server-side using PDFKit. Replaces the deprecated
   * client-side jsPDF flow. Returns the PDF binary as `application/pdf`.
   */
  app.post('/proposal-pdf/render', async (req, reply) => {
    if (!(req as { user?: { sub?: string } }).user?.sub) {
      return reply.code(401).send({ error: 'Authentication required.' });
    }

    const parsed = renderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }
    const { summaryId, templateId } = parsed.data;

    // ── Fetch template + presets + token mappings + brand wiring ────
    const template = await prisma.quoteTemplate.findUnique({
      where: { id: templateId },
      include: {
        presets: { include: { conditions: true, variants: true } },
        tokenMappings: true,
        letterheadLogo: { select: { id: true, mimeType: true, data: true } },
        signatureFont: { select: { id: true, family: true, data: true } },
      },
    });
    if (!template) return reply.code(404).send({ error: 'Template not found' });

    const brand: BrandResources = {
      accentColor: template.accentColorHex ?? undefined,
      emphasisColor: template.emphasisColorHex ?? undefined,
      letterhead: template.letterheadLogo
        ? {
            bytes: Buffer.from(template.letterheadLogo.data),
            mimeType: template.letterheadLogo.mimeType,
          }
        : undefined,
      signatureFont: template.signatureFont
        ? {
            bytes: Buffer.from(template.signatureFont.data),
            family: template.signatureFont.family,
          }
        : undefined,
    };

    // ── Load the summary from the Setting blob (matches client) ────
    const summariesSetting = await prisma.setting.findUnique({ where: { key: 'summaries' } });
    const summaries = (summariesSetting?.value as unknown as Array<{ id: string }>) ?? [];
    const summary = Array.isArray(summaries) ? summaries.find((s) => s.id === summaryId) : null;
    if (!summary) return reply.code(404).send({ error: 'Summary not found' });

    // ── Optional: linked Opportunity + Project records for custom token
    // resolution (Phase 2 functionality — runs lazily, never blocks). ──
    const linkedOpportunityId = (summary as { linkedOpportunityId?: string }).linkedOpportunityId;
    const opportunity = await fetchLinkedRecord(prisma, 'Opportunity', linkedOpportunityId).catch(() => null);
    const project = await fetchProjectForOpportunity(prisma, linkedOpportunityId).catch(() => null);

    // ── Assemble ─────────────────────────────────────────────────
    const result = assembleProposal({
      summary: summary as Parameters<typeof assembleProposal>[0]['summary'],
      template: {
        id: template.id,
        name: template.name,
        presets: template.presets as Parameters<typeof assembleProposal>[0]['template']['presets'],
      },
      tokenMappings: template.tokenMappings as unknown as TokenMappingRow[],
      opportunity: opportunity ?? undefined,
      project: project ?? undefined,
    });

    // ── Render ────────────────────────────────────────────────────
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderProposalPDF(result, brand);
    } catch (err) {
      app.log.error({ err }, 'PDF render failed');
      return reply.code(500).send({ error: 'Failed to render proposal PDF' });
    }

    const safeName = (result.pdfData.projectName || 'Proposal').replace(/[^A-Za-z0-9_-]+/g, '_');
    const filename = `${safeName}_Quote.pdf`;

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${filename}"`)
      .header('Content-Length', String(pdfBuffer.length))
      .send(pdfBuffer);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────

async function fetchLinkedRecord(
  db: typeof prisma,
  apiName: string,
  recordId: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!recordId) return null;
  const object = await db.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
  });
  if (!object) return null;
  const record = await db.record.findFirst({
    where: { id: recordId, objectId: object.id, deletedAt: null },
  });
  return (record?.data as Record<string, unknown>) ?? null;
}

async function fetchProjectForOpportunity(
  db: typeof prisma,
  opportunityId: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (!opportunityId) return null;
  const projectObject = await db.customObject.findFirst({
    where: { apiName: { equals: 'Project', mode: 'insensitive' } },
  });
  if (!projectObject) return null;

  // Find the most recently updated Project whose `opportunity` Lookup points
  // at this opportunity. The records route handles prefixed/unprefixed paths
  // — mirror that behavior here.
  const projects = await db.record.findMany({
    where: {
      objectId: projectObject.id,
      deletedAt: null,
      OR: [
        { data: { path: ['opportunity'], equals: opportunityId } },
        { data: { path: ['Project__opportunity'], equals: opportunityId } },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    take: 1,
  });

  return (projects[0]?.data as Record<string, unknown>) ?? null;
}
