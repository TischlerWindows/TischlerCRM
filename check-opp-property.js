const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});
(async () => {
  const obj = await p.customObject.findFirst({ where: { apiName: { equals: 'Opportunity', mode: 'insensitive' }}});
  // OPP for PRJ004
  const rec = await p.record.findFirst({ where: { id: '0069Ro7oeVkqIg6', objectId: obj.id }});
  if (rec) {
    const d = rec.data;
    const keys = Object.keys(d).filter(k =>
      k.toLowerCase().includes('property') ||
      k.toLowerCase().includes('number') ||
      k.toLowerCase().includes('name')
    );
    console.log('Opportunity for PRJ004:');
    for (const k of keys) console.log(' ', k, '=', d[k]);
  }
  await p.$disconnect();
})();
