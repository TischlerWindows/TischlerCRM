const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient();
async function main() {
  try {
    const count = await p.setting.count();
    console.log('Setting count:', count);
    const settings = await p.setting.findMany({ select: { key: true } });
    settings.forEach(s => console.log('  -', s.key));
  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
}
main();
