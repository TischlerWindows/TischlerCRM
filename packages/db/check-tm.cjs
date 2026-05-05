const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

async function main() {
  // Find TeamMember object
  const tmObj = await prisma.customObject.findFirst({ where: { apiName: { equals: 'TeamMember', mode: 'insensitive' } } });
  if (!tmObj) { console.log('No TeamMember object'); return; }
  console.log('TeamMember objectId:', tmObj.id);

  // Get a few TeamMember records to see structure
  const recs = await prisma.record.findMany({ where: { objectId: tmObj.id }, take: 5, orderBy: { createdAt: 'desc' } });
  for (const r of recs) {
    console.log('\n--- TM', r.id.slice(0, 8));
    console.log('  keys:', Object.keys(r.data).join(', '));
    const d = r.data;
    // Show all opportunity-related keys
    for (const [k, v] of Object.entries(d)) {
      const kl = k.toLowerCase();
      if (kl.includes('opport') || kl.includes('quote') || kl.includes('role') || kl.includes('contact') || kl.includes('account')) {
        console.log(`  ${k}:`, v);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
