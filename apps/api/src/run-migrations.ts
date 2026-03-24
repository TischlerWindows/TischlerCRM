import { prisma } from '@crm/db/client';

/**
 * Runs raw SQL migrations that must complete before the Prisma client
 * can safely query models. Each migration uses IF NOT EXISTS / IF EXISTS
 * so it is safe to run on every startup.
 *
 * Add new migrations to the MIGRATIONS array as the schema evolves.
 */
const MIGRATIONS: { name: string; sql: string }[] = [
  {
    name: 'add_must_change_password',
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mustChangePassword" BOOLEAN NOT NULL DEFAULT false`,
  },
  {
    name: 'add_layout_field_col_span',
    sql: `ALTER TABLE "LayoutField" ADD COLUMN IF NOT EXISTS "colSpan" INTEGER NOT NULL DEFAULT 1`,
  },
  {
    name: 'add_layout_field_row_span',
    sql: `ALTER TABLE "LayoutField" ADD COLUMN IF NOT EXISTS "rowSpan" INTEGER NOT NULL DEFAULT 1`,
  },
  {
    name: 'add_layout_field_presentation',
    sql: `ALTER TABLE "LayoutField" ADD COLUMN IF NOT EXISTS "presentation" JSONB`,
  },
  {
    name: 'create_integration_table',
    sql: `CREATE TABLE IF NOT EXISTS "Integration" (
      "id" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT NOT NULL DEFAULT 'general',
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "apiKey" TEXT,
      "clientId" TEXT,
      "clientSecret" TEXT,
      "config" JSONB NOT NULL DEFAULT '{}',
      "webhookUrl" TEXT,
      "configuredById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Integration_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Integration_provider_key" UNIQUE ("provider"),
      CONSTRAINT "Integration_configuredById_fkey" FOREIGN KEY ("configuredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    )`,
  },
  {
    name: 'create_integration_indexes',
    sql: `CREATE INDEX IF NOT EXISTS "Integration_provider_idx" ON "Integration"("provider");
          CREATE INDEX IF NOT EXISTS "Integration_enabled_idx" ON "Integration"("enabled");
          CREATE INDEX IF NOT EXISTS "Integration_category_idx" ON "Integration"("category")`,
  },
  {
    name: 'create_user_integration_table',
    sql: `CREATE TABLE IF NOT EXISTS "UserIntegration" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "integrationId" TEXT NOT NULL,
      "accessToken" TEXT,
      "refreshToken" TEXT,
      "tokenExpiresAt" TIMESTAMP(3),
      "scopes" TEXT,
      "syncEnabled" BOOLEAN NOT NULL DEFAULT true,
      "lastSyncAt" TIMESTAMP(3),
      "lastSyncStatus" TEXT,
      "lastSyncError" TEXT,
      "syncCursor" TEXT,
      "externalAccountId" TEXT,
      "externalEmail" TEXT,
      "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserIntegration_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "UserIntegration_userId_integrationId_key" UNIQUE ("userId", "integrationId"),
      CONSTRAINT "UserIntegration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "UserIntegration_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
  },
  {
    name: 'create_user_integration_indexes',
    sql: `CREATE INDEX IF NOT EXISTS "UserIntegration_userId_idx" ON "UserIntegration"("userId");
          CREATE INDEX IF NOT EXISTS "UserIntegration_integrationId_idx" ON "UserIntegration"("integrationId");
          CREATE INDEX IF NOT EXISTS "UserIntegration_lastSyncAt_idx" ON "UserIntegration"("lastSyncAt")`,
  },
];

export async function runPendingMigrations() {
  console.log('[migrations] Running schema migrations...');
  for (const m of MIGRATIONS) {
    try {
      await prisma.$executeRawUnsafe(m.sql);
      console.log(`[migrations] OK: ${m.name}`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        console.log(`[migrations] SKIP (already exists): ${m.name}`);
      } else {
        throw err;
      }
    }
  }
  console.log('[migrations] All migrations applied.');
}
