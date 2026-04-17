const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const p = new PrismaClient();

(async () => {
  const r = await p.record.findUnique({ where: { id: '0016yiBxjDXyO2D' } });
  const d = r.data;
  console.log('ALL keys for 0016yiBxjDXyO2D:');
  for (const [k, v] of Object.entries(d)) {
    const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
    console.log(`  ${k} [${typeof v}] = ${display.substring(0, 100)}`);
  }
  await p['$disconnect']();
})();
