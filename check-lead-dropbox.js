const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:UOtWljcpPQwavRxfSqMKbGhteQGruYMG@ballast.proxy.rlwy.net:26372/railway' } }
});

(async () => {
  // 1. Get the most recent lead with valid property
  const leadObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Lead', mode: 'insensitive' } }
  });
  const propObj = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Property', mode: 'insensitive' } }
  });

  const lead = await prisma.record.findFirst({
    where: { objectId: leadObj.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!lead) { console.log('No leads found'); return; }

  console.log('=== LEAD RECORD ===');
  console.log('Full data:', JSON.stringify(lead.data, null, 2));
  
  const data = lead.data;
  const propId = data.property || data.Lead__property;
  console.log('\nProperty ID from lead:', propId);
  console.log('Type:', typeof propId);

  // 2. Get the property record and trace folder name
  if (propId) {
    const propRec = await prisma.record.findFirst({
      where: { id: propId, objectId: propObj.id }
    });
    if (propRec) {
      console.log('\n=== PROPERTY RECORD ===');
      console.log('Full data:', JSON.stringify(propRec.data, null, 2));
      
      // Simulate deriveDropboxFolderName for property
      const pData = propRec.data;
      const numberKey = Object.keys(pData).find(
        k => k.toLowerCase().includes('number') && typeof pData[k] === 'string' && pData[k]
      );
      const autoNumber = numberKey ? pData[numberKey] : '';
      const addrKey = Object.keys(pData).find(
        k => k.toLowerCase() === 'address' || k.toLowerCase().endsWith('__address')
      );
      let addrStr = '';
      if (addrKey) {
        const raw = pData[addrKey];
        if (typeof raw === 'string') addrStr = raw;
        else if (raw && typeof raw === 'object') addrStr = [raw.street, raw.city, raw.state].filter(Boolean).join(', ');
      }
      const parentFolderName = (addrStr && autoNumber) ? `${addrStr} (${autoNumber})` :
                               addrStr ? addrStr : autoNumber ? autoNumber : propId;
      console.log('\nnumberKey:', numberKey, '=', autoNumber);
      console.log('addrKey:', addrKey, '=', addrStr || JSON.stringify(pData[addrKey]));
      console.log('Derived property folder name:', parentFolderName);
      
      // Simulate deriveDropboxFolderName for lead
      const lData = lead.data;
      const lNumberKey = Object.keys(lData).find(
        k => k.toLowerCase().includes('number') && typeof lData[k] === 'string' && lData[k]
      );
      const lAutoNumber = lNumberKey ? lData[lNumberKey] : '';
      const lAddrKey = Object.keys(lData).find(
        k => k.toLowerCase() === 'address' || k.toLowerCase().endsWith('__address')
      );
      let lAddrStr = '';
      if (lAddrKey) {
        const raw = lData[lAddrKey];
        if (typeof raw === 'string') lAddrStr = raw;
        else if (raw && typeof raw === 'object') lAddrStr = [raw.street, raw.city, raw.state].filter(Boolean).join(', ');
      }
      const childFolderName = (lAddrStr && lAutoNumber) ? `${lAddrStr} (${lAutoNumber})` :
                              lAddrStr ? lAddrStr : lAutoNumber ? lAutoNumber : lead.id;
      console.log('\nLead numberKey:', lNumberKey, '=', lAutoNumber);
      console.log('Lead addrKey:', lAddrKey);
      console.log('Derived lead folder name:', childFolderName);
      
      // Expected full path
      const safeProp = parentFolderName.replace(/[\\\/:*?"<>|]/g, '_').trim();
      const safeLead = childFolderName.replace(/[\\\/:*?"<>|]/g, '_').trim();
      console.log('\n=== EXPECTED DROPBOX PATH ===');
      console.log(`/TischlerCRM/Property/${safeProp}/Leads/${safeLead}`);
    } else {
      console.log('\nProperty NOT FOUND with objectId:', propObj.id);
      const anyRec = await prisma.record.findFirst({ where: { id: propId } });
      if (anyRec) console.log('Found as record in objectId:', anyRec.objectId);
      else console.log('No record with this ID at all');
    }
  }

  // 3. Check Dropbox integration
  console.log('\n=== DROPBOX STATUS ===');
  const ic = await prisma.integrationConnection.findMany({
    where: { provider: 'dropbox', accessToken: { not: null } },
    select: { userId: true }
  });
  console.log('Connected users:', ic.map(c => c.userId));
  console.log('Lead created by:', lead.createdById);
  console.log('Creator has Dropbox:', ic.some(c => c.userId === lead.createdById));

  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
