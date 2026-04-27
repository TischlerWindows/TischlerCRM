const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});
(async () => {
  const leadObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Lead', mode: 'insensitive' } }
  });
  const lead = await prisma.record.findFirst({
    where: { objectId: leadObj.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!lead) { console.log('No leads'); return; }
  console.log('Lead ID:', lead.id);
  console.log('Lead data keys:', Object.keys(lead.data));
  console.log('Full data:', JSON.stringify(lead.data, null, 2));
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
