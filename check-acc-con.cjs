const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const db = new PrismaClient({ datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' });
(async () => {
  const acc = await db.record.findFirst({ where: { id: '2e44d13b-c455-4d9c-b2cf-d75127d57872' } });
  if (acc) {
    const d = acc.data;
    console.log('ACCOUNT objectId:', acc.objectId);
    Object.keys(d).forEach(k => {
      const v = JSON.stringify(d[k]);
      if (k.toLowerCase().includes('name') || k.toLowerCase().includes('phone') || k.toLowerCase().includes('ship') || k.toLowerCase().includes('address')) {
        console.log('  ACC:', k, '=', v.substring(0, 150));
      }
    });
  }
  const con = await db.record.findFirst({ where: { id: '1e0b934c-030b-44f9-9eba-f5df99545ea0' } });
  if (con) {
    const d = con.data;
    console.log('CONTACT objectId:', con.objectId);
    Object.keys(d).forEach(k => {
      const v = JSON.stringify(d[k]);
      if (k.toLowerCase().includes('name') || k.toLowerCase().includes('first') || k.toLowerCase().includes('last')) {
        console.log('  CON:', k, '=', v.substring(0, 150));
      }
    });
  }
  await db.$disconnect();
})();
