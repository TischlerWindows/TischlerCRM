const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } } });

async function main() {
  const obj = await p.customObject.findFirst({ where: { apiName: 'Opportunity' } });
  console.log('Opportunity objectId:', obj?.id);

  // Check page layouts for Opportunity
  const layouts = await p.pageLayout.findMany({ where: { objectId: obj.id } });
  console.log('\n=== Available Page Layouts ===');
  layouts.forEach(l => console.log(l.id, '|', l.name, '| type:', l.layoutType));

  // Check records
  const recs = await p.record.findMany({
    where: { objectId: obj.id, deletedAt: null },
    select: { id: true, pageLayoutId: true, data: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log('\n=== Opportunity Records ===');
  recs.forEach(rec => {
    const d = rec.data || {};
    console.log(
      rec.id,
      '| DB pageLayoutId:', rec.pageLayoutId,
      '| data._pageLayoutId:', d._pageLayoutId,
      '| data.pageLayoutId:', d.pageLayoutId,
      '| name:', d.Opportunity__name || d.name
    );
  });

  // No RecordType table in production

  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
