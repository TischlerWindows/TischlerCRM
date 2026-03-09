const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient({ datasourceUrl: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' });

(async () => {
  const users = await p.user.findMany({
    where: { role: 'USER' },
    include: { department: true },
    take: 5,
  });
  for (const u of users) {
    console.log('\n=== User:', u.email, '| Role:', u.role, '| Dept:', u.department?.name || 'NONE');
    const perms = u.department?.permissions;
    if (perms) {
      console.log(JSON.stringify(perms, null, 2));
    } else {
      console.log('NO PERMISSIONS');
    }
  }
  await p.$disconnect();
})();
