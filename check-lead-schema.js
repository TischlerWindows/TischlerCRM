// Deep diagnostic: simulate the DynamicForm rendering pipeline against production schema
const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

async function main() {
  const setting = await prisma.setting.findUnique({ where: { key: 'tces-object-manager-schema' } });
  if (!setting) { console.log('No schema'); return; }
  const schema = setting.value;
  const lead = schema.objects.find(o => o.apiName === 'Lead');
  if (!lead) { console.log('No Lead object'); return; }

  // 1. Record types and layout assignments
  console.log('=== RECORD TYPES & LAYOUT ASSIGNMENTS ===');
  console.log('defaultRecordTypeId:', lead.defaultRecordTypeId);
  (lead.recordTypes || []).forEach(rt => {
    const layoutMatch = lead.pageLayouts.find(l => l.id === rt.pageLayoutId);
    console.log(`  RT "${rt.name}" (id: ${rt.id})`);
    console.log(`    default: ${rt.default || false} | pageLayoutId: ${rt.pageLayoutId || 'NONE'}`);
    console.log(`    -> Layout: ${layoutMatch ? `"${layoutMatch.name}"` : 'NOT FOUND'}`);
  });

  // 2. Simulate DynamicForm layout resolution (layoutType='create', layoutId=...)
  console.log('\n=== LAYOUT RESOLUTION SIMULATION ===');
  lead.pageLayouts.forEach(layout => {
    console.log(`\nLayout: "${layout.name}" (id: ${layout.id}, type: ${layout.layoutType})`);
    console.log(`  Tabs: ${layout.tabs.length}`);
    
    if (!layout.tabs.length) {
      console.log('  >>> NO TABS - form would show nothing!');
      return;
    }

    const firstTab = layout.tabs[0];
    console.log(`  First tab: "${firstTab.label}" (id: ${firstTab.id})`);
    console.log(`  Sections: ${firstTab.sections.length}`);
    
    firstTab.sections.sort((a, b) => a.order - b.order).forEach((section, si) => {
      console.log(`\n  Section ${si}: "${section.label}" (columns=${section.columns}, order=${section.order})`);
      console.log(`    visibleIf: ${section.visibleIf ? JSON.stringify(section.visibleIf) : 'NONE (always visible)'}`);
      console.log(`    Total fields in section: ${section.fields.length}`);
      
      // Simulate column rendering
      for (let col = 0; col < section.columns; col++) {
        const colFields = section.fields
          .filter(f => f.column === col)
          .sort((a, b) => a.order - b.order);
        
        console.log(`    Column ${col}: ${colFields.length} fields`);
        colFields.forEach(f => {
          const fieldDef = lead.fields.find(fd => fd.apiName === f.apiName);
          const resolved = fieldDef 
            ? `✓ "${fieldDef.label}" [${fieldDef.type}]${fieldDef.visibleIf ? ' HAS visibleIf!' : ''}`
            : '✗ NOT FOUND in object fields';
          console.log(`      ${f.apiName} (col=${f.column}, order=${f.order}) => ${resolved}`);
        });
      }
    });
  });

  // 3. Check if any field has visibleIf rules that might hide it
  console.log('\n=== FIELDS WITH VISIBILITY RULES ===');
  const fieldsWithVisibility = lead.fields.filter(f => f.visibleIf && f.visibleIf.length > 0);
  if (fieldsWithVisibility.length === 0) {
    console.log('  None - all fields are always visible');
  } else {
    fieldsWithVisibility.forEach(f => {
      console.log(`  ${f.apiName}: ${JSON.stringify(f.visibleIf)}`);
    });
  }

  // 4. Specifically check Lead__status
  console.log('\n=== Lead__status FIELD DETAILS ===');
  const statusField = lead.fields.find(f => f.apiName === 'Lead__status');
  if (statusField) {
    console.log(JSON.stringify(statusField, null, 2));
  } else {
    console.log('NOT FOUND in object fields!');
    // Check for case variants
    const variants = lead.fields.filter(f => f.apiName.toLowerCase().includes('status'));
    console.log('Status-like fields:', variants.map(f => f.apiName));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
