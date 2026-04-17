-- Phase 2: Org-wide internal notifications
-- Adds Notification + NotificationTypeSetting tables and the partial unique
-- index that powers race-free grouping via INSERT ... ON CONFLICT DO UPDATE.

-- CreateTable "Notification"
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT NOT NULL,
    "lastActorId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,
    "groupKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable "NotificationTypeSetting"
CREATE TABLE "NotificationTypeSetting" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "notificationKind" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTypeSetting_pkey" PRIMARY KEY ("id")
);

-- Indexes on Notification
CREATE INDEX "Notification_recipientId_readAt_createdAt_idx"
  ON "Notification"("recipientId", "readAt", "createdAt" DESC);
CREATE INDEX "Notification_recipientId_createdAt_idx"
  ON "Notification"("recipientId", "createdAt" DESC);
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE INDEX "Notification_orgId_idx" ON "Notification"("orgId");
CREATE INDEX "Notification_subjectType_subjectId_idx"
  ON "Notification"("subjectType", "subjectId");

-- Partial unique index — the grouping key is only unique while the
-- notification is unread. Once it's marked read (readAt set), a new
-- notification with the same groupKey is allowed to insert fresh.
CREATE UNIQUE INDEX "Notification_groupKey_unread_key"
  ON "Notification"("groupKey") WHERE "readAt" IS NULL;

-- Indexes on NotificationTypeSetting
CREATE UNIQUE INDEX "NotificationTypeSetting_orgId_notificationKind_key"
  ON "NotificationTypeSetting"("orgId", "notificationKind");
CREATE INDEX "NotificationTypeSetting_orgId_idx"
  ON "NotificationTypeSetting"("orgId");

-- Foreign keys
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_lastActorId_fkey"
  FOREIGN KEY ("lastActorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
