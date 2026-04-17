/**
 * The single entry point for emitting in-app notifications.
 *
 * Any server code that needs to notify a user calls notify(...). The function:
 *   1. Validates the kind against the registry.
 *   2. De-dupes recipients and excludes the actor.
 *   3. Checks the per-kind opt-out (NotificationTypeSetting, opt-out model).
 *   4. Upserts one row per recipient atomically — grouping while unread via a
 *      partial unique index on (groupKey) WHERE readAt IS NULL.
 *   5. Broadcasts a tiny hint payload via Postgres NOTIFY so SSE subscribers
 *      on any API process learn about it.
 *   6. Probabilistically sweeps old rows for retention.
 *
 * Callers should wrap notify() in try/catch if they want to be defensive,
 * but notify() itself logs and swallows all errors so a notification
 * failure never breaks the business mutation that triggered it.
 */

import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';
import { isValidNotificationKind } from './kinds.js';

export const DEFAULT_ORG_ID = 'default';

export interface NotifyInput {
  recipientIds: string[];
  kind: string;
  subjectType: string;
  subjectId: string;
  title: string;
  body?: string;
  linkUrl: string;
  actorId?: string;
  orgId?: string;
}

interface NotifyLogger {
  error: (obj: unknown, msg?: string) => void;
  warn?: (obj: unknown, msg?: string) => void;
}

function retentionCutoff(): Date {
  const days = Number(process.env.NOTIFICATION_RETENTION_DAYS ?? 90);
  const validDays = Number.isFinite(days) && days > 0 ? days : 90;
  return new Date(Date.now() - validDays * 86_400_000);
}

async function sweepExpiredNotifications(): Promise<void> {
  const cutoff = retentionCutoff();
  await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
}

export async function notify(input: NotifyInput, logger?: NotifyLogger): Promise<void> {
  try {
    if (!isValidNotificationKind(input.kind)) {
      logger?.warn?.({ kind: input.kind }, 'notify(): unknown notification kind');
      return;
    }

    const orgId = input.orgId ?? DEFAULT_ORG_ID;

    const recipients = Array.from(
      new Set(input.recipientIds.filter((id) => id && id !== input.actorId)),
    );
    if (recipients.length === 0) return;

    // Opt-out check: missing row = enabled.
    const setting = await prisma.notificationTypeSetting.findUnique({
      where: {
        orgId_notificationKind: { orgId, notificationKind: input.kind },
      },
      select: { enabled: true },
    });
    if (setting && setting.enabled === false) return;

    // One atomic upsert per recipient. We use raw SQL because Prisma can't
    // target a partial unique index with its upsert API.
    const nowIso = new Date();
    const created: Array<{ id: string; recipientId: string }> = [];

    for (const recipientId of recipients) {
      const id = generateId('Notification');
      const groupKey = `${recipientId}:${input.kind}:${input.subjectType}:${input.subjectId}`;

      const rows = await prisma.$queryRaw<Array<{ id: string }>>`
        INSERT INTO "Notification" (
          "id", "orgId", "recipientId", "kind", "subjectType", "subjectId",
          "title", "body", "linkUrl", "lastActorId", "count", "groupKey",
          "readAt", "createdAt", "updatedAt"
        )
        VALUES (
          ${id}, ${orgId}, ${recipientId}, ${input.kind}, ${input.subjectType}, ${input.subjectId},
          ${input.title}, ${input.body ?? null}, ${input.linkUrl}, ${input.actorId ?? null}, 1, ${groupKey},
          NULL, ${nowIso}, ${nowIso}
        )
        ON CONFLICT ("groupKey") WHERE "readAt" IS NULL
        DO UPDATE SET
          "count"       = "Notification"."count" + 1,
          "updatedAt"   = EXCLUDED."updatedAt",
          "lastActorId" = EXCLUDED."lastActorId",
          "title"       = EXCLUDED."title",
          "body"        = EXCLUDED."body",
          "linkUrl"     = EXCLUDED."linkUrl"
        RETURNING "id"
      `;

      const insertedId = rows[0]?.id ?? id;
      created.push({ id: insertedId, recipientId });
    }

    // Broadcast hints to any listeners. pg_notify handles escaping safely.
    for (const row of created) {
      const payload = JSON.stringify({ recipientId: row.recipientId, id: row.id });
      await prisma.$executeRaw`SELECT pg_notify('notifications', ${payload})`;
    }

    // Probabilistic retention sweep — fire-and-forget.
    if (Math.random() < 0.01) {
      sweepExpiredNotifications().catch((err) => {
        logger?.error?.({ err }, 'Notification retention sweep failed');
      });
    }
  } catch (err) {
    logger?.error?.({ err, kind: input.kind }, 'notify() failed');
  }
}

/** Exposed for the admin cleanup endpoint. */
export async function runNotificationRetentionSweep(): Promise<number> {
  const cutoff = retentionCutoff();
  const res = await prisma.notification.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return res.count;
}
