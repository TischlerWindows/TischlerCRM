const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});

(async () => {
  const oppObj = await p.customObject.findFirst({ where: { apiName: { equals: 'Opportunity', mode: 'insensitive' }}});
  if (oppObj) {
    const recs = await p.record.findMany({ where: { objectId: oppObj.id }, take: 2 });
    recs.forEach(r => { console.log('OPP ID:', r.id, '\nDATA:', JSON.stringify(r.data, null, 2), '\n---'); });
  } else { console.log('No Opportunity object'); }

  const projObj = await p.customObject.findFirst({ where: { apiName: { equals: 'Project', mode: 'insensitive' }}});
  if (projObj) {
    const recs = await p.record.findMany({ where: { objectId: projObj.id }, take: 2 });
    recs.forEach(r => { console.log('PROJ ID:', r.id, '\nDATA:', JSON.stringify(r.data, null, 2), '\n---'); });
  } else { console.log('No Project object'); }

  await p.$disconnect();
})();
