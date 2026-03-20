const https = require('https');

const loginData = JSON.stringify({ email: 'sysadmin@tischler.com', password: 'Tischler$Admin2026!' });
const loginOpts = {
  hostname: 'api-production-e4e8.up.railway.app',
  path: '/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
};

function doRequest(opts, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  // 1. Login
  const login = await doRequest(loginOpts, loginData);
  console.log('Login status:', login.status);
  if (!login.data.token) { console.log('Login failed:', login.data); return; }
  const token = login.data.token;

  // 2. Check schema for searchConfig
  const schema = await doRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/settings/tces-object-manager-schema',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  const orgSchema = typeof schema.data.value === 'string' ? JSON.parse(schema.data.value) : schema.data.value;
  console.log('\n=== Objects with searchConfig ===');
  for (const obj of orgSchema.objects || []) {
    if (obj.searchConfig) {
      console.log(`${obj.apiName}:`, JSON.stringify(obj.searchConfig));
    }
  }

  // 3. Check Property object specifically
  const propObj = (orgSchema.objects || []).find(o => o.apiName === 'Property');
  if (propObj) {
    console.log('\n=== Property object ===');
    console.log('searchConfig:', JSON.stringify(propObj.searchConfig, null, 2));
    console.log('fields:', propObj.fields.map(f => `${f.apiName} (${f.type})`).join(', '));
  } else {
    console.log('\nNo Property object found in schema');
  }

  // 4. Test /search endpoint
  console.log('\n=== Testing /search endpoint ===');
  const searchResult = await doRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/search?q=test',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Search status:', searchResult.status);
  console.log('Search result:', JSON.stringify(searchResult.data, null, 2));

  // 5. Check if Property records exist
  const propRecords = await doRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/objects/Property/records?limit=3',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== Property records (first 3) ===');
  console.log('Status:', propRecords.status);
  if (Array.isArray(propRecords.data)) {
    for (const r of propRecords.data.slice(0, 3)) {
      console.log(`Record ${r.id}:`, JSON.stringify(r.data).substring(0, 200));
    }
  } else {
    console.log('Response:', JSON.stringify(propRecords.data).substring(0, 500));
  }
}

main().catch(console.error);
