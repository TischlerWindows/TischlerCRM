const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  // Load version history
  const versions = await p.setting.findFirst({ where: { key: 'tces-object-manager-versions' } });
  const arr = Array.isArray(versions.value) ? versions.value : [versions.value];

  // Version 3 has the good full schema (before the wipe)
  const goodVersion = arr[3];
  console.log('Restoring from version:', goodVersion.updatedAt);

  const goodOpp = goodVersion.objects.find(o => o.apiName === 'Opportunity');
  console.log('Good Opp fields:', goodOpp.fields.length);
  console.log('Good Opp layouts:', goodOpp.pageLayouts.length);

  // Load current schema
  const current = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const schema = current.value;

  // Get current Opp for reference
  const curOpp = schema.objects.find(o => o.apiName === 'Opportunity');
  console.log('Current Opp fields:', curOpp.fields.length);
  
  // Merge: take all fields from good version, but also keep any NEW fields 
  // that were added by ensure* functions after v3 (so we don't lose lookup fields etc)
  const goodFieldApiNames = new Set(goodOpp.fields.map(f => f.apiName));
  const newFieldsFromCurrent = curOpp.fields.filter(f => !goodFieldApiNames.has(f.apiName));
  console.log('New fields to keep from current:', newFieldsFromCurrent.length, newFieldsFromCurrent.map(f => f.apiName));

  const mergedFields = [...goodOpp.fields, ...newFieldsFromCurrent];
  console.log('Merged field count:', mergedFields.length);

  // Replace Opportunity with good version data + merged fields
  schema.objects = schema.objects.map(obj => {
    if (obj.apiName !== 'Opportunity') return obj;
    return {
      ...goodOpp,
      fields: mergedFields,
      updatedAt: new Date().toISOString()
    };
  });

  // Re-add missing objects (Technician, InstallationTechnician, InstallationCost, InstallationTechExpense)
  const existingApiNames = new Set(schema.objects.map(o => o.apiName));
  const missingObjects = goodVersion.objects.filter(o => !existingApiNames.has(o.apiName));
  if (missingObjects.length > 0) {
    console.log('Re-adding missing objects:', missingObjects.map(o => o.apiName));
    schema.objects.push(...missingObjects);
  }

  schema.updatedAt = new Date().toISOString();

  // Save
  await p.setting.update({
    where: { key: 'tces-object-manager-schema' },
    data: { value: schema }
  });

  console.log('\nFull schema restored. Verifying...');
  
  // Verify
  const verify = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const verOpp = verify.value.objects.find(o => o.apiName === 'Opportunity');
  console.log('Verified Opp fields:', verOpp.fields.length);
  console.log('Verified Opp layouts:', verOpp.pageLayouts.length);
  (verOpp.pageLayouts || []).forEach((l, i) => {
    const totalFields = (l.tabs || []).reduce((sum, tab) =>
      sum + (tab.regions || []).reduce((s2, r) =>
        s2 + (r.panels || []).reduce((s3, pp) => s3 + (pp.fields?.length || 0), 0), 0), 0);
    console.log(`  Layout ${i}: id=${l.id}, name="${l.name}", fields=${totalFields}`);
  });
  console.log('Objects:', verify.value.objects.map(o => o.apiName).join(', '));

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
