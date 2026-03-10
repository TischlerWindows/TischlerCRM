const https = require('https');

const API_HOST = 'api-production-e4e8.up.railway.app';
const loginData = JSON.stringify({ email: 'admin@crm.local', password: 'admin123' });

function httpsRequest(opts, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

(async () => {
  // Login
  const { token } = await httpsRequest({
    hostname: API_HOST, path: '/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);

  // Load schema
  const settingRes = await httpsRequest({
    hostname: API_HOST, path: '/settings/tces-object-manager-schema',
    headers: { Authorization: 'Bearer ' + token }
  });
  const schema = settingRes.value || settingRes;
  if (!schema || !schema.objects) {
    console.log('Failed to load schema:', JSON.stringify(settingRes).substring(0, 500));
    return;
  }

  console.log('=== Layout Field Resolution Report ===\n');

  for (const obj of schema.objects) {
    const fieldApiNames = new Set(obj.fields.map(f => f.apiName));
    for (const layout of obj.pageLayouts || []) {
      let total = 0, missing = 0;
      const missingList = [];
      for (const tab of layout.tabs || []) {
        for (const sec of tab.sections || []) {
          for (const f of sec.fields || []) {
            total++;
            if (!fieldApiNames.has(f.apiName)) {
              missing++;
              missingList.push(f.apiName);
            }
          }
        }
      }
      const status = missing > 0 ? `MISSING ${missing}` : 'all resolved ✓';
      console.log(`${obj.apiName} | "${layout.name}" | ${total} fields | ${status}`);
      if (missing > 0) {
        console.log(`  Missing: ${missingList.join(', ')}`);
      }
    }
  }

  // Deep dive into Lead
  console.log('\n=== Lead Layout Deep Dive ===');
  const lead = schema.objects.find(o => o.apiName === 'Lead');
  if (lead) {
    console.log(`Lead has ${lead.fields.length} fields`);
    
    // Find which layout the default RT points to
    const defaultRt = lead.defaultRecordTypeId
      ? lead.recordTypes?.find(r => r.id === lead.defaultRecordTypeId)
      : lead.recordTypes?.[0];
    console.log(`Default RT: ${defaultRt?.name} → layoutId: ${defaultRt?.pageLayoutId}`);
    
    for (const layout of lead.pageLayouts || []) {
      console.log(`\nLayout: "${layout.name}" (id=${layout.id})`);
      for (const tab of layout.tabs || []) {
        for (const sec of tab.sections || []) {
          console.log(`  Section: "${sec.label}" (${sec.fields?.length || 0} fields)`);
          for (const f of sec.fields || []) {
            const inObj = lead.fields.find(fd => fd.apiName === f.apiName);
            const hasEmbedded = !!(f.type && f.label);
            console.log(`    ${f.apiName} col=${f.column} ord=${f.order} ` +
              `embedded=${hasEmbedded} inObj=${!!inObj}` +
              (inObj ? ` type=${inObj.type}` : ' NOT FOUND'));
          }
        }
      }
    }
  }
})();
