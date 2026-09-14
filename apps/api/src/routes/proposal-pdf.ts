import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@crm/db/client';
import { assembleProposal, type TokenMappingRow } from '@crm/proposal-assembly';
import { pageLogosSchema, type PageLogoRule } from '@crm/types';
import { verifyJwt } from '../auth.js';
import { loadEnv } from '../config.js';
import {
  renderProposalPDF,
  type BrandResources,
  type PageLogoFile,
} from '../lib/proposal-pdf/renderer.js';
import { collectGlassTypeKeys, appendGlassSheets } from '../lib/proposal-pdf/glass-sheets.js';
import { appendDadeImpactSheet } from '../lib/proposal-pdf/dade-impact-sheet.js';

const renderSchema = z.object({
  summaryId: z.string().min(1),
  templateId: z.string().min(1),
  /**
   * Optional Hard Edit overrides. Maps an ordered-block index (as a string)
   * to the edited HTML body for that block. Applied to the assembled result
   * before rendering so the PDF reflects the user's inline edits while using
   * the exact same PDFKit renderer as the normal preview.
   */
  bodyOverrides: z.record(z.string()).optional(),
});

/**
 * Shared rendering core for both the POST (JSON body, used by Hard Edit
 * which can carry large bodyOverrides) and GET (query string, used for
 * plain-preview navigation so the browser's own Content-Disposition
 * filename handling applies — no blob: URL, no lost filename) routes.
 */
async function buildProposalPdf(
  app: FastifyInstance,
  { summaryId, templateId, bodyOverrides }: z.infer<typeof renderSchema>,
): Promise<{ buffer: Buffer; filename: string } | { error: string; status: number }> {
  // ── Fetch template + presets + token mappings + brand wiring ────
  // The template includes 5 distinct font roles per the brand guide
  // (title, subtitle, heading, body, signature). Each is nullable — the
  // renderer falls back to Helvetica variants where unset.
  const fontSelect = { id: true, family: true, data: true } as const;
  const template = await prisma.quoteTemplate.findUnique({
    where: { id: templateId },
    include: {
      presets: { include: { conditions: true, variants: true } },
      tokenMappings: true,
      signatureFont:  { select: fontSelect },
      titleFont:      { select: fontSelect },
      subtitleFont:   { select: fontSelect },
      headingFont:    { select: fontSelect },
      bodyFont:       { select: fontSelect },
    },
  });
  if (!template) return { error: 'Template not found', status: 404 };

  const fontRes = (f: typeof template.titleFont) =>
    f ? { bytes: Buffer.from(f.data), family: f.family } : undefined;

  // ── Resolve per-page logo rules to image bytes ────────────────
  // pageLogos is a JSON column — validate the shape and silently drop
  // rules that don't parse rather than 500'ing the whole PDF. Logos are
  // referenced by id only (no Prisma FK) so a deleted logo just gets
  // dropped from the list with a log line.
  const pageLogos = await resolvePageLogos(app, template.pageLogos);

  const brand: BrandResources = {
    accentColor: template.accentColorHex ?? undefined,
    emphasisColor: template.emphasisColorHex ?? undefined,
    pageLogos,
    signatureFont: fontRes(template.signatureFont),
    titleFont:     fontRes(template.titleFont),
    subtitleFont:  fontRes(template.subtitleFont),
    headingFont:   fontRes(template.headingFont),
    bodyFont:      fontRes(template.bodyFont),
  };

  // ── Load the summary from the Setting blob (matches client) ────
  const summariesSetting = await prisma.setting.findUnique({ where: { key: 'summaries' } });
  const summaries = (summariesSetting?.value as unknown as Array<{ id: string }>) ?? [];
  const summary = Array.isArray(summaries) ? summaries.find((s) => s.id === summaryId) : null;
  if (!summary) return { error: 'Summary not found', status: 404 };

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

  // ── Apply Hard Edit body overrides ────────────────────────────
  // Each key is an ordered-block index; the value is the edited HTML body.
  // Mutating preset.body here means the PDFKit renderer draws the user's
  // edits with the identical layout/fonts/logo as a normal preview.
  if (bodyOverrides) {
    for (const [key, body] of Object.entries(bodyOverrides)) {
      const idx = Number(key);
      if (Number.isInteger(idx) && idx >= 0 && idx < result.orderedBlocks.length) {
        result.orderedBlocks[idx].preset.body = body;
      }
    }
  }

  // ── Render ────────────────────────────────────────────────────
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderProposalPDF(result, brand);
  } catch (err) {
    app.log.error({ err }, 'PDF render failed');
    return { error: 'Failed to render proposal PDF', status: 500 };
  }

  // ── Append glass type data sheets ─────────────────────────────
  const glassKeys = collectGlassTypeKeys(summary as Record<string, unknown>);
  if (glassKeys.length > 0) {
    try {
      pdfBuffer = await appendGlassSheets(pdfBuffer, glassKeys);
    } catch (err) {
      app.log.warn({ err }, 'Glass sheet append failed — returning proposal without sheets');
    }
  }

  // ── Append the Impact Resistant Products sheet for Dade County jobs ──
  try {
    pdfBuffer = await appendDadeImpactSheet(pdfBuffer, (summary as Record<string, unknown>).jobType as string | undefined);
  } catch (err) {
    app.log.warn({ err }, 'Dade impact sheet append failed — returning proposal without it');
  }

  const safeName = (result.pdfData.projectName || 'Proposal').replace(/[^A-Za-z0-9_-]+/g, '_');
  const filename = `${safeName}_Quote.pdf`;
  return { buffer: pdfBuffer, filename };
}

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

    const result = await buildProposalPdf(app, parsed.data);
    if ('error' in result) return reply.code(result.status).send({ error: result.error });

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${result.filename}"`)
      .header('Content-Length', String(result.buffer.length))
      .send(result.buffer);
  });

  /**
   * GET /proposal-pdf/render?templateId=...&summaryId=...&token=...
   *
   * Same render as the POST route, but meant for direct browser navigation
   * (window.open/location.href) rather than fetch+blob — that way the
   * response's Content-Disposition filename is what the browser's native
   * PDF viewer shows as the tab title and "Save as" suggestion, instead of
   * a client-generated blob: URL's raw id. Auth token travels via query
   * param (same pattern as /places/static-map) since a plain navigation
   * can't set an Authorization header. Doesn't support bodyOverrides
   * (Hard Edit) — those stay on the POST+blob path.
   */
  app.get('/proposal-pdf/render', async (req, reply) => {
    const query = req.query as Record<string, string>;
    let user = req.user;
    if (!user && query.token) {
      const env = loadEnv();
      user = verifyJwt(query.token, env.JWT_SECRET) as any;
    }
    if (!user) return reply.code(401).send({ error: 'Authentication required.' });

    const parsed = renderSchema.pick({ summaryId: true, templateId: true }).safeParse(query);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }

    const result = await buildProposalPdf(app, parsed.data);
    if ('error' in result) return reply.code(result.status).send({ error: result.error });

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${result.filename}"`)
      .header('Content-Length', String(result.buffer.length))
      .send(result.buffer);
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

/**
 * Validates the JSON `pageLogos` blob, batch-loads each referenced BrandLogo
 * by id, and returns the renderer-ready array. Rules with missing logos or
 * a malformed shape are dropped with a log line — the PDF still renders,
 * just without those logos.
 */
async function resolvePageLogos(
  app: FastifyInstance,
  raw: unknown,
): Promise<PageLogoFile[]> {
  const parsed = pageLogosSchema.safeParse(raw ?? []);
  if (!parsed.success) {
    app.log.warn({ issues: parsed.error.issues }, 'Invalid pageLogos on template; ignoring');
    return [];
  }
  const rules: PageLogoRule[] = parsed.data;
  if (rules.length === 0) return [];

  const uniqueIds = [...new Set(rules.map((r) => r.logoId))];
  const logos = await prisma.brandLogo.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, mimeType: true, data: true },
  });
  const logoById = new Map(logos.map((l) => [l.id, l]));

  const files: PageLogoFile[] = [];
  for (const rule of rules) {
    const logo = logoById.get(rule.logoId);
    if (!logo) {
      app.log.warn({ ruleId: rule.id, logoId: rule.logoId }, 'pageLogos rule references missing logo; skipping');
      continue;
    }
    files.push({
      rule,
      bytes: Buffer.from(logo.data),
      mimeType: logo.mimeType,
    });
  }
  return files;
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
