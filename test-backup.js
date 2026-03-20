const https = require('https');

function doReq(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const loginData = JSON.stringify({ email: 'sysadmin@tischler.com', password: 'Tischler$Admin2026!' });
  const login = await doReq({
    hostname: 'api-production-e4e8.up.railway.app', path: '/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
  }, loginData);
  console.log('Login status:', login.status);
  const parsed = JSON.parse(login.body);
  if (!parsed.token) { console.log('Login failed:', login.body); return; }
  
  console.log('\n=== Triggering scheduled backup with admin auth ===');
  const res = await doReq({
    hostname: 'api-production-e4e8.up.railway.app', path: '/admin/backup/scheduled', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + parsed.token, 'Content-Length': 2 }
  }, '{}');
  console.log('Status:', res.status);
  console.log('Response:', res.body.substring(0, 500));

  console.log('\n=== Checking backup status ===');
  const status = await doReq({
    hostname: 'api-production-e4e8.up.railway.app', path: '/admin/backup/status', method: 'GET',
    headers: { 'Authorization': 'Bearer ' + parsed.token }
  });
  console.log('Status check:', JSON.stringify(JSON.parse(status.body), null, 2));
}

main().catch(console.error);
