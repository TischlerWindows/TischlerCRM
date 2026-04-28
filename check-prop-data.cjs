const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway'
});
(async () => {
  // Find opportunity records that have glass type data
  const recs = await p.record.findMany({ where: { object: { apiName: 'Opportunity' } }, take: 20 });
  for (const rec of recs) {
    const d = rec.data;
    if (!d) continue;
    const keys = Object.keys(d).filter(k => k.toLowerCase().includes('glass') || k.toLowerCase().includes('wood'));
    if (!keys.length) continue;
    console.log('--- Opportunity', rec.id, '---');
    for (const k of keys) {
      console.log('  ', k, '=', String(d[k]).substring(0, 150));
    }
  }
  await p.$disconnect();
})();
