const API = 'https://api-production-e4e8.up.railway.app';

async function main() {
  // 1. Login
  console.log('1. Logging in...');
  const loginResp = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'sysadmin@tischler.com', password: 'Tischler$Admin2026!' }),
  });
  const { token } = await loginResp.json();
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  console.log('   OK');

  const deriveFolder = (data, id) => {
    const nk = Object.keys(data).find(k => k.toLowerCase().includes('number') && typeof data[k] === 'string' && data[k]);
    const autoNum = nk ? data[nk] : '';
    const ak = Object.keys(data).find(k => k.toLowerCase() === 'address' || k.toLowerCase().endsWith('__address'));
    let addrStr = '';
    if (ak) {
      const raw = data[ak];
      if (typeof raw === 'string') addrStr = raw;
      else if (raw && typeof raw === 'object') addrStr = [raw.street, raw.city, raw.state].filter(Boolean).join(', ');
    }
    if (addrStr && autoNum) return `${addrStr} (${autoNum})`;
    if (addrStr) return addrStr;
    if (autoNum) return autoNum;
    return id;
  };

  // 2. Find property DC0011
  console.log('\n2. Finding Property DC0011...');
  const props = await (await fetch(`${API}/objects/Property/records?limit=5`, { headers })).json();
  const prop = props.find(p => p.data?.propertyNumber === 'DC0011');
  if (!prop) { console.error('DC0011 not found'); return; }
  const propFolder = deriveFolder(prop.data, prop.id);
  console.log(`   Found: ${prop.id}, folder: "${propFolder}"`);

  // 3. Ensure Property folder exists
  console.log('\n3. Ensuring Property folder exists in Dropbox...');
  const er = await fetch(`${API}/dropbox/ensure-folder/Property/${prop.id}`, {
    method: 'POST', headers,
    body: JSON.stringify({ folderName: propFolder }),
  });
  console.log(`   ensure-folder: ${er.status}`, await er.json());

  // 4. List property folder
  console.log('\n4. Listing Property folder...');
  const lr = await fetch(`${API}/dropbox/files/Property/${prop.id}?folderName=${encodeURIComponent(propFolder)}`, { headers });
  console.log('   Contents:', JSON.stringify(await lr.json(), null, 2));

  // 5. Create a Lead
  console.log('\n5. Creating test Lead...');
  const cr = await fetch(`${API}/objects/Lead/records`, {
    method: 'POST', headers,
    body: JSON.stringify({ data: {
      Lead__lastName: 'DropboxTest',
      Lead__firstName: 'E2E',
      Lead__property: prop.id,
      Lead__status: 'Not Contacted',
    }}),
  });
  const lead = await cr.json();
  console.log(`   Created: ${lead.id} (${cr.status})`);
  console.log('   Data:', JSON.stringify(lead.data));

  // 6. Wait and check
  console.log('\n6. Waiting 5s for tryEnsureLinkedFolder...');
  await new Promise(r => setTimeout(r, 5000));

  const lr2 = await fetch(`${API}/dropbox/files/Property/${prop.id}?folderName=${encodeURIComponent(propFolder)}&subPath=Leads`, { headers });
  const leads = await lr2.json();
  console.log('   Leads subfolder:', JSON.stringify(leads, null, 2));

  if (!leads.files?.length) {
    console.log('\n7. tryEnsureLinkedFolder FAILED — calling ensure-linked-folder manually...');
    const leadFolder = deriveFolder(lead.data, lead.id);
    console.log(`   Lead folder name: "${leadFolder}"`);
    const elr = await fetch(`${API}/dropbox/ensure-linked-folder`, {
      method: 'POST', headers,
      body: JSON.stringify({
        parentObjectApiName: 'Property',
        parentRecordId: prop.id,
        parentFolderName: propFolder,
        childObjectApiName: 'Lead',
        childFolderName: leadFolder,
      }),
    });
    console.log(`   Result (${elr.status}):`, await elr.json());

    // Check again
    const lr3 = await fetch(`${API}/dropbox/files/Property/${prop.id}?folderName=${encodeURIComponent(propFolder)}&subPath=Leads`, { headers });
    console.log('   After manual:', JSON.stringify(await lr3.json(), null, 2));
  } else {
    console.log('\n7. SUCCESS — Lead folder was auto-created!');
  }
}

main().catch(console.error);
