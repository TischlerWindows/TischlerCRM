const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();
  
  const s = await c.query("SELECT value FROM \"Setting\" WHERE key='tces-object-manager-schema'");
  const schema = s.rows[0].value;
  
  // Find Lead object
  const leadObj = schema.objects.find(o => o.label === 'Lead' || o.apiName === 'Lead');
  if (!leadObj) {
    console.log('No Lead object found. Available objects:', schema.objects.map(o => o.label));
    await c.end();
    return;
  }
  
  console.log('=== LEAD OBJECT ===');
  console.log('Label:', leadObj.label);
  console.log('ApiName:', leadObj.apiName);
  console.log('\n=== LEAD FIELDS ===');
  leadObj.fields.forEach(f => {
    console.log(`  ${f.apiName} (${f.type}) - "${f.label}" ${f.required ? '[REQUIRED]' : ''}`);
  });
  
  console.log('\n=== LEAD PAGE LAYOUTS ===');
  if (leadObj.pageLayouts) {
    leadObj.pageLayouts.forEach(layout => {
      console.log(`\nLayout: ${layout.name} (id: ${layout.id})`);
      if (layout.tabs) {
        layout.tabs.forEach(tab => {
          console.log(`  Tab: ${tab.label}`);
          if (tab.sections) {
            tab.sections.forEach(section => {
              console.log(`    Section: ${section.label} (columns: ${section.columns})`);
              if (section.fields) {
                section.fields.forEach(f => {
                  console.log(`      Field: ${f.apiName} (${f.label})`);
                });
              }
            });
          }
        });
      }
    });
  } else {
    console.log('No page layouts defined for Lead');
  }
  
  // Also check a recent Lead record's data keys
  const records = await c.query(`
    SELECT r.data FROM "Record" r
    JOIN "CustomObject" co ON r."customObjectId" = co.id
    WHERE co."apiName" = 'Lead'
    ORDER BY r."createdAt" DESC LIMIT 1
  `);
  if (records.rows.length > 0) {
    console.log('\n=== LATEST LEAD RECORD DATA KEYS ===');
    const data = records.rows[0].data;
    Object.keys(data).forEach(k => {
      console.log(`  ${k}: ${JSON.stringify(data[k]).substring(0, 80)}`);
    });
  }
  
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
