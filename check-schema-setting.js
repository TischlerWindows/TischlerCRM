const { Client } = require('pg');

async function run() {
  const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
  await c.connect();

  // Check the schema setting
  const schemaResult = await c.query(`SELECT "key", length("value"::text) as val_len FROM "Setting" ORDER BY "key"`);
  console.log('=== Settings (key + value length) ===');
  schemaResult.rows.forEach(r => console.log(`  ${r.key}: ${r.val_len} chars`));

  // Get the full schema setting value
  const schema = await c.query(`SELECT "value" FROM "Setting" WHERE "key" = 'tces-object-manager-schema'`);
  if (schema.rows.length > 0) {
    const val = schema.rows[0].value;
    console.log('\n=== Schema Setting ===');
    console.log('Type:', typeof val);
    
    if (typeof val === 'object' && val !== null) {
      console.log('Version:', val.version);
      console.log('UpdatedAt:', val.updatedAt);
      if (val.objects && Array.isArray(val.objects)) {
        console.log('Objects count:', val.objects.length);
        val.objects.forEach(obj => {
          console.log(`  ${obj.apiName} (${obj.label}): ${obj.fields?.length || 0} fields, ${obj.pageLayouts?.length || 0} layouts`);
        });
      } else {
        console.log('No objects array found. Keys:', Object.keys(val));
      }
    } else {
      console.log('Value (first 500 chars):', JSON.stringify(val).substring(0, 500));
    }
  } else {
    console.log('\n!!! tces-object-manager-schema setting NOT FOUND !!!');
  }

  // Check versions
  const versions = await c.query(`SELECT "value" FROM "Setting" WHERE "key" = 'tces-object-manager-versions'`);
  if (versions.rows.length > 0) {
    const val = versions.rows[0].value;
    if (Array.isArray(val)) {
      console.log('\n=== Schema Versions ===');
      console.log('Count:', val.length);
      val.forEach((v, i) => {
        console.log(`  v${i}: version=${v.version}, updatedAt=${v.updatedAt}, objects=${v.objects?.length || v.schema?.objects?.length || '?'}`);
      });
    }
  }

  await c.end();
}

run().catch(e => { console.error(e); process.exit(1); });
