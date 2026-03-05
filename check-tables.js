const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@5.17.0_prisma@5.17.0/node_modules/@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:iZLCHmGgnWVIzWiINGsTSHelChTYMzXn@crossover.proxy.rlwy.net:22572/railway' } }
});

async function main() {
  try {
    const tables = await p.$queryRawUnsafe("SELECT table_name::text FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('Tables:', JSON.stringify(tables, null, 2));
    
    // Try accessing Setting table
    try {
      const settings = await p.setting.findMany();
      console.log('Settings count:', settings.length);
    } catch (e) {
      console.log('Setting table error:', e.message);
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await p.$disconnect();
  }
}
main();
