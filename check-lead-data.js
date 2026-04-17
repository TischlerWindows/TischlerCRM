const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});

(async () => {
  const leadObj = await p.customObject.findFirst({ where: { apiName: { equals: 'Lead', mode: 'insensitive' }}});
  if (!leadObj) { console.log('No Lead object'); return; }
  const leads = await p.record.findMany({ where: { objectId: leadObj.id }, take: 5 });
  leads.forEach(r => {
    console.log('ID:', r.id);
    console.log('DATA keys:', Object.keys(r.data));
    console.log('DATA:', JSON.stringify(r.data, null, 2));
    console.log('---');
  });
  await p.$disconnect();
})();
