// TischlerCRM API — v2026.04.20
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import serveStatic from '@fastify/static';
import qs from 'qs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import { authenticate, signJwt, verifyJwt, hashPassword, verifyPassword } from './auth.js';
import { logAudit, extractIp } from './audit.js';
import { loadEnv } from './config.js';
import * as notifications from './notifications.js';
import { objectRoutes } from './routes/objects.js';
import { fieldRoutes } from './routes/fields.js';
import { layoutRoutes } from './routes/layouts.js';
import { recordRoutes } from './routes/records.js';
import { reportRoutes } from './routes/reports.js';
import { dashboardRoutes } from './routes/dashboards.js';
import { backupRoutes } from './routes/backup.js';
import { settingRoutes } from './routes/settings.js';
import { preferenceRoutes } from './routes/preferences.js';
import { departmentRoutes } from './routes/departments.js';
import { usersAdminRoutes } from './routes/users-admin.js';
import { profilesRoutes } from './routes/profiles.js';
import { auditLogRoutes } from './routes/audit-log.js';
import { recycleBinRoutes } from './routes/recycle-bin.js';
import { integrationRoutes } from './routes/integrations.js';
import { placesRoutes } from './routes/places.js';
import { widgetRoutes } from './routes/widgets.js';
import { externalWidgetRouteModules } from './widgets/external/registry.js';
import { automationRoutes } from './routes/automations.js';
import { controllerRegistrations } from './controllers/registry.js';
import { dropboxRoutes } from './routes/dropbox.js';
import { errorLogRoutes } from './routes/error-log.js';
import { outlookRoutes } from './routes/outlook.js';
import { ticketRoutes } from './routes/tickets.js';
import { notificationRoutes } from './routes/notifications.js';
import { initNotificationListener } from './lib/notifications/listen-manager.js';
import { supportTicketConfigRoutes } from './routes/support-ticket-config.js';
import { seedCategoriesIfMissing } from './lib/support-tickets/categories.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Simple in-memory rate limiter (resets on restart) ─────────────────────
// TODO (M-1): replace with @fastify/rate-limit + Redis before horizontal scaling
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

function getFrontendUrl(): string {
  // M-4: use dedicated FRONTEND_URL; fall back to stripping /api from NEXT_PUBLIC_API_URL
  return (
    process.env.FRONTEND_URL ??
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api\/?$/, '')
  );
}

function buildInviteUrl(inviteToken: string): string {
  return `${getFrontendUrl()}/auth/accept-invite?token=${inviteToken}`;
}

export function buildApp() {
  // H-1: bodyLimit — the settings endpoint stores the full OrgSchema as a single
  // JSON blob which can easily reach several MB with many objects/layouts.
  const app = Fastify({
    logger: true,
    bodyLimit: 10 * 1024 * 1024,
    querystringParser: (str) => qs.parse(str),
  });

  // H-2: security headers — must be registered before CORS
  app.register(helmet, { contentSecurityPolicy: false });

  // H-3: explicit CORS origin whitelist — never reflect arbitrary origins
  const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  // Always allow the known Railway frontend URL
  const railwayFrontend = 'https://tischlercrm.up.railway.app';
  if (!allowedOrigins.includes(railwayFrontend)) {
    allowedOrigins.push(railwayFrontend);
  }
  app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Allow raw binary uploads (used by Dropbox file upload)
  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  // Serve Next.js static files (if built)
  const nextStaticPath = path.join(__dirname, '../../web/.next/static');
  if (fs.existsSync(nextStaticPath)) {
    app.register(serveStatic, {
      root: nextStaticPath,
      prefix: '/_next/static/',
    });
  }

  // ── Health check ──────────────────────────────────────────────────────────
  app.get('/health', async () => ({ ok: true, version: '2026-03-24-v4' }));

  // ── Auth: login ───────────────────────────────────────────────────────────
  app.post('/auth/login', async (req, reply) => {
    // C-3: rate-limit login attempts per IP
    const ip = extractIp(req);
    if (!checkRateLimit(`login:${ip}`, 10, 15 * 60 * 1000)) {
      return reply.status(429).send({ error: 'Too many requests. Try again later.' });
    }
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1),
      accountId: z.string().min(1).optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const user = await authenticate(parsed.data.email, parsed.data.password);
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;

    if (!user) {
      // Record failed login attempt if user exists
      const userByEmail = await prisma.user.findFirst({
        where: { email: parsed.data.email.toLowerCase() },
      });
      if (userByEmail) {
        await prisma.loginEvent.create({
          data: {
            id: generateId('LoginEvent'),
            userId: userByEmail.id,
            ip,
            userAgent,
            success: false,
          },
        }).catch(() => {});
      }
      return reply.code(401).send({ error: 'Invalid credentials' });
    }

    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);

    await prisma.loginEvent.create({
      data: {
        id: generateId('LoginEvent'),
        userId: user.id,
        accountId: parsed.data.accountId ?? null,
        ip,
        userAgent,
        success: true,
      },
    });

    // `profileId` is required by the client-side page-layout resolver
    // (apps/web/lib/layout-resolver.ts) to match the current user against
    // `layout.roles`. Keep it in sync across accept-invite / reset / impersonate
    // response shapes so the resolver has a consistent profile to match on.
    const response: Record<string, unknown> = {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        profileId: user.profileId ?? null,
      },
    };
    if (user.mustChangePassword) {
      response.mustChangePassword = true;
    }
    return reply.send(response);
  });

  // ── Auth: accept invite ───────────────────────────────────────────────────
  app.post('/auth/accept-invite', async (req, reply) => {
    const ip = extractIp(req);
    if (!checkRateLimit(`accept-invite:${ip}`, 10, 15 * 60 * 1000)) {
      return reply.status(429).send({ error: 'Too many requests. Try again later.' });
    }

    const body = z.object({ token: z.string().min(1), password: z.string().min(8).max(128) }).parse(req.body);
    const user = await prisma.user.findFirst({
      where: { inviteToken: body.token, inviteTokenExpiry: { gt: new Date() }, deletedAt: null },
    });
    if (!user) return reply.status(400).send({ error: 'This invite link is invalid or has expired.' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(body.password),
        inviteToken: null,
        inviteTokenExpiry: null,
        inviteSentAt: null,
        inviteAcceptedAt: new Date(),
        isActive: true,
      },
    });

    await logAudit({
      actorId: user.id,
      action: 'UPDATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name ?? user.email,
      after: { event: 'invite_accepted' } as any,
      ipAddress: ip,
    });

    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);
    return reply.send({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, profileId: user.profileId ?? null } });
  });

  // ── Auth: forgot password ─────────────────────────────────────────────────
  app.post('/auth/forgot-password', async (req, reply) => {
    const ip = extractIp(req);
    if (!checkRateLimit(`forgot-password:${ip}`, 5, 15 * 60 * 1000)) {
      return reply.status(429).send({ error: 'Too many requests. Try again later.' });
    }

    const body = z.object({ email: z.string().email() }).parse(req.body);
    // Always respond immediately to prevent email enumeration
    reply.send({ success: true });

    // Fire-and-forget
    (async () => {
      const user = await prisma.user.findFirst({
        where: { email: body.email.toLowerCase(), deletedAt: null },
      });
      if (!user) return;

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordResetToken: resetToken, passwordResetTokenExpiry: resetExpiry },
      });

      const resetUrl = `${getFrontendUrl()}/auth/reset-password?token=${resetToken}`;
      await notifications.sendPasswordResetEmail(user, resetUrl);
    })().catch(err => app.log.error(err));
  });

  // ── Auth: reset password ──────────────────────────────────────────────────
  app.post('/auth/reset-password', async (req, reply) => {
    const ip = extractIp(req);
    if (!checkRateLimit(`reset-password:${ip}`, 10, 15 * 60 * 1000)) {
      return reply.status(429).send({ error: 'Too many requests. Try again later.' });
    }

    const body = z.object({ token: z.string().min(1), password: z.string().min(8).max(128) }).parse(req.body);
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: body.token, passwordResetTokenExpiry: { gt: new Date() }, deletedAt: null },
    });
    if (!user) return reply.status(400).send({ error: 'This reset link is invalid or has expired.' });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(body.password),
        passwordResetToken: null,
        passwordResetTokenExpiry: null,
      },
    });

    await logAudit({
      actorId: user.id,
      action: 'UPDATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name ?? user.email,
      after: { event: 'password_reset' } as any,
      ipAddress: ip,
    });

    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);
    return reply.send({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, profileId: user.profileId ?? null } });
  });

  // ── Auth: change password (requires valid JWT) ────────────────────────────
  app.post('/auth/change-password', async (req, reply) => {
    const ip = extractIp(req);
    if (!checkRateLimit(`change-password:${ip}`, 10, 15 * 60 * 1000)) {
      return reply.code(429).send({ error: 'Too many requests. Try again later.' });
    }

    // Manual auth check since /auth/* routes bypass the onRequest hook
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    const env = loadEnv();
    const payload = verifyJwt(auth.slice('Bearer '.length).trim(), env.JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'Invalid token' });

    const body = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'Current password and new password (min 8 chars) are required.' });

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, passwordHash: true, mustChangePassword: true, isActive: true, deletedAt: true },
    });
    if (!user || !user.passwordHash || !user.isActive || user.deletedAt) {
      return reply.code(400).send({ error: 'Cannot change password for this account.' });
    }

    if (!verifyPassword(body.data.currentPassword, user.passwordHash)) {
      return reply.code(401).send({ error: 'Current password is incorrect.' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashPassword(body.data.newPassword),
        mustChangePassword: false,
      },
    });

    await logAudit({
      actorId: user.id,
      action: 'UPDATE',
      objectType: 'User',
      objectId: user.id,
      objectName: user.name ?? user.email,
      after: { event: 'password_changed' } as any,
      ipAddress: ip,
    });

    return reply.send({ success: true });
  });

  // ── Security: login history (admin-only) ──────────────────────────────────
  app.get('/security/login-events', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
    const querySchema = z.object({
      userId:    z.string().min(1).optional(),
      accountId: z.string().min(1).optional(),
      take:      z.coerce.number().int().min(1).max(500).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const userId = parsed.data.userId ?? parsed.data.accountId;
    const events = await prisma.loginEvent.findMany({
      where: userId ? { userId } : undefined,
      take: parsed.data.take ?? 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    });
    return reply.send(events);
  });

  // ── Auth guard hook ───────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    const routeUrl = req.routeOptions?.url;
    // <img src=".../places/static-map?..."> has no Authorization header; the handler
    // accepts token in the query. Use raw URL pathname so we always bypass Bearer
    // auth even if routeOptions.url is unset in edge cases.
    const pathOnly = (req.url ?? '').split('?')[0] ?? '';
    if (pathOnly === '/places/static-map' || routeUrl === '/places/static-map') return;
    // SSE notification stream accepts auth via query-param token (EventSource
    // cannot set Authorization). The route handler verifies it itself.
    if (pathOnly === '/me/notifications/stream' || routeUrl === '/me/notifications/stream') return;

    if (routeUrl?.startsWith('/auth')) return;
    if (routeUrl === '/health') return;
    if (routeUrl === '/admin/backup/scheduled' && req.headers['x-cron-secret']) return;
    if (routeUrl === '/dropbox/callback') return;

    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    const bearerToken = auth.slice('Bearer '.length).trim();
    const env = loadEnv();
    const payload = verifyJwt(bearerToken, env.JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'Invalid token' });

    // C-2: verify the account is still active on every request so freeze/delete
    // takes effect immediately without waiting for the JWT to expire
    const account = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { isActive: true, deletedAt: true, mustChangePassword: true },
    });
    if (!account || !account.isActive || account.deletedAt) {
      return reply.code(401).send({ error: 'Account is inactive or has been removed.' });
    }
    if (account.mustChangePassword && routeUrl !== '/auth/change-password') {
      return reply.code(403).send({ error: 'Password change required', code: 'MUST_CHANGE_PASSWORD' });
    }

    req.user = payload as any;
  });

  // ── Current user's effective permissions ─────────────────────────────────
  app.get('/me/permissions', async (req, reply) => {
    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const OBJECTS = ['leads','opportunities','projects','service','quotes','installations','properties','contacts','companies','products'];
    const APP_KEYS = [
      'manageUsers','manageProfiles','manageDepartments','manageIntegrations','manageCompanySettings',
      'exportData','importData',
      'viewReports','manageReports','manageDashboards',
      'viewSummary','viewSetup','viewAuditLog',
      'customizeApplication','viewAllData','modifyAllData',
      'manageSupportTickets',
    ];

    // ADMIN users get full access regardless of profile
    if (user.role === 'ADMIN') {
      return reply.send({
        objects: Object.fromEntries(OBJECTS.map(o => [o, { create:true, read:true, edit:true, delete:true, viewAll:true, modifyAll:true }])),
        app: Object.fromEntries(APP_KEYS.map(k => [k, true])),
      });
    }

    return reply.send(user.profile?.permissions ?? {});
  });

  // ── Admin route guard ─────────────────────────────────────────────────────
  app.addHook('onRequest', async (req, reply) => {
    if (!req.routeOptions?.url?.startsWith('/admin')) return;
    if (req.routeOptions?.url === '/admin/backup/scheduled' && req.headers['x-cron-secret']) {
      const env = loadEnv();
      if (env.BACKUP_CRON_SECRET && req.headers['x-cron-secret'] === env.BACKUP_CRON_SECRET) return;
    }
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
  });

  // ── Register API routes ───────────────────────────────────────────────────
  app.register(objectRoutes);
  app.register(fieldRoutes);
  app.register(layoutRoutes);
  app.register(recordRoutes);
  app.register(reportRoutes);
  app.register(dashboardRoutes);
  app.register(backupRoutes);
  app.register(settingRoutes);
  app.register(preferenceRoutes);
  app.register(departmentRoutes);
  app.register(usersAdminRoutes);
  app.register(profilesRoutes);
  app.register(auditLogRoutes);
  app.register(recycleBinRoutes);
  app.register(integrationRoutes);
  app.register(placesRoutes);
  app.register(widgetRoutes);
  app.register(dropboxRoutes);
  app.register(errorLogRoutes);
  app.register(outlookRoutes);
  app.register(ticketRoutes);
  app.register(notificationRoutes);
  app.register(supportTicketConfigRoutes);
  app.register(automationRoutes);

  // Start the Postgres LISTEN connection so notify() events broadcast
  // from any process reach SSE subscribers on this process.
  initNotificationListener().catch((err) => {
    app.log.error({ err }, 'Failed to initialize notification listener');
  });

  // Seed the default ticket categories if the Setting row is missing.
  // Idempotent: never overwrites admin edits.
  seedCategoriesIfMissing().catch((err) => {
    app.log.error({ err }, 'Failed to seed default ticket categories');
  });

  // Register per-widget server-side route modules under /api/widgets/:widgetId/
  for (const { widgetId, registerRoutes } of externalWidgetRouteModules) {
    app.register(
      async (instance) => { await registerRoutes(instance) },
      { prefix: `/widgets/${widgetId}` }
    );
  }

  // Register per-controller server-side route modules
  for (const { manifest, registerRoutes } of controllerRegistrations) {
    app.register(
      async (instance) => { await registerRoutes(instance) },
      { prefix: manifest.routePrefix }
    );
  }

  // Populate widgetContext for widget routes
  app.decorateRequest('widgetContext', null);
  app.addHook('preHandler', async (request) => {
    const pathOnly = (request.url ?? '').split('?')[0] ?? '';
    if (!pathOnly.startsWith('/widgets/') || pathOnly === '/widgets') return;
    const widgetId = pathOnly.split('/')[2];
    const user = (request as any).user;
    if (!user || !widgetId) return;
    (request as any).widgetContext = {
      orgId: user.sub,
      userId: user.sub,
      integrationToken: null,
    };
  });

  return app;
}
