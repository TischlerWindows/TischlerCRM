const { PrismaClient } = require('./node_modules/.pnpm/@prisma+client@5.17.0_prisma@5.17.0/node_modules/@prisma/client');
const p = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' }}
});

async function main() {
  const setting = await p.setting.findFirst({ where: { key: 'tces-object-manager-schema' } });
  if (!setting) { console.log('No org_schema found'); return; }
  const schema = setting.value;
  for (const obj of (schema.objects || [])) {
    if (!obj.pageLayouts || obj.pageLayouts.length === 0) continue;
    for (const layout of obj.pageLayouts) {
      const editorTabs = layout.extensions?.editorTabs;
      const tabs = editorTabs?.length > 0 ? editorTabs : layout.tabs;
      const isEditor = editorTabs?.length > 0;
      console.log(`\n${obj.apiName} > ${layout.name} (${isEditor ? 'editor' : 'standard'}, active=${layout.active}):`);
      for (let ti = 0; ti < (tabs || []).length; ti++) {
        const t = tabs[ti];
        const regions = t.regions || [];
        const sections = t.sections || [];
        if (regions.length > 0) {
          console.log(`  tab ${ti} "${t.label}": ${regions.length} regions`);
          for (const reg of regions) {
            console.log(`    region "${reg.label}": ${(reg.panels||[]).length} panels, ${(reg.widgets||[]).length} widgets`);
            for (const pan of (reg.panels || [])) {
              console.log(`      panel "${pan.label}" type=${pan.panelType||'fields'} fields=${(pan.fields||[]).length} widgets=${(pan.widgets||[]).length}`);
            }
            for (const w of (reg.widgets || [])) {
              console.log(`      widget: ${w.widgetType}`);
            }
          }
        } else if (sections.length > 0) {
          console.log(`  tab ${ti} "${t.label}": ${sections.length} sections (legacy)`);
        }
      }
    }
  }
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
