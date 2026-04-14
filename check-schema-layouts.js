const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  const setting = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  if (!setting) { console.log('No org_schema setting found'); return; }
  
  const schema = setting.value;
  const opp = schema.objects?.find(o => o.apiName === 'Opportunity');
  if (!opp) { console.log('No Opportunity object in schema'); return; }

  console.log('=== Opportunity pageLayouts ===');
  (opp.pageLayouts || []).forEach((layout, i) => {
    console.log(`\nLayout ${i}: id=${layout.id}, name=${layout.name}, type=${layout.layoutType}`);
    (layout.tabs || []).forEach((tab, ti) => {
      console.log(`  Tab ${ti}: label=${tab.label}`);
      // Check for regions (new format)
      if (tab.regions) {
        tab.regions.forEach((region, ri) => {
          console.log(`    Region ${ri}: label=${region.label}`);
          (region.panels || []).forEach((panel, pi) => {
            const fieldCount = panel.fields?.length || 0;
            console.log(`      Panel ${pi}: label=${panel.label}, fields=${fieldCount}`);
            if (fieldCount > 0) {
              panel.fields.slice(0, 5).forEach(f => console.log(`        - ${f.fieldApiName}`));
              if (fieldCount > 5) console.log(`        ... and ${fieldCount - 5} more`);
            }
          });
        });
      }
      // Check for sections (legacy format)
      if (tab.sections) {
        tab.sections.forEach((section, si) => {
          const fieldCount = section.fields?.length || 0;
          console.log(`    Section ${si}: label=${section.label}, fields=${fieldCount}`);
        });
      }
    });
  });

  console.log('\n=== Opportunity recordTypes ===');
  (opp.recordTypes || []).forEach(rt => {
    console.log(`  id=${rt.id}, name=${rt.name}, pageLayoutId=${rt.pageLayoutId}`);
  });
  console.log('  defaultRecordTypeId:', opp.defaultRecordTypeId);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
