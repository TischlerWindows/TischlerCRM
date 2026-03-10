const https = require('https');

const loginData = JSON.stringify({ email: 'admin@crm.local', password: 'admin123' });
const loginOpts = {
  hostname: 'api-production-e4e8.up.railway.app',
  path: '/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
};

const req = https.request(loginOpts, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    console.log('Login response:', body.substring(0, 200));
    const parsed = JSON.parse(body);
    if (!parsed.token) {
      console.log('Login failed:', parsed);
      return;
    }
    const token = parsed.token;
    const settOpts = {
      hostname: 'api-production-e4e8.up.railway.app',
      path: '/settings/tces-object-manager-schema',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + token }
    };
    const req2 = https.request(settOpts, (res2) => {
      let body2 = '';
      res2.on('data', (d) => body2 += d);
      res2.on('end', () => {
        const setting = JSON.parse(body2);
        console.log('Setting keys:', Object.keys(setting));
        console.log('Setting.key:', setting.key);
        const schema = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
        if (!schema || !schema.objects) {
          console.log('RAW response (first 500 chars):', body2.substring(0, 500));
          return;
        }
        const lead = schema.objects.find(o => o.apiName === 'Lead');
        console.log('Lead object found:', !!lead);
        console.log('Lead fields count:', lead.fields.length);
        console.log('Lead layouts:', lead.pageLayouts.map(l => ({ id: l.id, name: l.name })));
        console.log('Lead recordTypes:', lead.recordTypes);
        console.log('defaultRecordTypeId:', lead.defaultRecordTypeId);
        
        const statusField = lead.fields.find(f => f.apiName === 'Lead__status');
        console.log('\nLead__status field:', JSON.stringify(statusField, null, 2));
        
        lead.pageLayouts.forEach(layout => {
          console.log('\n--- Layout:', layout.name, '(id:', layout.id, ')');
          layout.tabs.forEach((tab, ti) => {
            tab.sections.forEach((sec, si) => {
              const hasStatus = sec.fields.some(f => f.apiName === 'Lead__status');
              const statusInSection = sec.fields.find(f => f.apiName === 'Lead__status');
              console.log('  Tab', ti, 'Section', si, '"' + sec.label + '":', sec.fields.length, 'fields',
                hasStatus ? 'HAS STATUS col=' + statusInSection.column + ' order=' + statusInSection.order : '');
            });
          });
        });
      });
    });
    req2.end();
  });
});
req.write(loginData);
req.end();
