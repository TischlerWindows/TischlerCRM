const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway'
  });

  const setting = await prisma.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const schema = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;

  for (const obj of (schema.objects || [])) {
    if (!obj.pageLayouts) continue;
    for (const layout of obj.pageLayouts) {
      if (layout.formattingRules && layout.formattingRules.length > 0) {
        console.log('Object:', obj.apiName, 'Layout:', layout.label);
        for (const rule of layout.formattingRules) {
          console.log(JSON.stringify(rule, null, 2));
        }
      }
    }
  }

  // Also find regions named "Wood Windows" and show their IDs
  console.log('\n--- Regions named "Wood Windows" ---');
  for (const obj of (schema.objects || [])) {
    if (!obj.pageLayouts) continue;
    for (const layout of obj.pageLayouts) {
      for (const tab of (layout.tabs || [])) {
        for (const region of (tab.regions || [])) {
          if (region.label && region.label.toLowerCase().includes('wood')) {
            console.log('Object:', obj.apiName, 'Layout:', layout.label, 'Tab:', tab.label);
            console.log('  Region ID:', region.id, 'Label:', region.label);
          }
        }
      }
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
