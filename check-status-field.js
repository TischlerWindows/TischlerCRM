const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();
  const s = await c.query("SELECT value FROM \"Setting\" WHERE key='tces-object-manager-schema'");
  const schema = s.rows[0].value;
  const leadObj = schema.objects.find(o => o.apiName === 'Lead');

  // Find the Status field definition
  const statusField = leadObj.fields.find(f => f.apiName === 'Lead__status');
  console.log('=== Lead__status FULL FIELD DEFINITION ===');
  console.log(JSON.stringify(statusField, null, 2));

  // Check all Picklist type fields for picklistValues
  console.log('\n=== ALL PICKLIST FIELDS ===');
  leadObj.fields.filter(f => f.type === 'Picklist').forEach(f => {
    console.log(`${f.apiName}: picklistValues = ${JSON.stringify(f.picklistValues)}`);
  });

  // Check the FieldType type support in schema
  const allTypes = new Set(leadObj.fields.map(f => f.type));
  console.log('\n=== ALL FIELD TYPES USED ===');
  console.log([...allTypes].sort().join(', '));

  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
