// Fix Lead records with status='N/A' via the production API
const https = require('https');

function apiRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined;
    const opts = {
      hostname: 'api-production-e4e8.up.railway.app',
      path, method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    const req = https.request(opts, res => {
      let b = ''; res.on('data', d => b += d);
      res.on('end', () => {
        try { resolve(JSON.parse(b)); } catch { resolve(b); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login
  const login = await apiRequest('POST', '/auth/login', '', { email: 'admin@crm.local', password: 'admin123' });
  if (!login.token) { console.log('Login failed:', login); return; }
  const token = login.token;

  // Get Lead records
  const records = await apiRequest('GET', '/objects/Lead/records?limit=100', token);
  if (!Array.isArray(records)) { console.log('No records array:', records); return; }
  
  console.log(`Found ${records.length} Lead records`);
  let fixed = 0;
  
  for (const rec of records) {
    const data = rec.data || {};
    const status = data.status || data.Lead__status;
    if (status === 'N/A') {
      const newData = { ...data, status: 'Not Contacted' };
      if (data.Lead__status === 'N/A') newData.Lead__status = 'Not Contacted';
      // Remove the old 'N/A' values
      try {
        await apiRequest('PUT', `/objects/Lead/records/${rec.id}`, token, { data: newData });
        fixed++;
        console.log(`  Fixed record ${rec.id}: status N/A → Not Contacted`);
      } catch (e) {
        console.log(`  Failed to fix ${rec.id}:`, e.message);
      }
    } else {
      console.log(`  Record ${rec.id}: status="${status || '(none)'}" - OK`);
    }
  }
  console.log(`\nFixed ${fixed} records`);
}

main().catch(console.error);
