-- Migration: Rename Role → Profile, add User invite/reset fields, remove Department permissions
-- Reverses the previous collapse_profile_into_role migration and introduces flat Profiles.

-- DropForeignKey
ALTER TABLE "Role" DROP CONSTRAINT "Role_parentId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_roleId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "User_roleId_idx";

-- AlterTable: Remove Department.permissions (departments are now pure org labels)
ALTER TABLE "Department" DROP COLUMN IF EXISTS "permissions";

-- AlterTable: Add success flag to LoginEvent
ALTER TABLE "LoginEvent" ADD COLUMN IF NOT EXISTS "success" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Swap roleId → profileId on User, add new user fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "alias" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteAcceptedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteSentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "inviteTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetToken" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordResetTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "profileId" TEXT;

-- Copy existing roleId values into profileId (will be updated to Profile IDs after table rename)
UPDATE "User" SET "profileId" = "roleId" WHERE "roleId" IS NOT NULL;

-- CreateTable: Profile (flat, no hierarchy)
CREATE TABLE IF NOT EXISTS "Profile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '{}',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "grantsAdminAccess" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- Migrate Role data into Profile (preserve IDs so existing roleId → profileId mapping works)
INSERT INTO "Profile" ("id", "name", "label", "description", "permissions", "isSystem", "grantsAdminAccess", "createdAt", "updatedAt")
SELECT
    "id",
    "name",
    "label",
    "description",
    "permissions",
    "isSystem",
    false AS "grantsAdminAccess",
    "createdAt",
    "updatedAt"
FROM "Role"
ON CONFLICT ("id") DO NOTHING;

-- Set grantsAdminAccess on system_administrator
UPDATE "Profile" SET "grantsAdminAccess" = true WHERE "name" = 'system_administrator';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Profile_name_key" ON "Profile"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "User_inviteToken_key" ON "User"("inviteToken");
CREATE UNIQUE INDEX IF NOT EXISTS "User_passwordResetToken_key" ON "User"("passwordResetToken");
CREATE INDEX IF NOT EXISTS "User_profileId_idx" ON "User"("profileId");

-- AddForeignKey: profileId → Profile
ALTER TABLE "User" ADD CONSTRAINT "User_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: createdById → User (self-reference)
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old roleId column from User
ALTER TABLE "User" DROP COLUMN IF EXISTS "roleId";

-- Drop old Role table (data has been migrated to Profile)
DROP TABLE IF EXISTS "Role";
