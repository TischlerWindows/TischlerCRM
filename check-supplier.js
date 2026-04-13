const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway'
  });
  const setting = await prisma.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const schema = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
  const prop = schema.objects.find(o => o.apiName === 'Property');
  if (!prop) {
    console.log('No Property object. Objects:', schema.objects.map(o => o.apiName));
  } else {
    console.log('Property fields count:', prop.fields?.length);
    console.log('Property pageLayouts count:', prop.pageLayouts?.length || 0);
    for (const layout of (prop.pageLayouts || [])) {
      console.log('\nLayout:', layout.label);
      console.log('  tabs:', layout.tabs?.length, 'sections (legacy):', layout.sections?.length);
      if (layout.tabs) {
        for (const tab of layout.tabs) {
          console.log('  Tab:', tab.label, 'regions:', tab.regions?.length);
          for (const region of (tab.regions || [])) {
            console.log('    Region:', region.id, JSON.stringify(region.label), 'panels:', region.panels?.length, 'visibleIf:', JSON.stringify(region.visibleIf));
          }
        }
      }
    }
  }
  await prisma.$disconnect();
}

main().catch(console.error);
