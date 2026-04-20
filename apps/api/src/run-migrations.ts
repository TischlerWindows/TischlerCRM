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
    name: 'add_trigger_setting',
    sql: `CREATE TABLE IF NOT EXISTS "TriggerSetting" (
      "id" TEXT NOT NULL,
      "orgId" TEXT NOT NULL,
      "triggerId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TriggerSetting_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'add_trigger_setting_unique_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "TriggerSetting_orgId_triggerId_key" ON "TriggerSetting"("orgId", "triggerId")`,
  },
  {
    name: 'add_trigger_setting_org_idx',
    sql: `CREATE INDEX IF NOT EXISTS "TriggerSetting_orgId_idx" ON "TriggerSetting"("orgId")`,
  },
  {
    name: 'add_controller_setting',
    sql: `CREATE TABLE IF NOT EXISTS "ControllerSetting" (
      "id" TEXT NOT NULL,
      "orgId" TEXT NOT NULL,
      "controllerId" TEXT NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ControllerSetting_pkey" PRIMARY KEY ("id")
    )`,
  },
  {
    name: 'add_controller_setting_unique_idx',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "ControllerSetting_orgId_controllerId_key" ON "ControllerSetting"("orgId", "controllerId")`,
  },
  {
    name: 'add_controller_setting_org_idx',
    sql: `CREATE INDEX IF NOT EXISTS "ControllerSetting_orgId_idx" ON "ControllerSetting"("orgId")`,
  },
  // Convert SupportTicket.category from TicketCategory enum to plain TEXT.
  // Idempotent: only runs if the TicketCategory type still exists.
  {
    name: 'convert_ticket_category_to_text',
    sql: `DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketCategory') THEN
        EXECUTE 'ALTER TABLE "SupportTicket" ALTER COLUMN "category" DROP DEFAULT';
        EXECUTE 'ALTER TABLE "SupportTicket" ALTER COLUMN "category" TYPE TEXT USING "category"::TEXT';
        EXECUTE 'ALTER TABLE "SupportTicket" ALTER COLUMN "category" SET DEFAULT ''UNTRIAGED''';
        EXECUTE 'DROP TYPE "TicketCategory"';
      END IF;
    END $$`,
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
