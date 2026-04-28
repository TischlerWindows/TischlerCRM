const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' });
(async () => {
  const recs = await db.record.findMany({ where: { object: { apiName: 'Opportunity' } }, take: 30 });
  for (const r of recs) {
    const d = r.data;
    if (!d) continue;
    const keys = Object.keys(d).filter(k => k.toLowerCase().includes('quote') || k.toLowerCase().includes('receiving') || k.toLowerCase().includes('individual') || k.toLowerCase().includes('account'));
    if (!keys.length) continue;
    console.log('--- Opp', r.id, '---');
    for (const k of keys) console.log(' ', k, '=>', JSON.stringify(d[k]).substring(0, 200));
  }
  await db.$disconnect();
})();
