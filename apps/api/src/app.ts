import Fastify from 'fastify';
import cors from '@fastify/cors';
import { prisma } from '@crm/db/client';
import { z } from 'zod';
import { authenticate, signJwt, verifyJwt } from './auth';
import { loadEnv } from './config';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.register(cors, { origin: true });

  app.get('/health', async () => ({ ok: true }));

  // Auth: login -> JWT
  app.post('/auth/login', async (req, reply) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
    const env = loadEnv();
    const token = signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET, 60 * 60 * 8);
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
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

  return app;
}
