const https = require('https');

function httpsRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  const loginData = JSON.stringify({ email: 'customer@example.com', password: 'test123' });
  const loginRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(loginData) }
  }, loginData);
  
  console.log('Login status:', loginRes.status);
  if (loginRes.status !== 200) {
    console.log('Response:', loginRes.body);
    return;
  }
  
  const token = JSON.parse(loginRes.body).token;
  await testWithToken(token);
}

async function testWithToken(token) {
  console.log('Token obtained!\n');
  
  // Get permissions
  const permsRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/me/permissions',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  
  console.log('=== /me/permissions ===');
  const perms = JSON.parse(permsRes.body);
  console.log('Role:', perms.role);
  console.log('Department:', perms.departmentName);
  console.log('Profile:', perms.profileName);
  console.log('\nObject Permissions:');
  for (const [obj, p] of Object.entries(perms.objectPermissions)) {
    console.log(`  ${obj}: read=${p.read}, create=${p.create}, edit=${p.edit}, delete=${p.delete}`);
  }
  
  // Test reading Leads (should be denied - dept has read:false)
  const leadsRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/objects/Lead/records',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== GET /objects/Lead/records ===');
  console.log('Status:', leadsRes.status, '(expect 403)');
  
  // Test reading Properties (should be allowed)
  const propsRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/objects/Property/records',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== GET /objects/Property/records ===');
  console.log('Status:', propsRes.status, '(expect 200)');
  
  // Test reading Contacts (should be allowed - dept has read:true)
  const contactsRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/objects/Contact/records',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== GET /objects/Contact/records ===');
  console.log('Status:', contactsRes.status, '(expect 200)');
  
  // Test creating Contact (should be denied - dept has create:false)
  const createData = JSON.stringify({ data: { contactNumber: 'TEST-001' } });
  const createRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/objects/Contact/records',
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(createData) }
  }, createData);
  console.log('\n=== POST /objects/Contact/records (create) ===');
  console.log('Status:', createRes.status, '(expect 403 - dept denies create)');
  
  // Test reading Deals (should be denied)
  const dealsRes = await httpsRequest({
    hostname: 'api-production-e4e8.up.railway.app',
    path: '/objects/Deal/records',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('\n=== GET /objects/Deal/records ===');
  console.log('Status:', dealsRes.status, '(expect 403)');
}

main().catch(console.error);
