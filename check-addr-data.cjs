const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  // Check OrgSchema for Property address_search field
  const s = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const schema = s.value;
  const propObj = schema.objects.find(o => o.apiName === 'Property');
  const asf = propObj.fields.find(f => f.apiName === 'Property__address_search');
  console.log('=== OrgSchema Property__address_search ===');
  console.log(JSON.stringify(asf, null, 2));

  // Check a real Property record
  const propObjRec = await p.customObject.findFirst({ where: { apiName: 'Property' } });
  // Get 3 most recently updated
  const recs = await p.record.findMany({ where: { objectId: propObjRec.id }, orderBy: { updatedAt: 'desc' }, take: 3 });
  
  for (const rec of recs) {
    console.log('\n=== Property record ===');
    console.log('Record ID:', rec.id);
    console.log('Updated:', rec.updatedAt);
    const d = rec.data;
    const keys = Object.keys(d).filter(k => /address|city|state|zip|postal|country|lat|lng|street/i.test(k));
    console.log('Address-related keys:');
    for (const k of keys) console.log('  ', k, '=', JSON.stringify(d[k]));
  }

  await p['$disconnect']();
})();
