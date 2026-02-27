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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function buildApp() {
  const app = Fastify({ logger: true });
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
  app.get('/health', async () => ({ ok: true }));

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
      const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);

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
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);
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

  // Security: login history
  app.get('/security/login-events', async (req, reply) => {
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
    if (req.routerPath && req.routerPath.startsWith('/auth')) return; // allow auth routes
    if (req.routerPath === '/health') return;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    const token = auth.slice('Bearer '.length).trim();
    const env = loadEnv();
    const payload = verifyJwt(token, env.JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'Invalid token' });
    (req as any).user = payload; // attach user payload
  });

  // Accounts CRUD (minimal)
  app.get('/accounts', async (req, reply) => {
    const accounts = await prisma.account.findMany({ take: 50, orderBy: { createdAt: 'desc' } });
    reply.send(accounts);
  });

  const accountSchema = z.object({ name: z.string().min(1), domain: z.string().optional().nullable(), ownerId: z.string().uuid() });
  app.post('/accounts', async (req, reply) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const created = await prisma.account.create({ data: parsed.data });
    reply.code(201).send(created);
  });

  const accountUpdate = accountSchema.partial();
  app.put('/accounts/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    const parsed = accountUpdate.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const updated = await prisma.account.update({ where: { id }, data: parsed.data });
    reply.send(updated);
  });

  app.delete('/accounts/:id', async (req, reply) => {
    const id = (req.params as any).id as string;
    await prisma.account.delete({ where: { id } });
    reply.code(204).send();
  });

  // Register new API routes
  app.register(objectRoutes);
  app.register(fieldRoutes);
  app.register(layoutRoutes);
  app.register(recordRoutes);
  app.register(reportRoutes);
  app.register(dashboardRoutes);

  return app;
}
