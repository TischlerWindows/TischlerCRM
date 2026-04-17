const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  const versions = await p.setting.findFirst({ where: { key: 'tces-object-manager-versions' } });
  const arr = Array.isArray(versions.value) ? versions.value : [versions.value];

  // Compare versions 3 (good) and 2 (bad) - Opportunity only
  const v3 = arr[3]; // good
  const v2 = arr[2]; // bad

  const v3Opp = v3.objects.find(o => o.apiName === 'Opportunity');
  const v2Opp = v2.objects.find(o => o.apiName === 'Opportunity');

  console.log('=== Version 3 (GOOD) - updatedAt:', v3.updatedAt, '===');
  console.log('Opp layouts:', v3Opp.pageLayouts.length);
  console.log('Opp fields count:', v3Opp.fields.length);
  console.log('Opp recordTypes:', JSON.stringify(v3Opp.recordTypes));
  console.log('Opp defaultRecordTypeId:', v3Opp.defaultRecordTypeId);

  console.log('\n=== Version 2 (BAD) - updatedAt:', v2.updatedAt, '===');
  console.log('Opp layouts:', v2Opp.pageLayouts.length);
  console.log('Opp fields count:', v2Opp.fields.length);
  console.log('Opp recordTypes:', JSON.stringify(v2Opp.recordTypes));
  console.log('Opp defaultRecordTypeId:', v2Opp.defaultRecordTypeId);

  // Check if version 2 layout was auto-generated
  const v2Layout = v2Opp.pageLayouts[0];
  console.log('\nVersion 2 layout ID:', v2Layout.id);
  console.log('Version 2 layout name:', v2Layout.name);
  
  // Check which fields are in v2 but not v3
  const v3FieldApiNames = new Set(v3Opp.fields.map(f => f.apiName));
  const v2FieldApiNames = new Set(v2Opp.fields.map(f => f.apiName));
  const newInV2 = v2Opp.fields.filter(f => !v3FieldApiNames.has(f.apiName));
  const removedInV2 = v3Opp.fields.filter(f => !v2FieldApiNames.has(f.apiName));
  
  console.log('\nFields added in v2:', newInV2.map(f => f.apiName));
  console.log('Fields removed in v2:', removedInV2.map(f => f.apiName));

  // Compare all object counts
  console.log('\n=== Object counts ===');
  console.log('V3 objects:', v3.objects.length, v3.objects.map(o => o.apiName).join(', '));
  console.log('V2 objects:', v2.objects.length, v2.objects.map(o => o.apiName).join(', '));
  
  // Check if any objects were added/removed
  const v3ObjectNames = new Set(v3.objects.map(o => o.apiName));
  const v2ObjectNames = new Set(v2.objects.map(o => o.apiName));
  const addedObjects = [...v2ObjectNames].filter(n => !v3ObjectNames.has(n));
  const removedObjects = [...v3ObjectNames].filter(n => !v2ObjectNames.has(n));
  console.log('Objects added in v2:', addedObjects);
  console.log('Objects removed in v2:', removedObjects);

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
