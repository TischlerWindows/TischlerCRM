const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});
(async () => {
  const contactObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Contact', mode: 'insensitive' } }
  });
  console.log('Contact object ID:', contactObj?.id, 'apiName:', contactObj?.apiName);

  // Try to find contact by UUID
  const contactByUUID = await prisma.record.findFirst({
    where: { id: '1e0b934c-030b-44f9-9eba-f5df99545ea0' }
  });
  console.log('Contact by UUID:', contactByUUID ? JSON.stringify({ id: contactByUUID.id, data: contactByUUID.data }, null, 2) : 'NOT FOUND');

  // Also check first few contacts
  const contacts = await prisma.record.findMany({
    where: { objectId: contactObj?.id },
    take: 3,
    orderBy: { createdAt: 'desc' }
  });
  console.log('First 3 contacts:');
  for (const c of contacts) {
    const d = c.data;
    console.log('  ID:', c.id, '| salutation:', d.salutation || d.Contact__salutation, '| firstName:', d.firstName || d.Contact__firstName, '| lastName:', d.lastName || d.Contact__lastName);
  }
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
