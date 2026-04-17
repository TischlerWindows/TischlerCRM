const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Remove stale dotted keys from ALL records that have address-like blobs
  const allRecords = await p.record.findMany({ select: { id: true, data: true } });
  let fixed = 0;
  for (const rec of allRecords) {
    const d = rec.data;
    if (!d || typeof d !== 'object') continue;
    const toRemove = [];
    for (const key of Object.keys(d)) {
      // Dotted keys like "address_search.city", "address.street" etc.
      if (/^[\w]+\.[\w]+$/.test(key)) {
        toRemove.push(key);
      }
    }
    if (toRemove.length > 0) {
      const cleaned = { ...d };
      for (const k of toRemove) delete cleaned[k];
      await p.record.update({ where: { id: rec.id }, data: { data: cleaned } });
      fixed++;
      console.log(`Cleaned ${toRemove.length} dotted keys from record ${rec.id}: ${toRemove.join(', ')}`);
    }
  }
  console.log(`\nDone. Fixed ${fixed} records.`);
  await p['$disconnect']();
})();
