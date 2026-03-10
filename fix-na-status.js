// Fix Lead records that have status='N/A' (from the broken auto-fill default)
const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

async function main() {
  // Find the Lead object
  const leadObj = await prisma.objectDef.findFirst({ where: { apiName: 'Lead' } });
  if (!leadObj) { console.log('Lead object not found'); return; }

  // Find all Lead records
  const records = await prisma.record.findMany({ where: { objectId: leadObj.id } });
  console.log(`Found ${records.length} Lead records`);

  let fixed = 0;
  for (const rec of records) {
    const data = rec.data || {};
    const status = data.status || data.Lead__status;
    if (status === 'N/A') {
      const newData = { ...data, status: 'Not Contacted' };
      // Also update Lead__status if it exists
      if (data.Lead__status === 'N/A') newData.Lead__status = 'Not Contacted';
      await prisma.record.update({ where: { id: rec.id }, data: { data: newData } });
      fixed++;
      console.log(`  Fixed record ${rec.id}: status N/A → Not Contacted`);
    } else {
      console.log(`  Record ${rec.id}: status=${status || '(none)'} - OK`);
    }
  }
  console.log(`\nFixed ${fixed} records`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
