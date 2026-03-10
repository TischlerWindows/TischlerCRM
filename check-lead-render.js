// Check exactly what the DynamicForm would see for Lead__status
const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

async function main() {
  const setting = await prisma.setting.findUnique({ where: { key: 'tces-object-manager-schema' } });
  if (!setting) { console.log('No schema found'); return; }
  const schema = setting.value;
  const lead = schema.objects.find(o => o.apiName === 'Lead');
  if (!lead) { console.log('No Lead object'); return; }

  // 0. Check for duplicate Lead objects
  const leadObjects = schema.objects.filter(o => o.apiName === 'Lead');
  console.log('=== LEAD OBJECTS COUNT:', leadObjects.length, '===');

  // 1. Show all field apiNames + labels
  console.log('=== LEAD FIELDS (apiName -> label -> type) ===');
  console.log('  Total field count:', lead.fields.length);
  lead.fields.forEach(f => {
    console.log(`  ${f.apiName}  ->  "${f.label}"  [${f.type}]`);
  });
  
  // Check for duplicate fields  
  const fieldNames = lead.fields.map(f => f.apiName);
  const dupes = fieldNames.filter((name, i) => fieldNames.indexOf(name) !== i);
  if (dupes.length > 0) {
    console.log('  *** DUPLICATE FIELD NAMES:', dupes);
  }

  // 2. Check if Lead__status is in the fields
  const statusField = lead.fields.find(f => f.apiName === 'Lead__status');
  console.log('\n=== Lead__status field def ===');
  console.log(statusField ? JSON.stringify(statusField, null, 2) : 'NOT FOUND');

  // 3. Also check for 'status' (without prefix) 
  const statusNoPrefixField = lead.fields.find(f => f.apiName === 'status');
  console.log('\n=== status (no prefix) field def ===');
  console.log(statusNoPrefixField ? JSON.stringify(statusNoPrefixField, null, 2) : 'NOT FOUND');

  // 4. Show layout field references
  console.log('\n=== LAYOUT FIELDS ===');
  lead.pageLayouts.forEach(layout => {
    console.log(`\nLayout: "${layout.name}" (id: ${layout.id})`);
    layout.tabs.forEach(tab => {
      tab.sections.forEach(section => {
        console.log(`  Section: "${section.label}"`);
        section.fields.forEach(f => {
          // Check if getFieldDef would find it
          const fieldDef = lead.fields.find(fd => fd.apiName === f.apiName);
          const found = fieldDef ? `FOUND (label: "${fieldDef.label}", type: ${fieldDef.type})` : 'NOT FOUND <<<';
          console.log(`    ${f.apiName} [col:${f.column}, order:${f.order}] => ${found}`);
        });
      });
    });
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
