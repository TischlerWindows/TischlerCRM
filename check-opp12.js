const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });
(async () => {
  const obj = await p.customObject.findFirst({ where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } } });
  // Get ALL OPP0013 records including deleted
  const recs = await p.record.findMany({
    where: { objectId: obj.id },
    select: { id: true, data: true, deletedAt: true, createdAt: true },
  });
  const filtered = recs.filter(r => {
    const d = r.data;
    if (!d) return false;
    for (const [k,v] of Object.entries(d)) {
      if (k.replace(/^[A-Za-z]+__/,'') === 'opportunityNumber' && typeof v === 'string' && v.includes('OPP0013')) return true;
    }
    return false;
  });
  filtered.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
  filtered.forEach(r => {
    const d = r.data;
    let num = '', name = '';
    for (const [k,v] of Object.entries(d)) {
      const s = k.replace(/^[A-Za-z]+__/,'');
      if (s === 'opportunityNumber') num = v;
      if (s === 'opportunityName' || s === 'name') name = v;
    }
    console.log(JSON.stringify({ id: r.id, num, name, isRequote: d._isRequote || false, parentOpp: d._parentOpportunityNumber || '', deletedAt: r.deletedAt }));
  });
  // Clean up: hard-delete all OPP0013 requotes
  for (const r of filtered) {
    if (r.id !== '006r1vqVBD236nE') { // keep original OPP0013
      await p.record.delete({ where: { id: r.id } });
      console.log('Deleted:', r.id);
    }
  }
  await p.$disconnect();
})();
