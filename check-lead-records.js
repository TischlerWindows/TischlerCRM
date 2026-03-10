const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

async function main() {
  // Get Lead CustomObject  
  const leadObj = await prisma.customObject.findUnique({ where: { apiName: 'Lead' } });
  if (!leadObj) { console.log('No Lead CustomObject'); return; }
  console.log('Lead CustomObject ID:', leadObj.id);

  // Get recent Lead records
  const records = await prisma.record.findMany({
    where: { objectId: leadObj.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { createdBy: { select: { name: true, email: true } } }
  });

  console.log(`Found ${records.length} Lead records\n`);
  
  records.forEach((r, i) => {
    console.log(`=== Record ${i+1}: ${r.id} (created: ${r.createdAt?.toISOString()}) ===`);
    console.log(`  Created by: ${r.createdBy?.name || r.createdBy?.email}`);
    const data = r.data;
    
    // Check for status in various key forms
    const statusKeys = Object.keys(data).filter(k => 
      k.toLowerCase().includes('status')
    );
    console.log(`  Status-related keys:`, statusKeys);
    statusKeys.forEach(k => console.log(`    ${k} = "${data[k]}"`));
    
    // Show all keys
    console.log(`  All data keys:`, Object.keys(data).join(', '));
    console.log('');
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
