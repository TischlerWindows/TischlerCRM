const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  const obj = await p.customObject.findFirst({ where: { apiName: 'Opportunity' } });
  
  // Get all Opportunity records
  const recs = await p.record.findMany({
    where: { objectId: obj.id, deletedAt: null },
    select: { id: true, pageLayoutId: true, data: true }
  });
  
  // Count _pageLayoutId values
  const counts = {};
  recs.forEach(rec => {
    const plid = rec.data?._pageLayoutId || 'null';
    counts[plid] = (counts[plid] || 0) + 1;
  });
  
  console.log('_pageLayoutId distribution:', counts);
  console.log('Total records:', recs.length);
  
  // Update every record: set _pageLayoutId to hvkecdbrk (the proper Opportunity Layout)
  const GOOD_LAYOUT_ID = 'hvkecdbrk';
  let updated = 0;
  for (const rec of recs) {
    if (rec.data?._pageLayoutId !== GOOD_LAYOUT_ID) {
      const newData = { ...rec.data, _pageLayoutId: GOOD_LAYOUT_ID };
      // Also clean up if there's a pageLayoutId key in data
      if (newData.pageLayoutId) {
        newData.pageLayoutId = GOOD_LAYOUT_ID;
      }
      await p.record.update({
        where: { id: rec.id },
        data: { data: newData }
      });
      updated++;
    }
  }
  console.log(`Updated ${updated} records to _pageLayoutId: ${GOOD_LAYOUT_ID}`);

  // Fix the schema record type to point to the good layout
  const current = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const schema = current.value;
  schema.objects = schema.objects.map(obj2 => {
    if (obj2.apiName !== 'Opportunity') return obj2;
    return {
      ...obj2,
      recordTypes: (obj2.recordTypes || []).map(rt => ({
        ...rt,
        pageLayoutId: GOOD_LAYOUT_ID
      })),
      // Make the good layout first so fallback always picks it
      pageLayouts: [
        ...(obj2.pageLayouts || []).filter(l => l.id === GOOD_LAYOUT_ID),
        ...(obj2.pageLayouts || []).filter(l => l.id !== GOOD_LAYOUT_ID),
      ],
      updatedAt: new Date().toISOString()
    };
  });
  schema.updatedAt = new Date().toISOString();
  
  await p.setting.update({
    where: { key: 'tces-object-manager-schema' },
    data: { value: schema }
  });
  
  console.log('Fixed record type to point to hvkecdbrk and reordered layouts');

  // Verify
  const verify = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  const verifOpp = verify.value.objects.find(o => o.apiName === 'Opportunity');
  console.log('\nVerification:');
  (verifOpp.pageLayouts || []).forEach((l, i) => {
    const totalFields = (l.tabs || []).reduce((sum, tab) =>
      sum + (tab.regions || []).reduce((s2, r) =>
        s2 + (r.panels || []).reduce((s3, pp) => s3 + (pp.fields?.length || 0), 0), 0), 0);
    console.log(`  Layout ${i}: id=${l.id}, name="${l.name}", fields=${totalFields}`);
  });
  (verifOpp.recordTypes || []).forEach(rt => {
    console.log(`  RecordType: id=${rt.id}, pageLayoutId=${rt.pageLayoutId}`);
  });

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
