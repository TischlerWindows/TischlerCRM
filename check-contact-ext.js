const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});

(async () => {
  const r = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' }});
  const schema = r.value;
  const contact = schema.objects.find(o => o.apiName === 'Contact');

  const layout = contact.pageLayouts[0];
  console.log('Layout extensions:', JSON.stringify(layout.extensions, null, 2));
  console.log('\nLayout tabs[0] regions:', layout.tabs[0].regions.length);
  layout.tabs[0].regions.forEach((r, i) => {
    console.log(`  Region ${i}: panels=${r.panels?.length}, hidden=${r.hidden}, showInTemplate=${r.showInTemplate}, visibleIf=${JSON.stringify(r.visibleIf)}`);
    console.log(`    gridColumn=${r.gridColumn}, gridRow=${r.gridRow}, gridColumnSpan=${r.gridColumnSpan}, gridRowSpan=${r.gridRowSpan}`);
    (r.panels || []).forEach((p, pi) => {
      console.log(`    Panel ${pi}: "${p.label}" fields=${p.fields?.length} hidden=${p.hidden} order=${p.order}`);
      (p.fields || []).forEach(f => {
        console.log(`      - ${f.fieldApiName} visible=${f.visible !== false} hidden=${f.hidden === true}`);
      });
    });
    console.log(`  Widgets: ${(r.widgets || []).length}`);
  });

  await p.$disconnect();
})();
