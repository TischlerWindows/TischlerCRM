const { Client } = require('pg');

async function run() {
  const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');
  await c.connect();

  // List all tables
  const tables = await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`);
  console.log('=== TABLES ===');
  console.log(tables.rows.map(r => r.tablename).join(', '));

  // Check CustomObject count (was ObjectDef)
  const objDefs = await c.query(`SELECT "apiName", "label" FROM "CustomObject" ORDER BY "apiName"`);
  console.log('\n=== CustomObject records ===');
  objDefs.rows.forEach(r => console.log(`  ${r.apiName} -> ${r.label}`));
  console.log(`Total: ${objDefs.rows.length}`);

  // Check CustomField count per object
  const fieldCounts = await c.query(`SELECT o."apiName", COUNT(f.id) as cnt FROM "CustomObject" o LEFT JOIN "CustomField" f ON f."objectId" = o.id GROUP BY o."apiName" ORDER BY o."apiName"`);
  console.log('\n=== CustomField counts per object ===');
  fieldCounts.rows.forEach(r => console.log(`  ${r.apiName}: ${r.cnt} fields`));

  // Check PageLayout count (was Layout)
  const layouts = await c.query(`SELECT COUNT(*) as cnt FROM "PageLayout"`);
  console.log(`\n=== PageLayouts: ${layouts.rows[0].cnt} ===`);

  // Check LayoutTab/Section/Field counts
  const tabs = await c.query(`SELECT COUNT(*) as cnt FROM "LayoutTab"`);
  console.log(`=== LayoutTabs: ${tabs.rows[0].cnt} ===`);
  const sections = await c.query(`SELECT COUNT(*) as cnt FROM "LayoutSection"`);
  console.log(`=== LayoutSections: ${sections.rows[0].cnt} ===`);
  const lfields = await c.query(`SELECT COUNT(*) as cnt FROM "LayoutField"`);
  console.log(`=== LayoutFields: ${lfields.rows[0].cnt} ===`);

  // Check Record count
  const records = await c.query(`SELECT COUNT(*) as cnt FROM "Record"`);
  console.log(`\n=== Records: ${records.rows[0].cnt} ===`);

  // Check what objectId values are in Record (orphaned references?)
  const recordObjects = await c.query(`SELECT r."objectId", o."apiName", COUNT(*) as cnt FROM "Record" r LEFT JOIN "CustomObject" o ON o.id = r."objectId" GROUP BY r."objectId", o."apiName" ORDER BY cnt DESC`);
  console.log('\n=== Record distribution ===');
  recordObjects.rows.forEach(r => console.log(`  ${r.apiName || 'ORPHANED'} (${r.objectId}): ${r.cnt} records`));

  // Check User count  
  const users = await c.query(`SELECT "id", "email" FROM "User" ORDER BY "email"`);
  console.log('\n=== Users ===');
  users.rows.forEach(r => console.log(`  ${r.email} id=${r.id}`));

  // Check Role count
  const roles = await c.query(`SELECT "name", "label" FROM "Role" ORDER BY "name"`);
  console.log('\n=== Roles ===');
  roles.rows.forEach(r => console.log(`  ${r.name} -> ${r.label}`));

  // Check Relationship count
  const rels = await c.query(`SELECT COUNT(*) as cnt FROM "Relationship"`);
  console.log(`\n=== Relationships: ${rels.rows[0].cnt} ===`);

  // Check Integration count
  const integrations = await c.query(`SELECT COUNT(*) as cnt FROM "Integration"`);
  console.log(`=== Integrations: ${integrations.rows[0].cnt} ===`);

  // Check Setting count
  const settings = await c.query(`SELECT "key", "value" FROM "Setting" ORDER BY "key"`);
  console.log('\n=== Settings ===');
  settings.rows.forEach(r => console.log(`  ${r.key} = ${r.value}`));

  // Check Department
  const depts = await c.query(`SELECT COUNT(*) as cnt FROM "Department"`);
  console.log(`\n=== Departments: ${depts.rows[0].cnt} ===`);

  await c.end();
}

run().catch(e => { console.error(e); process.exit(1); });
