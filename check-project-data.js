const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});
(async () => {
  const obj = await p.customObject.findFirst({ where: { apiName: { equals: 'Project', mode: 'insensitive' }}});
  const recs = await p.record.findMany({ where: { objectId: obj.id }, take: 5 });
  for (const r of recs) {
    const d = r.data;
    console.log('---', r.id);
    const keys = Object.keys(d).filter(k =>
      k.toLowerCase().includes('property') ||
      k.toLowerCase().includes('opportunity') ||
      k.toLowerCase().includes('number') ||
      k.toLowerCase().includes('name')
    );
    for (const k of keys) console.log(' ', k, '=', d[k]);
  }
  await p.$disconnect();
})();
