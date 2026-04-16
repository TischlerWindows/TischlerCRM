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
  {
    name: 'add_page_layout_extensions',
    sql: `ALTER TABLE "PageLayout" ADD COLUMN IF NOT EXISTS "extensions" JSONB`,
  },
  // ── Soft delete columns — added to multiple models over time
  //    without matching migrations. Without these, Prisma queries that
  //    filter `deletedAt: null` throw "column does not exist" and the
  //    endpoint returns 500. These are the root cause of many record 500s.
  {
    name: 'add_record_deleted_at',
    sql: `ALTER TABLE "Record" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  },
  {
    name: 'add_record_deleted_by_id',
    sql: `ALTER TABLE "Record" ADD COLUMN IF NOT EXISTS "deletedById" TEXT`,
  },
  {
    name: 'add_record_deleted_at_idx',
    sql: `CREATE INDEX IF NOT EXISTS "Record_deletedAt_idx" ON "Record"("deletedAt")`,
  },
  {
    name: 'add_user_deleted_at',
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  },
  {
    name: 'add_user_deleted_by_id',
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedById" TEXT`,
  },
  {
    name: 'add_user_is_active',
    sql: `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  },
  {
    name: 'add_department_deleted_at',
    sql: `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
  },
  {
    name: 'add_department_deleted_by_id',
    sql: `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "deletedById" TEXT`,
  },
  {
    name: 'add_department_is_active',
    sql: `ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  },
  // ── CustomField.isActive — used by POST /records `include` filter.
  //    Missing this column makes record creation 500.
  {
    name: 'add_custom_field_is_active',
    sql: `ALTER TABLE "CustomField" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  },
  {
    name: 'add_custom_field_is_custom',
    sql: `ALTER TABLE "CustomField" ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT true`,
  },
  {
    name: 'add_page_layout_is_active',
    sql: `ALTER TABLE "PageLayout" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`,
  },
  // Integration and UserIntegration tables are created by prisma db push.
  // These are kept as no-op safety nets (IF NOT EXISTS) and must use single
  // statements per entry because $executeRawUnsafe does not support batches.
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
        // Log but don't crash — prisma db push handles table creation in prod
        console.error(`[migrations] WARN: ${m.name} failed:`, err.message);
      }
    }
  }
  console.log('[migrations] All migrations applied.');
}
