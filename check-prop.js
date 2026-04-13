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
    await prisma.$disconnect();
    return;
  }
  console.log('Property object found');
  console.log('Fields:', prop.fields?.length);
  console.log('Page layouts:', prop.pageLayouts?.length);
  console.log('Record types:', JSON.stringify(prop.recordTypes, null, 2));
  
  for (const layout of (prop.pageLayouts || [])) {
    console.log('\n=== Layout:', layout.id, '===');
    console.log('Label:', layout.label);
    console.log('formattingRules:', JSON.stringify(layout.formattingRules));
    console.log('extensions:', JSON.stringify(layout.extensions));
    console.log('tabs:', layout.tabs?.length);
    
    for (const tab of (layout.tabs || [])) {
      console.log('  Tab:', tab.id, 'Label:', tab.label, 'regions:', tab.regions?.length || 0);
      for (const region of (tab.regions || [])) {
        console.log('    Region:', region.id, 'Label:', region.label);
        console.log('      panels:', region.panels?.length || 0, 'widgets:', region.widgets?.length || 0);
        console.log('      visibleIf:', JSON.stringify(region.visibleIf));
        console.log('      hidden:', region.hidden);
        if (region.panels) {
          for (const panel of region.panels) {
            console.log('      Panel:', panel.id, 'Label:', panel.label, 'fields:', panel.fields?.length || 0);
            console.log('        visibleIf:', JSON.stringify(panel.visibleIf));
          }
        }
      }
    }
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
