import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { z } from 'zod';
import { logAudit, extractIp } from '../audit.js';
import { canManageTickets, requireTicketAdmin } from '../lib/permissions.js';
import { sendSupportTicketAlertEmail } from '../notifications.js';
import { notify } from '../lib/notifications/notify.js';
import {
  getTicketCreatedRecipients,
  getTicketParticipantRecipients,
} from '../lib/notifications/ticket-recipients.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getFrontendUrl(): string {
  return (
    process.env.FRONTEND_URL ??
    (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/api\/?$/, '')
  );
}

const STATUS_VALUES = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_USER', 'RESOLVED', 'CLOSED'] as const;
const PRIORITY_VALUES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
const CATEGORY_VALUES = ['UNTRIAGED', 'CRM_ISSUE', 'IT_ISSUE', 'FEATURE_REQUEST', 'QUESTION'] as const;

type Status = (typeof STATUS_VALUES)[number];

// Policy: CLOSED tickets must be explicitly REOPENED — the frontend sends
// a status change from CLOSED back to OPEN, which we accept and emit
// REOPENED instead of STATUS_CHANGED.
function validateStatusTransition(from: Status, to: Status): { ok: true } | { ok: false; error: string } {
  if (from === to) return { ok: true };
  if (from === 'CLOSED' && to !== 'OPEN') {
    return { ok: false, error: 'Closed tickets can only be reopened (to OPEN).' };
  }
  return { ok: true };
}

async function loadTicketForReply(ticketId: string) {
  return prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      attachments: {
        orderBy: { createdAt: 'asc' },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      errorLogs: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          message: true,
          url: true,
          createdAt: true,
          source: true,
        },
      },
    },
  });
}

async function assertCanReadTicket(
  req: FastifyRequest,
  reply: FastifyReply,
  ticketId: string,
): Promise<{ ticketId: string; isAdmin: boolean; userId: string } | null> {
  const userId = req.user?.sub;
  if (!userId) {
    reply.code(401).send({ error: 'Unauthorized' });
    return null;
  }
  const isAdmin = req.user?.role === 'ADMIN' || (await canManageTickets(userId));
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: ticketId, deletedAt: null },
    select: { submittedById: true },
  });
  if (!ticket) {
    reply.code(404).send({ error: 'Ticket not found' });
    return null;
  }
  if (!isAdmin && ticket.submittedById !== userId) {
    reply.code(404).send({ error: 'Ticket not found' });
    return null;
  }
  return { ticketId, isAdmin, userId };
}

/* ------------------------------------------------------------------ */
/*  Routes                                                             */
/* ------------------------------------------------------------------ */

export async function ticketRoutes(app: FastifyInstance) {
  /* ---------- POST /tickets — create ---------- */
  app.post('/tickets', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const schema = z.object({
      title: z.string().min(1).max(200),
      description: z.string().min(1).max(20000),
      sessionId: z.string().max(128).optional(),
      errorLogIds: z.array(z.string().max(64)).max(50).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const { title, description, sessionId, errorLogIds } = parsed.data;

    const ticket = await prisma.supportTicket.create({
      data: {
        id: generateId('SupportTicket'),
        title,
        description,
        submittedById: userId,
        sessionId,
      },
      include: {
        submittedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Initial event
    await prisma.ticketEvent.create({
      data: {
        id: generateId('TicketEvent'),
        ticketId: ticket.id,
        actorId: userId,
        type: 'CREATED',
      },
    });

    // Attach error logs if provided (only logs owned by the submitter or matching sessionId)
    if (errorLogIds && errorLogIds.length > 0) {
      const attachable = await prisma.errorLog.findMany({
        where: {
          id: { in: errorLogIds },
          OR: [{ userId }, ...(sessionId ? [{ sessionId }] : [])],
          ticketId: null,
        },
        select: { id: true },
      });
      if (attachable.length > 0) {
        await prisma.errorLog.updateMany({
          where: { id: { in: attachable.map((e) => e.id) } },
          data: { ticketId: ticket.id },
        });
        for (const err of attachable) {
          await prisma.ticketEvent.create({
            data: {
              id: generateId('TicketEvent'),
              ticketId: ticket.id,
              actorId: userId,
              type: 'ERROR_LOG_ATTACHED',
              payload: { errorLogId: err.id },
            },
          });
        }
      }
    }

    await logAudit({
      actorId: userId,
      action: 'CREATE',
      objectType: 'SupportTicket',
      objectId: ticket.id,
      objectName: `#T-${ticket.ticketNumber} ${ticket.title}`,
      after: { title: ticket.title, status: ticket.status, priority: ticket.priority },
      ipAddress: extractIp(req),
    });

    // Fire-and-forget admin email notification (never blocks creation)
    (async () => {
      try {
        const admins = await prisma.user.findMany({
          where: {
            deletedAt: null,
            isActive: true,
            OR: [
              { role: 'ADMIN' },
              { profile: { is: { permissions: { path: ['app', 'manageSupportTickets'], equals: true } } } },
            ],
          },
          select: { id: true, name: true, email: true },
        });
        const submitterName = ticket.submittedBy?.name ?? ticket.submittedBy?.email ?? 'A user';
        const url = `${getFrontendUrl()}/support/tickets/${ticket.id}`;
        const preview = ticket.description.slice(0, 240) + (ticket.description.length > 240 ? '…' : '');
        for (const admin of admins) {
          if (admin.id === userId) continue; // don't email the submitter if they're also an admin
          await sendSupportTicketAlertEmail(admin, {
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            descriptionPreview: preview,
            submitterName,
            url,
          });
        }
      } catch (err) {
        app.log.error({ err }, 'Failed to send support-ticket alert emails');
      }
    })();

    // In-app notification fan-out — separate from the email path above so
    // users get both the one-time email and a bell-icon ping. notify()
    // swallows its own errors so the ticket create succeeds either way.
    (async () => {
      const recipients = await getTicketCreatedRecipients();
      const submitterName = ticket.submittedBy?.name ?? ticket.submittedBy?.email ?? 'Someone';
      await notify(
        {
          recipientIds: recipients,
          kind: 'ticket.created',
          subjectType: 'SupportTicket',
          subjectId: ticket.id,
          title: `New ticket #T-${String(ticket.ticketNumber).padStart(5, '0')}: ${ticket.title}`,
          body: `Submitted by ${submitterName}`,
          linkUrl: `/support/tickets/${ticket.id}`,
          actorId: userId,
        },
        app.log,
      );
    })();

    const full = await loadTicketForReply(ticket.id);
    return reply.code(201).send(full);
  });

  /* ---------- GET /tickets — list ---------- */
  app.get('/tickets', async (req, reply) => {
    const userId = req.user?.sub;
    if (!userId) return reply.code(401).send({ error: 'Unauthorized' });

    const isAdmin = req.user?.role === 'ADMIN' || (await canManageTickets(userId));

    const querySchema = z.object({
      status: z.enum(STATUS_VALUES).optional(),
      category: z.enum(CATEGORY_VALUES).optional(),
      priority: z.enum(PRIORITY_VALUES).optional(),
      assignedToId: z.string().optional(),
      mine: z.coerce.boolean().optional(),
      q: z.string().max(200).optional(),
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const { status, category, priority, assignedToId, mine, q } = parsed.data;
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.pageSize ?? 25;

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (assignedToId) where.assignedToId = assignedToId;
    if (q) where.title = { contains: q, mode: 'insensitive' };

    // Non-admins are always restricted to their own tickets
    if (!isAdmin) {
      where.submittedById = userId;
    } else if (mine) {
      where.submittedById = userId;
    }

    const [total, items] = await Promise.all([
      prisma.supportTicket.count({ where }),
      prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          submittedBy: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true, attachments: true } },
        },
      }),
    ]);

    return reply.send({
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  });

  /* ---------- GET /tickets/:id ---------- */
  app.get('/tickets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await assertCanReadTicket(req, reply, id);
    if (!ctx) return;
    const full = await loadTicketForReply(id);
    if (!full) return reply.code(404).send({ error: 'Ticket not found' });
    return reply.send(full);
  });

  /* ---------- PATCH /tickets/:id — admin-only field updates ---------- */
  app.patch('/tickets/:id', async (req, reply) => {
    if (!(await requireTicketAdmin(req, reply))) return;
    const userId = req.user!.sub;
    const { id } = req.params as { id: string };

    const schema = z
      .object({
        status: z.enum(STATUS_VALUES).optional(),
        priority: z.enum(PRIORITY_VALUES).optional(),
        category: z.enum(CATEGORY_VALUES).optional(),
        assignedToId: z.string().nullable().optional(),
      })
      .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update' });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const before = await prisma.supportTicket.findFirst({
      where: { id, deletedAt: null },
    });
    if (!before) return reply.code(404).send({ error: 'Ticket not found' });

    const update: any = {};
    const events: Array<{ type: string; payload: any }> = [];

    if (parsed.data.status && parsed.data.status !== before.status) {
      const transition = validateStatusTransition(before.status, parsed.data.status);
      if (!transition.ok) return reply.code(400).send({ error: transition.error });
      update.status = parsed.data.status;
      if (parsed.data.status === 'RESOLVED') {
        update.resolvedAt = new Date();
        update.resolvedById = userId;
        events.push({ type: 'RESOLVED', payload: { fromStatus: before.status, toStatus: 'RESOLVED' } });
      } else if (parsed.data.status === 'CLOSED') {
        update.closedAt = new Date();
        events.push({ type: 'STATUS_CHANGED', payload: { fromStatus: before.status, toStatus: 'CLOSED' } });
      } else if (before.status === 'CLOSED' && parsed.data.status === 'OPEN') {
        update.closedAt = null;
        events.push({ type: 'REOPENED', payload: { fromStatus: 'CLOSED', toStatus: 'OPEN' } });
      } else {
        events.push({ type: 'STATUS_CHANGED', payload: { fromStatus: before.status, toStatus: parsed.data.status } });
      }
    }
    if (parsed.data.priority && parsed.data.priority !== before.priority) {
      update.priority = parsed.data.priority;
      events.push({ type: 'PRIORITY_CHANGED', payload: { from: before.priority, to: parsed.data.priority } });
    }
    if (parsed.data.category && parsed.data.category !== before.category) {
      update.category = parsed.data.category;
      events.push({ type: 'CATEGORY_CHANGED', payload: { from: before.category, to: parsed.data.category } });
    }
    if (parsed.data.assignedToId !== undefined && parsed.data.assignedToId !== before.assignedToId) {
      update.assignedToId = parsed.data.assignedToId;
      events.push({ type: 'ASSIGNED', payload: { from: before.assignedToId, to: parsed.data.assignedToId } });
    }

    if (Object.keys(update).length === 0) {
      return reply.send(await loadTicketForReply(id));
    }

    await prisma.supportTicket.update({ where: { id }, data: update });

    for (const ev of events) {
      await prisma.ticketEvent.create({
        data: {
          id: generateId('TicketEvent'),
          ticketId: id,
          actorId: userId,
          type: ev.type as any,
          payload: ev.payload,
        },
      });
    }

    await logAudit({
      actorId: userId,
      action: 'UPDATE',
      objectType: 'SupportTicket',
      objectId: id,
      objectName: `#T-${before.ticketNumber} ${before.title}`,
      before: {
        status: before.status,
        priority: before.priority,
        category: before.category,
        assignedToId: before.assignedToId,
      },
      after: update,
      ipAddress: extractIp(req),
    });

    // Fire in-app notifications for the kinds we care about.
    const ticketNumLabel = `#T-${String(before.ticketNumber).padStart(5, '0')}`;
    const linkUrl = `/support/tickets/${id}`;

    // ticket.assigned — only when assignedToId moves TO a user (not on clear)
    if (
      update.assignedToId !== undefined &&
      update.assignedToId &&
      update.assignedToId !== before.assignedToId
    ) {
      (async () => {
        await notify(
          {
            recipientIds: [update.assignedToId as string],
            kind: 'ticket.assigned',
            subjectType: 'SupportTicket',
            subjectId: id,
            title: `You were assigned ticket ${ticketNumLabel}: ${before.title}`,
            linkUrl,
            actorId: userId,
          },
          app.log,
        );
      })();
    }

    // ticket.resolved — fires when status transitions to RESOLVED
    // ticket.status_changed — fires on any other status move (skip RESOLVED
    // since it has its own dedicated kind)
    if (update.status && update.status !== before.status) {
      const recipients = [before.submittedById].filter((rid) => rid && rid !== userId);
      if (recipients.length > 0) {
        if (update.status === 'RESOLVED') {
          (async () => {
            await notify(
              {
                recipientIds: recipients,
                kind: 'ticket.resolved',
                subjectType: 'SupportTicket',
                subjectId: id,
                title: `Your ticket ${ticketNumLabel} was resolved`,
                body: before.title,
                linkUrl,
                actorId: userId,
              },
              app.log,
            );
          })();
        } else {
          const statusLabel = String(update.status).toLowerCase().replace(/_/g, ' ');
          (async () => {
            await notify(
              {
                recipientIds: recipients,
                kind: 'ticket.status_changed',
                subjectType: 'SupportTicket',
                subjectId: id,
                title: `Ticket ${ticketNumLabel} is now ${statusLabel}`,
                body: before.title,
                linkUrl,
                actorId: userId,
              },
              app.log,
            );
          })();
        }
      }
    }

    const full = await loadTicketForReply(id);
    return reply.send(full);
  });

  /* ---------- POST /tickets/:id/comments ---------- */
  app.post('/tickets/:id/comments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await assertCanReadTicket(req, reply, id);
    if (!ctx) return;

    const schema = z.object({ body: z.string().min(1).max(20000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const comment = await prisma.ticketComment.create({
      data: {
        id: generateId('TicketComment'),
        ticketId: id,
        authorId: ctx.userId,
        body: parsed.data.body,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        id: generateId('TicketEvent'),
        ticketId: id,
        actorId: ctx.userId,
        type: 'COMMENT',
        payload: { commentId: comment.id },
      },
    });

    // Touch the ticket's updatedAt so list views sort correctly
    const touched = await prisma.supportTicket.update({
      where: { id },
      data: { updatedAt: new Date() },
      select: { title: true, ticketNumber: true },
    });

    // Fan-out the comment notification to the other participants.
    (async () => {
      const recipients = await getTicketParticipantRecipients(id);
      const actor = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { name: true, email: true },
      });
      const actorName = actor?.name ?? actor?.email ?? 'Someone';
      const label = `#T-${String(touched.ticketNumber).padStart(5, '0')}`;
      await notify(
        {
          recipientIds: recipients,
          kind: 'ticket.commented',
          subjectType: 'SupportTicket',
          subjectId: id,
          title: `${actorName} commented on ${label}: ${touched.title}`,
          body: parsed.data.body.slice(0, 200),
          linkUrl: `/support/tickets/${id}`,
          actorId: ctx.userId,
        },
        app.log,
      );
    })();

    const full = await loadTicketForReply(id);
    return reply.code(201).send(full);
  });

  /* ---------- POST /tickets/:id/attachments — storage-agnostic ---------- */
  app.post('/tickets/:id/attachments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await assertCanReadTicket(req, reply, id);
    if (!ctx) return;

    const schema = z.object({
      fileName: z.string().min(1).max(500),
      sizeBytes: z.number().int().nonnegative().optional(),
      mimeType: z.string().max(200).optional(),
      storagePath: z.string().min(1).max(2000),
      storageId: z.string().max(500).optional(),
      storageRev: z.string().max(500).optional(),
      kind: z.enum(['screenshot', 'file']).default('file'),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const attachment = await prisma.ticketAttachment.create({
      data: {
        id: generateId('TicketAttachment'),
        ticketId: id,
        uploadedById: ctx.userId,
        kind: parsed.data.kind,
        fileName: parsed.data.fileName,
        sizeBytes: parsed.data.sizeBytes,
        mimeType: parsed.data.mimeType,
        storagePath: parsed.data.storagePath,
        storageId: parsed.data.storageId,
        storageRev: parsed.data.storageRev,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        id: generateId('TicketEvent'),
        ticketId: id,
        actorId: ctx.userId,
        type: 'ATTACHMENT_ADDED',
        payload: { attachmentId: attachment.id, fileName: attachment.fileName, kind: attachment.kind },
      },
    });

    await prisma.supportTicket.update({ where: { id }, data: { updatedAt: new Date() } });

    return reply.code(201).send(attachment);
  });

  /* ---------- POST /tickets/:id/error-logs — attach existing logs ---------- */
  app.post('/tickets/:id/error-logs', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await assertCanReadTicket(req, reply, id);
    if (!ctx) return;

    const schema = z.object({ errorLogIds: z.array(z.string().max(64)).min(1).max(50) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    // Non-admins can only attach their own logs or logs from their session
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: { sessionId: true },
    });
    const attachable = await prisma.errorLog.findMany({
      where: {
        id: { in: parsed.data.errorLogIds },
        ticketId: null,
        ...(ctx.isAdmin
          ? {}
          : {
              OR: [
                { userId: ctx.userId },
                ...(ticket?.sessionId ? [{ sessionId: ticket.sessionId }] : []),
              ],
            }),
      },
      select: { id: true },
    });
    const ids = attachable.map((e) => e.id);
    if (ids.length === 0) return reply.send({ attached: 0 });

    await prisma.errorLog.updateMany({
      where: { id: { in: ids } },
      data: { ticketId: id },
    });
    for (const eid of ids) {
      await prisma.ticketEvent.create({
        data: {
          id: generateId('TicketEvent'),
          ticketId: id,
          actorId: ctx.userId,
          type: 'ERROR_LOG_ATTACHED',
          payload: { errorLogId: eid },
        },
      });
    }

    return reply.send({ attached: ids.length });
  });

  /* ---------- PATCH /tickets/:id/folder-ref — set attachment folder ref ---------- */
  app.patch('/tickets/:id/folder-ref', async (req, reply) => {
    const { id } = req.params as { id: string };
    const ctx = await assertCanReadTicket(req, reply, id);
    if (!ctx) return;

    const schema = z.object({ attachmentFolderRef: z.string().max(2000).nullable() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    await prisma.supportTicket.update({
      where: { id },
      data: { attachmentFolderRef: parsed.data.attachmentFolderRef },
    });
    return reply.send({ ok: true });
  });

  /* ---------- DELETE /tickets/:id — admin soft-delete ---------- */
  app.delete('/tickets/:id', async (req, reply) => {
    if (!(await requireTicketAdmin(req, reply))) return;
    const userId = req.user!.sub;
    const { id } = req.params as { id: string };

    const existing = await prisma.supportTicket.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return reply.code(404).send({ error: 'Ticket not found' });

    await prisma.supportTicket.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId },
    });

    await logAudit({
      actorId: userId,
      action: 'DELETE',
      objectType: 'SupportTicket',
      objectId: id,
      objectName: `#T-${existing.ticketNumber} ${existing.title}`,
      ipAddress: extractIp(req),
    });

    return reply.send({ ok: true });
  });

  /* ---------- GET /tickets/assignable-users — admin picker list ---------- */
  app.get('/tickets/assignable-users', async (req, reply) => {
    if (!(await requireTicketAdmin(req, reply))) return;
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { role: 'ADMIN' },
          { profile: { is: { permissions: { path: ['app', 'manageSupportTickets'], equals: true } } } },
        ],
      },
      select: { id: true, name: true, email: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
    });
    return reply.send({ users });
  });
}
