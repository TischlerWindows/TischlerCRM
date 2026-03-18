import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { FastifyRequest } from 'fastify';

const SENSITIVE_KEYS = new Set([
  'passwordHash', 'password', 'token', 'refreshToken',
  'secret', 'apiKey', 'api_key', 'creditCard',
]);

function sanitize(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return undefined;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key)) {
      cleaned[key] = '[REDACTED]';
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function extractIp(req: FastifyRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const forwardedStr = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return (forwardedStr ? forwardedStr.split(',')[0].trim() : undefined)
    || req.ip
    || req.socket?.remoteAddress
    || 'unknown';
}

export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE' | 'RESTORE'
  | 'FREEZE' | 'UNFREEZE' | 'RESET_PASSWORD';

export async function logAudit(params: {
  actorId: string;
  action: AuditAction;
  objectType: string;
  objectId: string;
  objectName?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: generateId('AuditLog'),
        actorId: params.actorId,
        action: params.action,
        objectType: params.objectType,
        objectId: params.objectId,
        objectName: params.objectName,
        before: sanitize(params.before) as any,
        after: sanitize(params.after) as any,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error('[Audit] Failed to write audit log:', err);
  }
}
