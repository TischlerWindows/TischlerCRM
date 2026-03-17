const { Client } = require('pg');

async function run() {
  const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
  await c.connect();

  const schema = await c.query(`SELECT "value" FROM "Setting" WHERE "key" = 'tces-object-manager-schema'`);
  if (schema.rows.length > 0) {
    const val = schema.rows[0].value;
    const dealObj = val.objects?.find(o => o.apiName === 'Deal');
    if (dealObj) {
      console.log('=== Deal Object in Schema Setting ===');
      console.log('apiName:', dealObj.apiName);
      console.log('label:', dealObj.label);
      console.log('pluralLabel:', dealObj.pluralLabel);
      console.log('description:', dealObj.description);
      console.log('fields count:', dealObj.fields?.length);
      console.log('pageLayouts count:', dealObj.pageLayouts?.length);
      if (dealObj.pageLayouts) {
        dealObj.pageLayouts.forEach((pl, i) => {
          console.log(`  Layout ${i}: name="${pl.name}", layoutType="${pl.layoutType}"`);
        });
      }
    } else {
      console.log('Deal object NOT FOUND in schema setting!');
      console.log('Available objects:', val.objects.map(o => `${o.apiName} (${o.label})`).join(', '));
    }
  }

  // Also check what the API returns for Deal
  const dealInDb = await c.query(`SELECT "apiName", "label", "pluralLabel" FROM "CustomObject" WHERE "apiName" = 'Deal'`);
  console.log('\n=== Deal in CustomObject table ===');
  if (dealInDb.rows.length > 0) {
    console.log(dealInDb.rows[0]);
  } else {
    console.log('Not found!');
  }

  await c.end();
}

run().catch(e => { console.error(e); process.exit(1); });
