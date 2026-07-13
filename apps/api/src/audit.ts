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

// ── Deleted-user placeholder ────────────────────────────────────────────
// AuditLog.actorId is a required, non-cascading FK (audit rows must never
// lose their actor), so a user with any audit history can't be permanently
// deleted outright. Instead, their historical audit rows are reassigned to
// this singleton system account before the delete, so the record shows
// "Deleted User" instead of blocking the delete. Fixed well-known id (not a
// random generateId()) so every caller reassigns to/recognizes the same row.
// Not soft-deleted (deletedAt stays null) so it never shows up in the
// Recycle Bin; isActive: false + excluded by id from the admin Users list
// (see users-admin.ts) so it never shows up as a real, assignable user.
export const DELETED_USER_PLACEHOLDER_ID = '011000000000000';

export async function getOrCreateDeletedUserPlaceholder(): Promise<{ id: string }> {
  return prisma.user.upsert({
    where: { id: DELETED_USER_PLACEHOLDER_ID },
    update: {},
    create: {
      id: DELETED_USER_PLACEHOLDER_ID,
      email: 'deleted-user@system.local',
      name: 'Deleted User',
      role: 'USER',
      isActive: false,
    },
    select: { id: true },
  });
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
