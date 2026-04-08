const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});

(async () => {
  const cObj = await p.customObject.findFirst({ where: { apiName: { equals: 'Contact', mode: 'insensitive' }}});
  if (!cObj) { console.log('No Contact object'); return; }

  // Find record with contactNumber = C008
  const recs = await p.record.findMany({ where: { objectId: cObj.id }});
  for (const rec of recs) {
    const data = rec.data;
    const cn = data.contactNumber || data.Contact__contactNumber;
    if (cn === 'C008' || cn === 'C-008') {
      console.log('Found C008!');
      console.log('Record ID:', rec.id);
      console.log('pageLayoutId on record row:', rec.pageLayoutId);
      console.log('_pageLayoutId in data:', data._pageLayoutId);
      console.log('All data keys:', Object.keys(data));
      console.log('Data:', JSON.stringify(data, null, 2));
    }
  }
  console.log('Total Contact records:', recs.length);

  await p.$disconnect();
})();
