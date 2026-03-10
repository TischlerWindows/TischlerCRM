const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();
  
  // Find Lead object
  const obj = await c.query(`SELECT id FROM "CustomObject" WHERE "apiName"='Lead'`);
  if (obj.rows.length === 0) {
    console.log('No Lead object found');
    await c.end();
    return;
  }
  
  // Get recent lead records
  const records = await c.query(
    `SELECT id, data, "createdAt" FROM "Record" WHERE "objectId"=$1 ORDER BY "createdAt" DESC LIMIT 3`,
    [obj.rows[0].id]
  );
  
  console.log(`Found ${records.rows.length} Lead records:\n`);
  for (const r of records.rows) {
    console.log(`Record ${r.id} (created: ${r.createdAt}):`);
    console.log('  Data keys:', Object.keys(r.data));
    console.log('  Data:', JSON.stringify(r.data, null, 2));
    console.log();
  }
  
  // Also check the Lead schema fields in the setting
  const setting = await c.query(`SELECT value FROM "Setting" WHERE key='orgSchema'`);
  if (setting.rows.length > 0) {
    const schema = JSON.parse(setting.rows[0].value);
    const leadObj = schema.objects.find(o => o.apiName === 'Lead');
    if (leadObj) {
      console.log('Lead schema fields:');
      for (const f of leadObj.fields) {
        console.log(`  ${f.apiName} (${f.type}) - ${f.label}${f.required ? ' [REQUIRED]' : ''}`);
      }
      console.log('\nLead page layouts:');
      for (const layout of (leadObj.pageLayouts || [])) {
        console.log(`  Layout: ${layout.name} (${layout.id})`);
        for (const tab of (layout.tabs || [])) {
          for (const section of (tab.sections || [])) {
            console.log(`    Section: ${section.heading}`);
            for (const field of (section.fields || [])) {
              console.log(`      - ${field.apiName}`);
            }
          }
        }
      }
    }
  }
  
  await c.end();
}
main().catch(console.error);
