const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
c.connect().then(async () => {
  const r = await c.query("SELECT value FROM \"Setting\" WHERE key='tces-object-manager-schema'");
  const schema = r.rows[0].value;
  const opp = schema.objects.find(o => o.apiName === 'Opportunity');
  const fs = opp.fields.filter(f => /finish/i.test(f.apiName) || /finish/i.test(f.label || ''));
  fs.forEach(x => console.log(x.apiName, '|', x.label, '|', JSON.stringify(x.picklistValues)));
  await c.end();
}).catch(e => { console.error(e); process.exit(1); });
