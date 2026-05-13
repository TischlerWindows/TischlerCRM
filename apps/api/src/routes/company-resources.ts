/**
 * Company Resources — admin-only endpoints to manage brand assets used by the
 * proposal renderer: logos, fonts, and brand colors.
 *
 * Storage: binary data lives directly in the DB as Bytes. Files are small
 * (logos ~10-100KB, fonts ~50-300KB) and total row count stays in the dozens.
 * Keeps Railway deploys simple (no persistent volume) and the backup story
 * trivial. Uploads are sent as JSON with base64-encoded bytes — small enough
 * to fit in the 10MB body limit, no multipart plugin required.
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@crm/db/client';
import { logAudit, extractIp } from '../audit.js';

const MAX_LOGO_BYTES = 500 * 1024; // 500KB
const MAX_FONT_BYTES = 1024 * 1024; // 1MB
const ALLOWED_LOGO_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const ALLOWED_FONT_FORMATS = ['ttf', 'otf'];

const logoCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  // Optional brand-guide role tag. Free-form string so we don't constrain
  // future role additions, but the UI offers a curated list.
  role: z.string().trim().max(40).nullable().optional(),
  mimeType: z.string().refine((m) => ALLOWED_LOGO_MIMES.includes(m), {
    message: `mimeType must be one of ${ALLOWED_LOGO_MIMES.join(', ')}`,
  }),
  dataBase64: z.string().min(1),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});

const logoUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  role: z.string().trim().max(40).nullable().optional(),
});

const fontCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  family: z.string().trim().min(1).max(80),
  fileFormat: z.string().refine((f) => ALLOWED_FONT_FORMATS.includes(f.toLowerCase()), {
    message: `fileFormat must be one of ${ALLOWED_FONT_FORMATS.join(', ')}`,
  }),
  dataBase64: z.string().min(1),
});

const fontUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  family: z.string().trim().min(1).max(80).optional(),
});

const colorCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Hex must be #RRGGBB'),
  pantone: z.string().trim().max(40).nullable().optional(),
  role: z.string().trim().max(40).nullable().optional(),
  order: z.number().int().min(0).optional(),
});

const colorUpdateSchema = colorCreateSchema.partial();

export async function companyResourceRoutes(app: FastifyInstance) {
  // ── Auth: admin-only for every route in this module ──
  app.addHook('preHandler', async (req, reply) => {
    if (req.user?.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Admin access required.' });
    }
  });

  // ──────────────────────────────────────────────────────────────────
  // LOGOS
  // ──────────────────────────────────────────────────────────────────

  // List logos — metadata only, no bytes.
  app.get('/company-resources/logos', async (_req, reply) => {
    const rows = await prisma.brandLogo.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        role: true,
        mimeType: true,
        width: true,
        height: true,
        uploadedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    reply.send(rows);
  });

  // Stream a logo's bytes (used by <img src> previews and the PDF renderer).
  app.get<{ Params: { id: string } }>(
    '/company-resources/logos/:id/bytes',
    async (req, reply) => {
      const logo = await prisma.brandLogo.findUnique({
        where: { id: req.params.id },
        select: { mimeType: true, data: true },
      });
      if (!logo) return reply.code(404).send({ error: 'Logo not found' });
      reply
        .header('Content-Type', logo.mimeType)
        .header('Cache-Control', 'private, max-age=300')
        .send(logo.data);
    },
  );

  // Upload a new logo.
  app.post('/company-resources/logos', async (req, reply) => {
    const parsed = logoCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }
    const bytes = decodeBase64(parsed.data.dataBase64);
    if (bytes === null) {
      return reply.code(400).send({ error: 'Invalid base64 in dataBase64' });
    }
    if (bytes.length > MAX_LOGO_BYTES) {
      return reply.code(413).send({
        error: `Logo too large (${formatBytes(bytes.length)}). Max ${formatBytes(MAX_LOGO_BYTES)}.`,
      });
    }
    const created = await prisma.brandLogo.create({
      data: {
        name: parsed.data.name,
        role: parsed.data.role ?? null,
        mimeType: parsed.data.mimeType,
        data: bytes,
        width: parsed.data.width ?? null,
        height: parsed.data.height ?? null,
        uploadedById: req.user?.sub ?? null,
      },
      select: {
        id: true,
        name: true,
        role: true,
        mimeType: true,
        width: true,
        height: true,
        uploadedById: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await logAudit({
      actorId: req.user!.sub,
      action: 'CREATE',
      objectType: 'BrandLogo',
      objectId: created.id,
      objectName: created.name,
      after: { name: created.name, mimeType: created.mimeType, bytes: bytes.length } as any,
      ipAddress: extractIp(req),
    });
    reply.code(201).send(created);
  });

  // Update a logo's metadata (name and/or role). Neither requires a re-upload.
  app.patch<{ Params: { id: string } }>(
    '/company-resources/logos/:id',
    async (req, reply) => {
      const parsed = logoUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
      }
      if (parsed.data.name === undefined && parsed.data.role === undefined) {
        return reply.code(400).send({ error: 'Provide at least name or role.' });
      }
      const updated = await prisma.brandLogo
        .update({
          where: { id: req.params.id },
          data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
          },
          select: { id: true, name: true, role: true, updatedAt: true },
        })
        .catch(() => null);
      if (!updated) return reply.code(404).send({ error: 'Logo not found' });
      reply.send(updated);
    },
  );

  // Delete a logo.
  app.delete<{ Params: { id: string } }>(
    '/company-resources/logos/:id',
    async (req, reply) => {
      const existing = await prisma.brandLogo.findUnique({
        where: { id: req.params.id },
        select: { name: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Logo not found' });
      await prisma.brandLogo.delete({ where: { id: req.params.id } });
      await logAudit({
        actorId: req.user!.sub,
        action: 'DELETE',
        objectType: 'BrandLogo',
        objectId: req.params.id,
        objectName: existing.name,
        ipAddress: extractIp(req),
      });
      reply.send({ ok: true });
    },
  );

  // ──────────────────────────────────────────────────────────────────
  // FONTS
  // ──────────────────────────────────────────────────────────────────

  app.get('/company-resources/fonts', async (_req, reply) => {
    const rows = await prisma.brandFont.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        family: true,
        fileFormat: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    reply.send(rows);
  });

  // Stream font bytes. Content-Type set per file format so the browser can
  // load it into @font-face for preview, and so the PDFKit renderer can
  // pass it to doc.registerFont().
  app.get<{ Params: { id: string } }>(
    '/company-resources/fonts/:id/bytes',
    async (req, reply) => {
      const font = await prisma.brandFont.findUnique({
        where: { id: req.params.id },
        select: { fileFormat: true, data: true, family: true },
      });
      if (!font) return reply.code(404).send({ error: 'Font not found' });
      const mime =
        font.fileFormat.toLowerCase() === 'otf' ? 'font/otf' : 'font/ttf';
      reply
        .header('Content-Type', mime)
        .header('Cache-Control', 'private, max-age=3600')
        .send(font.data);
    },
  );

  app.post('/company-resources/fonts', async (req, reply) => {
    const parsed = fontCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }
    const bytes = decodeBase64(parsed.data.dataBase64);
    if (bytes === null) {
      return reply.code(400).send({ error: 'Invalid base64 in dataBase64' });
    }
    if (bytes.length > MAX_FONT_BYTES) {
      return reply.code(413).send({
        error: `Font too large (${formatBytes(bytes.length)}). Max ${formatBytes(MAX_FONT_BYTES)}.`,
      });
    }
    const created = await prisma.brandFont.create({
      data: {
        name: parsed.data.name,
        family: parsed.data.family,
        fileFormat: parsed.data.fileFormat.toLowerCase(),
        data: bytes,
      },
      select: {
        id: true,
        name: true,
        family: true,
        fileFormat: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    await logAudit({
      actorId: req.user!.sub,
      action: 'CREATE',
      objectType: 'BrandFont',
      objectId: created.id,
      objectName: created.name,
      after: {
        name: created.name,
        family: created.family,
        fileFormat: created.fileFormat,
        bytes: bytes.length,
      } as any,
      ipAddress: extractIp(req),
    });
    reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    '/company-resources/fonts/:id',
    async (req, reply) => {
      const parsed = fontUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
      }
      if (!parsed.data.name && !parsed.data.family) {
        return reply.code(400).send({ error: 'Provide at least name or family.' });
      }
      const updated = await prisma.brandFont
        .update({
          where: { id: req.params.id },
          data: {
            ...(parsed.data.name ? { name: parsed.data.name } : {}),
            ...(parsed.data.family ? { family: parsed.data.family } : {}),
          },
          select: { id: true, name: true, family: true, updatedAt: true },
        })
        .catch(() => null);
      if (!updated) return reply.code(404).send({ error: 'Font not found' });
      reply.send(updated);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/company-resources/fonts/:id',
    async (req, reply) => {
      const existing = await prisma.brandFont.findUnique({
        where: { id: req.params.id },
        select: { name: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Font not found' });
      await prisma.brandFont.delete({ where: { id: req.params.id } });
      await logAudit({
        actorId: req.user!.sub,
        action: 'DELETE',
        objectType: 'BrandFont',
        objectId: req.params.id,
        objectName: existing.name,
        ipAddress: extractIp(req),
      });
      reply.send({ ok: true });
    },
  );

  // ──────────────────────────────────────────────────────────────────
  // COLORS
  // ──────────────────────────────────────────────────────────────────

  app.get('/company-resources/colors', async (_req, reply) => {
    // On first access, seed the brand-guide palette so admins start with the
    // canonical Tischler colors. Idempotent because we only seed when empty.
    const count = await prisma.brandColor.count();
    if (count === 0) {
      await prisma.brandColor.createMany({
        data: BRAND_GUIDE_PALETTE.map((c, i) => ({ ...c, order: i })),
      });
    }
    const rows = await prisma.brandColor.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    reply.send(rows);
  });

  app.post('/company-resources/colors', async (req, reply) => {
    const parsed = colorCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
    }
    const created = await prisma.brandColor.create({
      data: {
        name: parsed.data.name,
        hex: parsed.data.hex.toLowerCase(),
        pantone: parsed.data.pantone ?? null,
        role: parsed.data.role ?? null,
        order: parsed.data.order ?? 0,
      },
    });
    reply.code(201).send(created);
  });

  app.patch<{ Params: { id: string } }>(
    '/company-resources/colors/:id',
    async (req, reply) => {
      const parsed = colorUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'Invalid request', detail: parsed.error.format() });
      }
      const updated = await prisma.brandColor
        .update({
          where: { id: req.params.id },
          data: {
            ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
            ...(parsed.data.hex !== undefined ? { hex: parsed.data.hex.toLowerCase() } : {}),
            ...(parsed.data.pantone !== undefined ? { pantone: parsed.data.pantone } : {}),
            ...(parsed.data.role !== undefined ? { role: parsed.data.role } : {}),
            ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
          },
        })
        .catch(() => null);
      if (!updated) return reply.code(404).send({ error: 'Color not found' });
      reply.send(updated);
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/company-resources/colors/:id',
    async (req, reply) => {
      const existing = await prisma.brandColor.findUnique({
        where: { id: req.params.id },
        select: { name: true },
      });
      if (!existing) return reply.code(404).send({ error: 'Color not found' });
      await prisma.brandColor.delete({ where: { id: req.params.id } });
      reply.send({ ok: true });
    },
  );
}

// ── Brand-guide palette (auto-seeded on first /colors fetch) ──────────
//
// From the Tischler und Sohn USA Ltd Brand Guide 2025. Hex codes match the
// guide exactly; admins can edit / delete / add more after seed.
const BRAND_GUIDE_PALETTE: Array<{ name: string; hex: string; pantone: string; role: string }> = [
  { name: 'Tischler Red',   hex: '#da291c', pantone: 'PMS 485 C',  role: 'emphasis' },
  { name: 'Tischler Navy',  hex: '#151f6d', pantone: 'PMS 2756 C', role: 'primary' },
  { name: 'Tischler Gray',  hex: '#9f9fa2', pantone: 'PMS 422 C',  role: 'muted' },
  { name: 'Off-White',      hex: '#f5f5f4', pantone: 'PMS 663 C',  role: 'background' },
  { name: 'Tischler Dark',  hex: '#293241', pantone: 'PMS 7546 C', role: 'text' },
];

// ── Helpers ───────────────────────────────────────────────────────────

function decodeBase64(input: string): Buffer | null {
  // Strip optional data: URL prefix so the frontend can pass either form.
  const cleaned = input.replace(/^data:[^,]+,/, '');
  try {
    const buf = Buffer.from(cleaned, 'base64');
    if (buf.length === 0) return null;
    return buf;
  } catch {
    return null;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}
