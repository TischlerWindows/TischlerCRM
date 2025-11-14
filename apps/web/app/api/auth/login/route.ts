import { NextRequest } from 'next/server';
import { prisma } from '@crm/db/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

function logDebug(label: string, data?: any) {
  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log(`[auth-login:${label}]`, typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    } catch {
      console.log(`[auth-login:${label}]`, data);
    }
  }
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  try {
    logDebug('DATABASE_URL', process.env.DATABASE_URL);
    const body = await req.json();
    logDebug('payload', body);
    const { email, password } = body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 });
    }
    // Quick prisma connectivity probe
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (probeErr: any) {
      logDebug('prisma-probe-error', { message: probeErr.message, stack: probeErr.stack });
      return new Response(JSON.stringify({ error: 'Database unavailable', detail: probeErr.message }), { status: 500 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    logDebug('user-lookup', { found: !!user, hasPasswordHash: !!user?.passwordHash });
    if (!user || !user.passwordHash) {
      logDebug('no-user-or-hash', { user: !!user, passwordHash: !!user?.passwordHash });
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }
    logDebug('stored-hash', { hash: user.passwordHash, hashPrefix: user.passwordHash.substring(0, 10) });
    
    // Test by creating a fresh hash
    const testHash = await bcrypt.hash(password, 10);
    logDebug('fresh-hash', { hash: testHash, prefix: testHash.substring(0, 10) });
    const testCompare = await bcrypt.compare(password, testHash);
    logDebug('fresh-compare', { result: testCompare });
    
    const ok = await bcrypt.compare(password, user.passwordHash);
    logDebug('password-compare', { ok, providedPassword: password, hashLength: user.passwordHash.length });
    if (!ok) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }
    const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    const response = { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
    logDebug('success', { durationMs: Date.now() - start, userId: user.id });
    return new Response(JSON.stringify(response), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err: any) {
    logDebug('fatal-error', { message: err.message, stack: err.stack });
    return new Response(JSON.stringify({ error: 'Server error', detail: err.message }), { status: 500 });
  }
}
