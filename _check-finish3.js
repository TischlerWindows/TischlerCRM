const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
c.connect().then(async () => {
  const r = await c.query(`
    SELECT p.title AS preset, v.title AS variant, v."matchValue"
    FROM "SpecPreset" p
    JOIN "SpecVariant" v ON v."presetId" = p.id
    WHERE p."driverField" LIKE '%finishType%'
    ORDER BY p.title, v."order"
  `);
  r.rows.forEach(row => {
    console.log(`Preset: ${row.preset} | Variant: ${row.variant} | matchValue: ${JSON.stringify(row.matchValue)}`);
  });
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
