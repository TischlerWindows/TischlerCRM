// Normalize field types in the production schema
// Maps lowercase variants and aliases to canonical FieldType values
const { PrismaClient } = require('./packages/db/node_modules/@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

const CANONICAL = {
  autonumber: 'AutoNumber',
  formula: 'Formula',
  rollupsummary: 'RollupSummary',
  lookup: 'Lookup',
  externallookup: 'ExternalLookup',
  checkbox: 'Checkbox',
  currency: 'Currency',
  date: 'Date',
  datetime: 'DateTime',
  email: 'Email',
  geolocation: 'Geolocation',
  number: 'Number',
  percent: 'Percent',
  phone: 'Phone',
  picklist: 'Picklist',
  multipicklist: 'MultiPicklist',
  multiselectpicklist: 'MultiPicklist',
  text: 'Text',
  textarea: 'TextArea',
  longtextarea: 'LongTextArea',
  richtextarea: 'RichTextArea',
  encryptedtext: 'EncryptedText',
  time: 'Time',
  url: 'URL',
  address: 'Address',
  compositetext: 'CompositeText',
};

function normalizeType(raw) {
  return CANONICAL[raw.toLowerCase()] || raw;
}

async function main() {
  const setting = await prisma.setting.findUnique({ where: { key: 'tces-object-manager-schema' } });
  if (!setting) { console.log('No schema found'); return; }
  const schema = setting.value;
  
  let changes = 0;
  for (const obj of schema.objects) {
    for (const field of obj.fields) {
      const normalized = normalizeType(field.type);
      if (normalized !== field.type) {
        console.log(`  ${obj.apiName}.${field.apiName}: "${field.type}" -> "${normalized}"`);
        field.type = normalized;
        changes++;
      }
    }
  }
  
  if (changes === 0) {
    console.log('No field types needed normalization.');
    return;
  }
  
  console.log(`\nNormalizing ${changes} field types...`);
  await prisma.setting.update({
    where: { key: 'tces-object-manager-schema' },
    data: { value: schema }
  });
  console.log('Done! Schema updated.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
