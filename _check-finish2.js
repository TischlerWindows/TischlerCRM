const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
c.connect().then(async () => {
  const r = await c.query("SELECT value FROM \"Setting\" WHERE key='summaries'");
  if (!r.rows[0]) { console.log('no summaries found'); await c.end(); return; }
  const summaries = r.rows[0].value;
  const arr = Array.isArray(summaries) ? summaries : [];
  arr.forEach((s, i) => {
    console.log(`--- Summary ${i}: ${s.name || s.id} ---`);
    console.log('finish:', JSON.stringify(s.finish));
    console.log('finishType:', JSON.stringify(s.finishType));
  });
  await c.end();
}).catch(e => { console.error(e.message); process.exit(1); });
