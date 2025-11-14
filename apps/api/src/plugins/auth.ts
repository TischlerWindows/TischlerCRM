import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate, signToken, verifyToken } from '../auth';
import { loadEnv } from '../config';

export async function authPlugin(app: FastifyInstance) {
  const env = loadEnv();

  app.post('/auth/login', async (req, reply) => {
    const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: 'Invalid payload' });
    const user = await authenticate(parsed.data.email, parsed.data.password);
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' });
    const token = signToken({ sub: user.id, role: user.role }, env.JWT_SECRET);
    return reply.send({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });

  // Auth guard (preHandler on protected routes) - here we add a hook after login route defined
  app.addHook('onRequest', async (req, reply) => {
    const url = req.url;
    if (url.startsWith('/auth/') || url === '/health') return;
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Missing bearer token' });
    }
    const token = auth.slice('Bearer '.length);
    const payload = verifyToken(token, env.JWT_SECRET);
    if (!payload) return reply.code(401).send({ error: 'Invalid token' });
    (req as any).user = payload;
  });
}
