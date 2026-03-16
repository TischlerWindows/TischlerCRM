import Fastify from 'fastify';
import cors from '@fastify/cors';
import serveStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { authenticate, signJwt, verifyJwt, hashPassword } from './auth';
import { loadEnv } from './config';
import { objectRoutes } from './routes/objects';
import { fieldRoutes } from './routes/fields';
import { layoutRoutes } from './routes/layouts';
import { recordRoutes } from './routes/records';
import { reportRoutes } from './routes/reports';
import { dashboardRoutes } from './routes/dashboards';
import { backupRoutes } from './routes/backup';
import { settingRoutes } from './routes/settings';
import { preferenceRoutes } from './routes/preferences';
import { departmentRoutes } from './routes/departments';
import { usersAdminRoutes } from './routes/users-admin';
import { rolesRoutes } from './routes/roles';
import { auditLogRoutes } from './routes/audit-log';
import { recycleBinRoutes } from './routes/recycle-bin';
import { integrationRoutes } from './routes/integrations';
import { placesRoutes } from './routes/places';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 }); // 10MB body limit for large schema payloads
  app.register(cors, { origin: true });

  // Serve Next.js static files (if built)
  const nextStaticPath = path.join(__dirname, '../../web/.next/static');
  if (fs.existsSync(nextStaticPath)) {
    app.register(serveStatic, {
      root: nextStaticPath,
      prefix: '/_next/static/',
    });
  }

  // Health check endpoint for Railway
  app.get('/health', async () => ({ ok: true, version: '2026-03-09-v8-summary-perms' }));

  // Auth: signup
  app.post('/auth/signup', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return reply.code(409).send({ error: 'Email already registered' });

    try {
      const passwordHash = hashPassword(parsed.data.password);
      const user = await prisma.user.create({
        data: {
          email: parsed.data.email,
          name: parsed.data.name,
          passwordHash,
          role: 'USER',
        },
      });

      const env = loadEnv();
      const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 24 * 7);

      return reply.code(201).send({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (err) {
      app.log.error(err);
      return reply.code(500).send({ error: 'Signup failed' });
    }
  });

  // Auth: login -> JWT
  app.post('/auth/login', async (req, reply) => {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      accountId: z.string().uuid().optional().nullable(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 24 * 7);
    const forwardedFor = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ip = (forwardedIp ? forwardedIp.split(',')[0].trim() : undefined) || req.ip || req.socket?.remoteAddress || 'unknown';
    const userAgent = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : null;
    await prisma.loginEvent.create({
      data: {
        userId: user.id,
        accountId: parsed.data.accountId ?? null,
        ip,
        userAgent,
      },
    });
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  // Security: login history (admin-only)
  app.get('/security/login-events', async (req, reply) => {
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions' });
    }
    const querySchema = z.object({
      accountId: z.string().uuid().optional(),
      take: z.coerce.number().int().min(1).max(500).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const events = await prisma.loginEvent.findMany({
      where: parsed.data.accountId ? { accountId: parsed.data.accountId } : undefined,
      take: parsed.data.take ?? 100,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    });
    reply.send(events);
  });

  // Auth guard hook
  app.addHook('onRequest', async (req, reply) => {
    if (req.routerPath && req.routerPath.startsWith('/auth')) return;
    if (req.routerPath === '/health') return;
    if (req.routerPath === '/places/static-map') return; // auth handled in route via query token
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    const token = auth.slice('Bearer '.length).trim();
    const env = loadEnv();
    const payload = verifyJwt(token, env.JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'Invalid token' });
    req.user = payload as any;
  });

  // ── Current user's effective permissions ──
  app.get('/me/permissions', async (req, reply) => {
    const userId = req.user!.sub;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        orgRole: true,
      },
    });
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const deptRaw = (user.department?.permissions as any) || {};
    const isAdminDept = !!deptRaw.isAdmin;
    const deptObjPerms: Record<string, Record<string, boolean>> = deptRaw.objectPermissions || {};
    const deptAppPerms: Record<string, boolean> = deptRaw.appPermissions || {};

    const grantedObjPerms: Record<string, Record<string, boolean>> = {};
    const grantedAppPerms: Record<string, boolean> = {};

    // Role grants (replaces old Profile grants)
    const rolePerms = (user.orgRole?.permissions as any) || {};
    if (rolePerms.objectPermissions) {
      for (const [obj, perms] of Object.entries(rolePerms.objectPermissions as Record<string, Record<string, boolean>>)) {
        if (!grantedObjPerms[obj]) grantedObjPerms[obj] = {};
        for (const [action, granted] of Object.entries(perms)) {
          if (granted) grantedObjPerms[obj][action] = true;
        }
      }
    }
    if (rolePerms.appPermissions) {
      for (const [perm, granted] of Object.entries(rolePerms.appPermissions as Record<string, boolean>)) {
        if (granted) grantedAppPerms[perm] = true;
      }
    }

    // Merge: department restrictions are the CEILING.
    const objectPerms: Record<string, Record<string, boolean>> = {};
    const allObjKeys = new Set([...Object.keys(deptObjPerms), ...Object.keys(grantedObjPerms)]);
    for (const obj of allObjKeys) {
      objectPerms[obj] = {};
      const deptObj = deptObjPerms[obj] || {};
      const grantedObj = grantedObjPerms[obj] || {};
      const allActions = new Set([...Object.keys(deptObj), ...Object.keys(grantedObj)]);
      for (const action of allActions) {
        if (user.department && obj in deptObjPerms && action in deptObj && !deptObj[action]) {
          objectPerms[obj][action] = false;
        } else {
          objectPerms[obj][action] = !!(deptObj[action] || grantedObj[action]);
        }
      }
    }

    const appPerms: Record<string, boolean> = {};
    const allAppKeys = new Set([...Object.keys(deptAppPerms), ...Object.keys(grantedAppPerms)]);
    for (const perm of allAppKeys) {
      if (user.department && perm in deptAppPerms && !deptAppPerms[perm]) {
        appPerms[perm] = false;
      } else {
        appPerms[perm] = !!(deptAppPerms[perm] || grantedAppPerms[perm]);
      }
    }

    if (isAdminDept || user.role === 'ADMIN') {
      const allActions = ['read', 'create', 'edit', 'delete', 'viewAll', 'modifyAll'];
      const customObjects = await prisma.customObject.findMany({ select: { apiName: true } });
      for (const obj of customObjects) {
        objectPerms[obj.apiName] = Object.fromEntries(allActions.map(a => [a, true]));
      }
      const allAppPermKeys = ['manageUsers', 'manageRoles', 'manageDepartments', 'exportData', 'importData', 'manageReports', 'manageDashboards', 'viewSummary', 'viewSetup', 'customizeApplication', 'manageSharing', 'viewAllData', 'modifyAllData'];
      for (const p of allAppPermKeys) {
        appPerms[p] = true;
      }
    }

    let homePageLayout: any = null;
    const homePageLayoutId = deptRaw.homePageLayoutId;
    if (homePageLayoutId) {
      try {
        const templatesSetting = await prisma.setting.findUnique({ where: { key: 'homeLayoutTemplates' } });
        if (templatesSetting) {
          const templates = templatesSetting.value as any[];
          const tpl = templates.find((t: any) => t.id === homePageLayoutId);
          if (tpl?.layout) homePageLayout = tpl.layout;
        }
      } catch { /* ignore */ }
    }

    reply.send({
      userId,
      departmentName: user.department?.name || null,
      roleName: user.orgRole?.label || null,
      role: user.role,
      objectPermissions: objectPerms,
      appPermissions: appPerms,
      homePageLayout,
    });
  });

  // Admin route guard — enforce crm-security Pillar 4
  app.addHook('onRequest', async (req, reply) => {
    if (!req.routerPath?.startsWith('/admin')) return;
    if (!req.user || req.user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Insufficient permissions.' });
    }
  });

  // Register API routes
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
  app.register(rolesRoutes);
  app.register(auditLogRoutes);
  app.register(recycleBinRoutes);
  app.register(integrationRoutes);
  app.register(placesRoutes);

  return app;
}
