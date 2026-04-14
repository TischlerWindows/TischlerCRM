const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  // Check schema version history 
  const versions = await p.setting.findFirst({ where: { key: 'tces-object-manager-versions' } });
  if (versions && versions.value) {
    const arr = Array.isArray(versions.value) ? versions.value : [versions.value];
    console.log(`Found ${arr.length} schema version(s)\n`);
    arr.forEach((ver, i) => {
      const opp = ver.objects?.find(o => o.apiName === 'Opportunity');
      if (opp) {
        console.log(`=== Version ${i} (updatedAt: ${ver.updatedAt}) ===`);
        (opp.pageLayouts || []).forEach((layout, li) => {
          const tabCount = layout.tabs?.length || 0;
          let totalFields = 0;
          let panelCount = 0;
          (layout.tabs || []).forEach(tab => {
            (tab.regions || []).forEach(region => {
              (region.panels || []).forEach(panel => {
                panelCount++;
                totalFields += panel.fields?.length || 0;
              });
            });
          });
          console.log(`  Layout ${li}: id=${layout.id}, name="${layout.name}", tabs=${tabCount}, panels=${panelCount}, totalFields=${totalFields}`);
          (layout.tabs || []).forEach((tab, ti) => {
            console.log(`    Tab ${ti}: "${tab.label}"`);
            (tab.regions || []).forEach((region, ri) => {
              (region.panels || []).forEach((panel, pi) => {
                console.log(`      Panel: "${panel.label}", fields=${panel.fields?.length || 0}`);
              });
            });
          });
        });
      }
    });
  } else {
    console.log('No version history found');
  }

  // Also check current schema's updatedAt
  const current = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  if (current?.value) {
    console.log('\n=== Current Schema ===');
    console.log('updatedAt:', current.value.updatedAt);
    const opp = current.value.objects?.find(o => o.apiName === 'Opportunity');
    if (opp) {
      console.log('Opportunity updatedAt:', opp.updatedAt);
      (opp.pageLayouts || []).forEach((layout, li) => {
        console.log(`Layout ${li}: id=${layout.id}, name="${layout.name}"`);
        (layout.tabs || []).forEach((tab, ti) => {
          console.log(`  Tab ${ti}: "${tab.label}"`);
          (tab.regions || []).forEach(region => {
            (region.panels || []).forEach(panel => {
              console.log(`    Panel: "${panel.label}", fields=${panel.fields?.length || 0}, columns=${panel.columns}`);
              (panel.fields || []).forEach(f => {
                console.log(`      - ${f.fieldApiName} (colSpan: ${f.colSpan})`);
              });
            });
          });
        });
      });
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
