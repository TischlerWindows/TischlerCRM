const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});
(async () => {
  const contactFull = await prisma.record.findUnique({
    where: { id: '1e0b934c-030b-44f9-9eba-f5df99545ea0' },
    select: { id: true, objectId: true, data: true }
  });
  console.log('Contact objectId:', contactFull?.objectId);

  const contactObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Contact', mode: 'insensitive' } }
  });
  console.log('Expected objectId:', contactObj?.id);
  console.log('Match:', contactFull?.objectId === contactObj?.id);
  
  // Inspect the name field structure
  const d = contactFull?.data;
  console.log('name field:', JSON.stringify(d?.name));
  console.log('Top-level salutation:', d?.salutation || d?.['Contact__salutation']);
  console.log('name.Contact__name_salutation:', d?.name?.['Contact__name_salutation']);
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
