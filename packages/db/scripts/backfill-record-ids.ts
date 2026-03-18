/**
 * Backfill recordId for all existing Record and User rows.
 *
 * Usage:  npx tsx packages/db/scripts/backfill-record-ids.ts
 *
 * Safe to re-run: skips rows that already have a recordId.
 */
import { PrismaClient } from '@prisma/client';
import { generateRecordId, registerRecordIdPrefix } from '../src/record-id.js';

const prisma = new PrismaClient();

async function backfill() {
  console.log('[backfill] Starting recordId backfill...');

  // ── Records ───────────────────────────────────────────────────────
  const records = await prisma.record.findMany({
    where: { recordId: null },
    select: { id: true, objectId: true },
  });

  const objectCache = new Map<string, string>();

  let recordCount = 0;
  for (const rec of records) {
    let apiName = objectCache.get(rec.objectId);
    if (!apiName) {
      const obj = await prisma.customObject.findUnique({
        where: { id: rec.objectId },
        select: { apiName: true },
      });
      if (!obj) {
        console.warn(`[backfill] Skipping record ${rec.id}: object ${rec.objectId} not found`);
        continue;
      }
      apiName = obj.apiName;
      objectCache.set(rec.objectId, apiName);

      // Ensure custom objects get a prefix
      try { registerRecordIdPrefix(apiName); } catch { /* already registered */ }
    }

    const recordId = generateRecordId(apiName);
    await prisma.record.update({
      where: { id: rec.id },
      data: { recordId },
    });
    recordCount++;
  }

  console.log(`[backfill] Updated ${recordCount} Record rows`);

  // ── Users ─────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    where: { recordId: null },
    select: { id: true },
  });

  let userCount = 0;
  for (const user of users) {
    const recordId = generateRecordId('User');
    await prisma.user.update({
      where: { id: user.id },
      data: { recordId },
    });
    userCount++;
  }

  console.log(`[backfill] Updated ${userCount} User rows`);
  console.log('[backfill] Done.');
}

backfill()
  .catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
