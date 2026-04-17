/**
 * End-to-end test: Create a lead via production API and check if Dropbox folder is created.
 * Also tests the Dropbox API by listing the expected Property folder.
 */

const API = 'https://api-production-e4e8.up.railway.app';
const ADMIN_EMAIL = 'sysadmin@tischler.com';
const ADMIN_PASS = 'Tischler$Admin2026!';

async function main() {
  // 1. Login
  console.log('1. Logging in...');
  const loginResp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASS }),
  });
  if (!loginResp.ok) {
    console.error('Login failed:', loginResp.status, await loginResp.text());
    return;
  }
  const { token } = await loginResp.json();
  console.log('   Logged in, token received');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Find a property that has a Dropbox folder
  console.log('\n2. Finding a Property with Dropbox folder...');
  const propsResp = await fetch(`${API}/objects/Property/records?limit=5`, { headers });
  const propsBody = await propsResp.json();
  console.log('   Raw response keys:', Object.keys(propsBody));
  const properties = propsBody.records || propsBody.data || (Array.isArray(propsBody) ? propsBody : []);
  console.log(`   Found ${properties.length} properties`);
  
  let targetProperty = null;
  for (const prop of properties) {
    const data = prop.data || prop;
    const num = data.propertyNumber || data.Property__propertyNumber;
    const addr = data.address || data.Property__address;
    console.log(`   Property ${prop.id}: ${num} - ${typeof addr === 'object' ? addr?.street : addr}`);
    if (!targetProperty) targetProperty = prop;
  }

  if (!targetProperty) {
    console.error('No properties found');
    return;
  }
  console.log(`   Using property: ${targetProperty.id}`);

  // 3. Check Dropbox folder structure for this property
  console.log('\n3. Checking Dropbox folders for this property...');
  try {
    const dbxResp = await fetch(`${API}/dropbox/files/Property/${targetProperty.id}`, { headers });
    const dbxData = await dbxResp.json();
    console.log('   Dropbox files response:', JSON.stringify(dbxData, null, 2).substring(0, 1000));
  } catch (err) {
    console.log('   Dropbox list error:', err.message);
  }

  // 4. Create a test lead linked to this property
  console.log('\n4. Creating a test Lead linked to this property...');
  const leadData = {
    Lead__lastName: 'TestDropbox',
    Lead__firstName: 'FolderTest',
    Lead__property: targetProperty.id,
    Lead__status: 'Not Contacted',
  };
  console.log('   Sending data:', JSON.stringify(leadData));

  const createResp = await fetch(`${API}/objects/Lead/records`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: leadData }),
  });
  const createText = await createResp.text();
  console.log(`   Create response (${createResp.status}):`, createText.substring(0, 500));

  if (createResp.ok) {
    const created = JSON.parse(createText);
    console.log(`   Created lead: ${created.id}`);
    console.log('   Lead data:', JSON.stringify(created.data, null, 2));

    // 5. Wait a moment then check if Dropbox folder was created
    console.log('\n5. Waiting 3 seconds then checking Dropbox...');
    await new Promise(r => setTimeout(r, 3000));

    // Try manually calling the ensure-linked-folder endpoint
    console.log('   Calling ensure-linked-folder endpoint manually...');
    try {
      const ensureResp = await fetch(`${API}/dropbox/ensure-linked-folder`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          childObjectApiName: 'Lead',
          childRecordId: created.id,
          childData: created.data,
        }),
      });
      const ensureData = await ensureResp.text();
      console.log(`   ensure-linked-folder (${ensureResp.status}):`, ensureData.substring(0, 500));
    } catch (err) {
      console.log('   ensure-linked-folder error:', err.message);
    }

    // Check the property's folder in Dropbox
    try {
      const dbxResp = await fetch(`${API}/dropbox/files/Property/${targetProperty.id}`, { headers });
      const dbxData = await dbxResp.json();
      console.log('   Property Dropbox files after:', JSON.stringify(dbxData, null, 2).substring(0, 1000));
    } catch (err) {
      console.log('   Dropbox check error:', err.message);
    }

    // 6. Clean up - delete the test lead
    console.log('\n6. Cleaning up test lead...');
    const delResp = await fetch(`${API}/objects/Lead/records/${created.id}`, {
      method: 'DELETE',
      headers,
    });
    console.log(`   Delete response: ${delResp.status}`);
  }
}

main().catch(console.error);
