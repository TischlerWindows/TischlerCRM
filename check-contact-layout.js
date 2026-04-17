const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}});

(async () => {
  const r = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' }});
  if (!r) {
    // Try other key patterns
    const all = await p.setting.findMany({ take: 20, select: { key: true }});
    console.log('Available setting keys:', all.map(s => s.key));
    await p.$disconnect();
    return;
  }
  const schema = r.value;
  const contact = schema.objects.find(o => o.apiName === 'Contact');
  console.log('LAYOUTS:', contact.pageLayouts.length);
  contact.pageLayouts.forEach((l, i) => {
    console.log(`\nLayout ${i}: id=${l.id}, name="${l.name}", type=${l.layoutType}`);
    (l.tabs || []).forEach((t, ti) => {
      console.log(`  Tab ${ti}: "${t.label}"`);
      (t.regions || []).forEach((r, ri) => {
        (r.panels || []).forEach((p, pi) => {
          console.log(`    Panel ${pi}: "${p.label}" fields=${(p.fields || []).length}`);
          (p.fields || []).forEach(f => console.log(`      - ${f.fieldApiName}`));
        });
        (r.widgets || []).forEach(w => console.log(`    Widget: ${w.widgetId || w.type || JSON.stringify(w)}`));
      });
    });
  });

  // Check record types and default
  console.log('\nRecord Types:', contact.recordTypes?.length || 0);
  (contact.recordTypes || []).forEach(rt => {
    console.log(`  RT: id=${rt.id}, name="${rt.name}", layoutId=${rt.pageLayoutId}`);
  });
  console.log('Default RT:', contact.defaultRecordTypeId);

  // Check a Contact record's pageLayoutId
  const cObj = await p.customObject.findFirst({ where: { apiName: { equals: 'Contact', mode: 'insensitive' }}});
  if (cObj) {
    const recs = await p.record.findMany({ where: { objectId: cObj.id }, take: 2 });
    recs.forEach(rec => {
      const data = rec.data;
      console.log(`\nRecord ${rec.id}: pageLayoutId=${rec.pageLayoutId}, _pageLayoutId=${data._pageLayoutId || data.pageLayoutId}`);
    });
  }

  await p.$disconnect();
})();
