const { Client } = require('pg');
const c = new Client('postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway');

async function main() {
  await c.connect();
  const s = await c.query("SELECT value FROM \"Setting\" WHERE key='tces-object-manager-schema'");
  const schema = s.rows[0].value;
  const leadObj = schema.objects.find(o => o.apiName === 'Lead');

  console.log('=== LEAD PAGE LAYOUTS - DETAILED SECTION FIELD DATA ===\n');
  for (const layout of leadObj.pageLayouts) {
    console.log(`Layout: "${layout.name}" (id: ${layout.id})`);
    for (const tab of layout.tabs) {
      console.log(`  Tab: "${tab.label}" (id: ${tab.id})`);
      for (const section of tab.sections) {
        console.log(`    Section: "${section.label}" (columns: ${section.columns}, order: ${section.order})`);
        console.log(`    Fields (${section.fields.length}):`);
        for (const f of section.fields) {
          console.log(`      apiName: ${f.apiName}, column: ${f.column}, order: ${f.order}, type: ${typeof f.column}`);
        }
      }
    }
    console.log('');
  }

  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
