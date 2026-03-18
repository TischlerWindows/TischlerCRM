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
