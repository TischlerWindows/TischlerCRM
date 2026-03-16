-- Migration: Collapse Profile into Role, add AuditLog, add soft-delete
-- This migration removes the Profile model, adds Role, AuditLog,
-- and adds soft-delete fields to User and Department.
-- Apply via: prisma db push (used in this project instead of prisma migrate)

-- Step 1: Create Role table
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "visibility" JSONB NOT NULL DEFAULT '{}',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");
CREATE INDEX "Role_parentId_idx" ON "Role"("parentId");
CREATE INDEX "Role_level_idx" ON "Role"("level");

ALTER TABLE "Role" ADD CONSTRAINT "Role_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 2: Create AuditLog table
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "objectType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "objectName" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_objectType_objectId_idx" ON "AuditLog"("objectType", "objectId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 3: Add roleId and soft-delete fields to User
ALTER TABLE "User" ADD COLUMN "roleId" TEXT;
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "User_roleId_idx" ON "User"("roleId");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
    FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 4: Add soft-delete fields to Department
ALTER TABLE "Department" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Department" ADD COLUMN "deletedById" TEXT;

CREATE INDEX "Department_deletedAt_idx" ON "Department"("deletedAt");

ALTER TABLE "Department" ADD CONSTRAINT "Department_deletedById_fkey"
    FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 5: Migrate data from Profile to Role (if Profile data exists)
-- Copy Profile.permissions to newly created Role entries
INSERT INTO "Role" ("id", "name", "label", "description", "level", "permissions", "isSystem", "createdAt", "updatedAt")
SELECT
    "id",
    LOWER(REPLACE("name", ' ', '_')),
    "name",
    "description",
    4,
    "permissions",
    "isSystemProfile",
    "createdAt",
    "updatedAt"
FROM "Profile"
ON CONFLICT ("name") DO NOTHING;

-- Update User.roleId from User.profileId
UPDATE "User" SET "roleId" = "profileId" WHERE "profileId" IS NOT NULL;

-- Step 6: Remove Profile references from User
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_profileId_fkey";
DROP INDEX IF EXISTS "User_profileId_idx";
ALTER TABLE "User" DROP COLUMN IF EXISTS "profileId";

-- Step 7: Drop Profile table
DROP TABLE IF EXISTS "Profile";
