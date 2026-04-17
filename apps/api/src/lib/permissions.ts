import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@crm/db/client';

export async function canManageTickets(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || user.deletedAt) return false;
  if (user.role === 'ADMIN') return true;
  const perms = (user.profile?.permissions ?? {}) as {
    app?: Record<string, boolean>;
  };
  return perms.app?.manageSupportTickets === true;
}

/**
 * Guard helper: returns true if the caller can admin tickets. On failure it
 * responds with a 403 and returns false so the handler can early-return.
 */
export async function requireTicketAdmin(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const userId = req.user?.sub;
  if (!userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return false;
  }
  if (req.user?.role === 'ADMIN') return true;
  const ok = await canManageTickets(userId);
  if (!ok) {
    reply.code(403).send({ error: 'Insufficient permissions' });
    return false;
  }
  return true;
}
