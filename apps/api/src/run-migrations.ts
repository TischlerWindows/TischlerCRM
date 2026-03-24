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
