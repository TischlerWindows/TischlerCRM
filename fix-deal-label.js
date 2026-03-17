const { Client } = require('pg');

async function run() {
  const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
  await c.connect();

  const schema = await c.query(`SELECT "value" FROM "Setting" WHERE "key" = 'tces-object-manager-schema'`);
  if (schema.rows.length === 0) {
    console.log('Schema setting not found!');
    await c.end();
    return;
  }

  const val = schema.rows[0].value;
  const dealObj = val.objects?.find(o => o.apiName === 'Deal');
  if (!dealObj) {
    console.log('Deal object not found in schema!');
    await c.end();
    return;
  }

  console.log('BEFORE:');
  console.log('  label:', dealObj.label);
  console.log('  pluralLabel:', dealObj.pluralLabel);

  // Fix the labels
  dealObj.label = 'Deal';
  dealObj.pluralLabel = 'Deals';

  // Also rename the layout that says "Opportunity"
  if (dealObj.pageLayouts) {
    dealObj.pageLayouts.forEach(pl => {
      if (pl.name && pl.name.includes('Opportunity')) {
        const oldName = pl.name;
        pl.name = pl.name.replace('Opportunity', 'Deal');
        console.log(`  Renamed layout: "${oldName}" -> "${pl.name}"`);
      }
    });
  }

  // Bump version
  val.version = (val.version || 0) + 1;
  val.updatedAt = new Date().toISOString();

  // Save back
  await c.query(`UPDATE "Setting" SET "value" = $1 WHERE "key" = 'tces-object-manager-schema'`, [JSON.stringify(val)]);

  console.log('\nAFTER:');
  console.log('  label:', dealObj.label);
  console.log('  pluralLabel:', dealObj.pluralLabel);
  console.log('  version:', val.version);
  console.log('\nDone! Deal label restored.');

  await c.end();
}

run().catch(e => { console.error(e); process.exit(1); });
