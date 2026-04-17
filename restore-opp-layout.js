const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  // Load version history
  const versions = await p.setting.findFirst({ where: { key: 'tces-object-manager-versions' } });
  const arr = Array.isArray(versions.value) ? versions.value : [versions.value];

  // Version 3 has the good Opportunity layout (hvkecdbrk with 11 panels, 99 fields)
  const goodVersion = arr[3]; // Version 3 (index 3)
  const goodOpp = goodVersion.objects.find(o => o.apiName === 'Opportunity');
  const goodLayouts = goodOpp.pageLayouts;
  const goodRecordTypes = goodOpp.recordTypes;
  const goodDefaultRecordTypeId = goodOpp.defaultRecordTypeId;

  console.log('Good version updatedAt:', goodVersion.updatedAt);
  console.log('Good layouts:');
  goodLayouts.forEach((l, i) => {
    const totalFields = (l.tabs || []).reduce((sum, tab) =>
      sum + (tab.regions || []).reduce((s2, r) =>
        s2 + (r.panels || []).reduce((s3, p) => s3 + (p.fields?.length || 0), 0), 0), 0);
    console.log(`  ${i}: id=${l.id}, name="${l.name}", fields=${totalFields}`);
  });
  console.log('Good recordTypes:');
  goodRecordTypes.forEach(rt => console.log(`  id=${rt.id}, name="${rt.name}", pageLayoutId=${rt.pageLayoutId}`));

  // Load current schema
  const current = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const schema = current.value;
  
  // Replace Opportunity's layouts & recordTypes with the good ones
  schema.objects = schema.objects.map(obj => {
    if (obj.apiName !== 'Opportunity') return obj;
    return {
      ...obj,
      pageLayouts: goodLayouts,
      recordTypes: goodRecordTypes,
      defaultRecordTypeId: goodDefaultRecordTypeId,
      updatedAt: new Date().toISOString()
    };
  });
  schema.updatedAt = new Date().toISOString();

  // Save
  await p.setting.update({
    where: { key: 'tces-object-manager-schema' },
    data: { value: schema }
  });

  console.log('\nRestored Opportunity layouts from version 3. Done.');
  
  // Verify
  const verify = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const verifOpp = verify.value.objects.find(o => o.apiName === 'Opportunity');
  console.log('\nVerification - current layouts:');
  (verifOpp.pageLayouts || []).forEach((l, i) => {
    const totalFields = (l.tabs || []).reduce((sum, tab) =>
      sum + (tab.regions || []).reduce((s2, r) =>
        s2 + (r.panels || []).reduce((s3, p) => s3 + (p.fields?.length || 0), 0), 0), 0);
    console.log(`  ${i}: id=${l.id}, name="${l.name}", fields=${totalFields}`);
  });

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
