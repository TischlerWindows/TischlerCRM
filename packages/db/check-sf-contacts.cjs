const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

async function main() {
  const obj = await prisma.customObject.findFirst({ where: { apiName: { equals: 'Contact', mode: 'insensitive' } } });
  if (!obj) { console.log('No Contact object'); return; }

  const recs = await prisma.record.findMany({
    where: { objectId: obj.id },
    take: 8,
    orderBy: { createdAt: 'desc' }
  });

  for (const r of recs) {
    const d = r.data;
    const nameObj = d.name && typeof d.name === 'object' ? d.name : {};
    const fn = nameObj['Contact__name_firstName'] || '?';
    const ln = nameObj['Contact__name_lastName'] || '?';
    const fid = d._dropboxFolderId || '(none)';
    const cn = d.contactNumber || '(none)';
    const sfId = d.__sfId || '(none)';
    console.log(r.id.slice(0, 8), '| name:', fn, ln, '| contactNumber:', cn, '| folderId:', fid, '| __sfId:', sfId);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
