// Fix missing comma before Upload in lucide imports
const fs = require('fs');
const path = require('path');

const root = 'c:\\dev\\crm-monorepo';
const pages = [
  'apps/web/app/contacts/page.tsx',
  'apps/web/app/leads/page.tsx',
  'apps/web/app/accounts/page.tsx',
  'apps/web/app/properties/page.tsx',
  'apps/web/app/opportunities/page.tsx',
  'apps/web/app/projects/page.tsx',
  'apps/web/app/service/page.tsx',
  'apps/web/app/quotes/page.tsx',
  'apps/web/app/installations/page.tsx',
  'apps/web/app/products/page.tsx',
  'apps/web/app/workorders/page.tsx',
  'apps/web/app/tasks/page.tsx',
];

for (const page of pages) {
  const filePath = path.join(root, page);
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix: "GripVertical\n  Upload," -> "GripVertical,\n  Upload,"
  // The issue is the last icon before Upload didn't have a comma
  const fixed = content.replace(/(\w+)\n(\s+Upload,\n\} from 'lucide-react';)/, '$1,\n$2');
  
  if (fixed !== content) {
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log(`✅ Fixed comma in ${page}`);
  } else {
    console.log(`⏩ ${page}: already correct`);
  }
}

console.log('Done!');
