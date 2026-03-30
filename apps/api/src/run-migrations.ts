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
    name: 'add_widget_settings',
    sql: `CREATE TABLE IF NOT EXISTS "WidgetSetting" (
      "id" TEXT NOT NULL,
      "orgId" TEXT NOT NULL,
      "widgetId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WidgetSetting_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'add_widget_settings_unique_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "WidgetSetting_orgId_widgetId_key" ON "WidgetSetting"("orgId", "widgetId")`,
  },
  {
    name: 'add_widget_settings_org_idx',
    sql: `CREATE INDEX IF NOT EXISTS "WidgetSetting_orgId_idx" ON "WidgetSetting"("orgId")`,
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
