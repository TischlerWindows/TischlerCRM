import { prisma } from '@crm/db/client';

/**
 * Users who should be notified when a new support ticket is submitted.
 * Admins by role OR users whose profile grants manageSupportTickets.
 */
export async function getTicketCreatedRecipients(): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { role: 'ADMIN' },
        {
          profile: {
            is: {
              permissions: { path: ['app', 'manageSupportTickets'], equals: true },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

/**
 * Who should know about activity on an existing ticket:
 *   - the submitter
 *   - the assignee (if any)
 *   - anyone who has already commented
 * Minus the actor (caller excludes themselves).
 */
export async function getTicketParticipantRecipients(ticketId: string): Promise<string[]> {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { submittedById: true, assignedToId: true },
  });
  if (!ticket) return [];

  const commentAuthors = await prisma.ticketComment.findMany({
    where: { ticketId, deletedAt: null },
    select: { authorId: true },
    distinct: ['authorId'],
  });

  const ids = new Set<string>();
  ids.add(ticket.submittedById);
  if (ticket.assignedToId) ids.add(ticket.assignedToId);
  for (const c of commentAuthors) ids.add(c.authorId);
  return Array.from(ids);
}
