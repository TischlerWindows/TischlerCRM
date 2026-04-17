const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

(async () => {
  // Get the most recent lead with a valid property
  const leadObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Lead', mode: 'insensitive' } }
  });
  const propObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Property', mode: 'insensitive' } }
  });

  const leads = await prisma.record.findMany({
    where: { objectId: leadObj.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log('Checking which leads have valid property refs:');
  for (const lead of leads) {
    const data = lead.data;
    const propId = data.property;
    if (!propId) {
      console.log(`  Lead ${lead.id}: no property field`);
      continue;
    }
    const propRec = await prisma.record.findFirst({
      where: { id: propId, objectId: propObj.id }
    });
    console.log(`  Lead ${lead.id}: property=${propId}, valid=${!!propRec}, createdBy=${lead.createdById}, created=${lead.createdAt.toISOString()}`);
  }

  // Check which users have Dropbox connected  
  const integration = await prisma.integration.findFirst({ where: { provider: 'dropbox' } });
  const userConns = await prisma.userIntegration.findMany({
    where: { integrationId: integration.id },
    select: { userId: true }
  });
  const connectedUserIds = userConns.map(c => c.userId);
  console.log('\nDropbox connected users:', connectedUserIds);

  // Check if the lead creators have Dropbox
  const creatorIds = [...new Set(leads.map(l => l.createdById))];
  for (const uid of creatorIds) {
    const user = await prisma.user.findUnique({ where: { id: uid }, select: { id: true, name: true, email: true } });
    const connected = connectedUserIds.includes(uid);
    console.log(`  User ${uid} (${user?.name || user?.email}): dropbox=${connected}`);
  }

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
