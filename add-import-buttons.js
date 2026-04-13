// Script to add CSV import button to all list pages
const fs = require('fs');
const path = require('path');

const pages = [
  { file: 'apps/web/app/contacts/page.tsx', apiName: 'Contact', label: 'Contact' },
  { file: 'apps/web/app/leads/page.tsx', apiName: 'Lead', label: 'Lead' },
  { file: 'apps/web/app/accounts/page.tsx', apiName: 'Account', label: 'Account' },
  { file: 'apps/web/app/properties/page.tsx', apiName: 'Property', label: 'Property' },
  { file: 'apps/web/app/opportunities/page.tsx', apiName: 'Opportunity', label: 'Opportunity' },
  { file: 'apps/web/app/projects/page.tsx', apiName: 'Project', label: 'Project' },
  { file: 'apps/web/app/service/page.tsx', apiName: 'Service', label: 'Service' },
  { file: 'apps/web/app/quotes/page.tsx', apiName: 'Quote', label: 'Quote' },
  { file: 'apps/web/app/installations/page.tsx', apiName: 'Installation', label: 'Installation' },
  { file: 'apps/web/app/products/page.tsx', apiName: 'Product', label: 'Product' },
  { file: 'apps/web/app/workorders/page.tsx', apiName: 'WorkOrder', label: 'Work Order' },
  { file: 'apps/web/app/tasks/page.tsx', apiName: 'Task', label: 'Task' },
];

const root = 'c:\\dev\\crm-monorepo';

for (const page of pages) {
  const filePath = path.join(root, page.file);
  let content = fs.readFileSync(filePath, 'utf8');
  const origLen = content.length;
  let changes = [];

  // 1. Add Upload to lucide-react import
  if (!content.includes("Upload,") && !content.includes("Upload }")) {
    // Find the closing of lucide-react import
    const lucideMatch = content.match(/} from 'lucide-react';/);
    if (lucideMatch) {
      content = content.replace(
        "} from 'lucide-react';",
        "  Upload,\n} from 'lucide-react';"
      );
      changes.push('added Upload icon');
    }
  }

  // 2. Add CsvImportDialog import after DynamicFormDialog import
  if (!content.includes('csv-import-dialog')) {
    content = content.replace(
      "import DynamicFormDialog from '@/components/dynamic-form-dialog';",
      "import DynamicFormDialog from '@/components/dynamic-form-dialog';\nimport CsvImportDialog from '@/components/csv-import-dialog';"
    );
    changes.push('added CsvImportDialog import');
  }

  // 3. Add hasAppPermission to usePermissions destructuring
  if (!content.includes('hasAppPermission')) {
    content = content.replace(
      "const { canAccess } = usePermissions();",
      "const { canAccess, hasAppPermission } = usePermissions();"
    );
    changes.push('added hasAppPermission');
  }

  // 4. Add showImportDialog state (after the last useState that has 'show' in it)
  if (!content.includes('showImportDialog')) {
    // Find a good place - after showDynamicForm or showFilterSettings state
    const stateMatch = content.match(/const \[showFilterSettings, setShowFilterSettings\] = useState[^;]+;/);
    if (stateMatch) {
      content = content.replace(
        stateMatch[0],
        stateMatch[0] + '\n  const [showImportDialog, setShowImportDialog] = useState(false);'
      );
      changes.push('added showImportDialog state');
    } else {
      // Try after showDynamicForm
      const altMatch = content.match(/const \[showDynamicForm, setShowDynamicForm\] = useState[^;]+;/);
      if (altMatch) {
        content = content.replace(
          altMatch[0],
          altMatch[0] + '\n  const [showImportDialog, setShowImportDialog] = useState(false);'
        );
        changes.push('added showImportDialog state (alt)');
      }
    }
  }

  // 5. Add Import button before Configure Columns button
  if (!content.includes('setShowImportDialog(true)')) {
    const configureColumnsBtn = `<button
              onClick={() => setShowFilterSettings(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configure Columns
            </button>`;

    // Also try compressed version
    const compressedConfigureBtn = `<button\n              onClick={() => setShowFilterSettings(true)}\n              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"\n            >\n              <Settings className="w-5 h-5 mr-2" />\n              Configure Columns\n            </button>`;
    
    const importBtn = `{hasAppPermission('importData') && (
              <button
                onClick={() => setShowImportDialog(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Upload className="w-5 h-5 mr-2" />
                Import
              </button>
            )}
            `;

    if (content.includes(configureColumnsBtn)) {
      content = content.replace(configureColumnsBtn, importBtn + configureColumnsBtn);
      changes.push('added Import button');
    } else {
      // Try to find in a more flexible way
      const regex = /(<button\s+onClick=\{[^}]*setShowFilterSettings\(true\)[^}]*\}\s+className="inline-flex[^"]*"\s*>\s*<Settings[^/]*\/>\s*Configure Columns\s*<\/button>)/s;
      const match = content.match(regex);
      if (match) {
        content = content.replace(match[0], importBtn + match[0]);
        changes.push('added Import button (regex)');
      } else {
        changes.push('COULD NOT find Configure Columns button!');
      }
    }
  }

  // 6. Add CsvImportDialog component before </div></div> at end of component
  if (!content.includes('<CsvImportDialog')) {
    // Find the closing of the component - look for the last </div>\n    </div>\n  );\n}
    const dialogJsx = `
      {/* CSV Import */}
      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        objectApiName="${page.apiName}"
        objectLabel="${page.label}"
        onImportComplete={() => fetch${page.apiName === 'WorkOrder' ? 'WorkOrders' : page.apiName === 'Opportunity' ? 'Records' : page.apiName + 's'}()}
      />`;

    // Find the fetchX function name by looking for the actual function
    const fetchMatch = content.match(/const (fetch\w+)\s*=\s*useCallback/);
    const fetchFn = fetchMatch ? fetchMatch[1] : `fetch${page.apiName}s`;

    const dialogJsxFixed = `
      {/* CSV Import */}
      <CsvImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        objectApiName="${page.apiName}"
        objectLabel="${page.label}"
        onImportComplete={() => ${fetchFn}()}
      />`;

    // Insert before the last two closing </div> tags and );
    // Find pattern: </div>\n    </div>\n  );\n}
    const endMatch = content.match(/(\n\s*<\/div>\s*\n\s*<\/div>\s*\n\s*\);\s*\n\})\s*$/);
    if (endMatch) {
      const insertPos = content.lastIndexOf(endMatch[0]);
      content = content.slice(0, insertPos) + dialogJsxFixed + endMatch[0] + '\n';
      changes.push(`added CsvImportDialog (fetchFn=${fetchFn})`);
    } else {
      // try simpler pattern
      const simpleEnd = content.lastIndexOf('  );\n}');
      if (simpleEnd > 0) {
        // find the </div> just before it
        const beforeEnd = content.lastIndexOf('</div>', simpleEnd);
        if (beforeEnd > 0) {
          // find the </div> before that one
          const beforeEnd2 = content.lastIndexOf('</div>', beforeEnd - 1);
          if (beforeEnd2 > 0) {
            content = content.slice(0, beforeEnd2) + dialogJsxFixed + '\n      ' + content.slice(beforeEnd2);
            changes.push(`added CsvImportDialog alt (fetchFn=${fetchFn})`);
          }
        }
      }
    }
  }

  if (changes.length > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${page.file}: ${changes.join(', ')}`);
  } else {
    console.log(`⏩ ${page.file}: no changes needed`);
  }
}

console.log('\nDone!');
