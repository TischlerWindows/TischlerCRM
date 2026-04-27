const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({
  datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway'
});
(async () => {
  // Check what the Opportunity property field looks like
  const opps = await p.record.findMany({ where: { object: { apiName: 'Opportunity' } }, take: 5 });
  for (const rec of opps) {
    const d = rec.data;
    if (!d) continue;
    console.log('--- Opportunity', rec.id, '---');
    for (const [k, v] of Object.entries(d)) {
      if (k.toLowerCase().includes('prop') || k.toLowerCase().includes('address') || k.toLowerCase().includes('location')) {
        const display = typeof v === 'object' ? JSON.stringify(v).substring(0,300) : String(v).substring(0,300);
        console.log('  ', k, '=', display);
      }
    }
    console.log('');
  }
  await p.$disconnect();
})();
