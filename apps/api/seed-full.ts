import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// Password hashing function matching auth.ts
function hashPassword(password: string): string {
  const ITERATIONS = 310_000;
  const KEYLEN = 32;
  const DIGEST = 'sha256';
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `pbkdf2$${ITERATIONS}$${DIGEST}$${salt}$${derived}`;
}

// Core object definitions
const CORE_OBJECTS = [
  {
    apiName: 'Property',
    label: 'Property',
    pluralLabel: 'Properties',
    description: 'Real estate properties',
    fields: [
      { apiName: 'propertyNumber', label: 'Property Number', type: 'Text', required: true, unique: true },
      { apiName: 'address', label: 'Address', type: 'Text', required: true },
      { apiName: 'city', label: 'City', type: 'Text', required: true },
      { apiName: 'state', label: 'State/Province', type: 'Text', required: true },
      { apiName: 'zipCode', label: 'Zip Code', type: 'Text' },
      { apiName: 'status', label: 'Status', type: 'Picklist', required: true, picklistValues: ['Active', 'Inactive', 'Pending'], defaultValue: 'Active' },
    ],
  },
  {
    apiName: 'Contact',
    label: 'Contact',
    pluralLabel: 'Contacts',
    description: 'People and contacts',
    fields: [
      { apiName: 'firstName', label: 'First Name', type: 'Text', required: true },
      { apiName: 'lastName', label: 'Last Name', type: 'Text', required: true },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'title', label: 'Title', type: 'Text' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Active', 'Inactive'], defaultValue: 'Active' },
    ],
  },
  {
    apiName: 'Account',
    label: 'Account',
    pluralLabel: 'Accounts',
    description: 'Business accounts and organizations',
    fields: [
      { apiName: 'accountNumber', label: 'Account Number', type: 'Text', required: true, unique: true },
      { apiName: 'name', label: 'Account Name', type: 'Text', required: true },
      { apiName: 'type', label: 'Type', type: 'Picklist', picklistValues: ['Customer', 'Prospect', 'Partner', 'Vendor'] },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'website', label: 'Website', type: 'URL' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Active', 'Inactive'], defaultValue: 'Active' },
    ],
  },
  {
    apiName: 'Product',
    label: 'Product',
    pluralLabel: 'Products',
    description: 'Products and services catalog',
    fields: [
      { apiName: 'productCode', label: 'Product Code', type: 'Text', required: true, unique: true },
      { apiName: 'productName', label: 'Product Name', type: 'Text', required: true },
      { apiName: 'description', label: 'Description', type: 'TextArea' },
      { apiName: 'unitPrice', label: 'Unit Price', type: 'Currency' },
      { apiName: 'productFamily', label: 'Product Family', type: 'Picklist', picklistValues: ['Hardware', 'Software', 'Service', 'Other'] },
      { apiName: 'isActive', label: 'Active', type: 'Checkbox', defaultValue: 'true' },
    ],
  },
  {
    apiName: 'Lead',
    label: 'Lead',
    pluralLabel: 'Leads',
    description: 'Sales leads',
    fields: [
      { apiName: 'leadNumber', label: 'Lead Number', type: 'Text', required: true, unique: true },
      { apiName: 'firstName', label: 'First Name', type: 'Text' },
      { apiName: 'lastName', label: 'Last Name', type: 'Text', required: true },
      { apiName: 'company', label: 'Company', type: 'Text' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'leadSource', label: 'Lead Source', type: 'Picklist', picklistValues: ['Web', 'Phone', 'Referral', 'Partner', 'Other'] },
      { apiName: 'stage', label: 'Stage', type: 'Picklist', picklistValues: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'], defaultValue: 'New' },
    ],
  },
  {
    apiName: 'Opportunity',
    label: 'Opportunity',
    pluralLabel: 'Opportunities',
    description: 'Sales opportunities',
    fields: [
      { apiName: 'opportunityNumber', label: 'Opportunity Number', type: 'Text', required: true, unique: true },
      { apiName: 'opportunityName', label: 'Opportunity Name', type: 'Text', required: true },
      { apiName: 'amount', label: 'Amount', type: 'Currency' },
      { apiName: 'closeDate', label: 'Close Date', type: 'Date' },
      { apiName: 'stage', label: 'Stage', type: 'Picklist', picklistValues: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'], defaultValue: 'Prospecting' },
      { apiName: 'probability', label: 'Probability (%)', type: 'Percent' },
    ],
  },
  {
    apiName: 'Project',
    label: 'Project',
    pluralLabel: 'Projects',
    description: 'Project management',
    fields: [
      { apiName: 'projectNumber', label: 'Project Number', type: 'Text', required: true, unique: true },
      { apiName: 'projectName', label: 'Project Name', type: 'Text', required: true },
      { apiName: 'description', label: 'Description', type: 'TextArea' },
      { apiName: 'startDate', label: 'Start Date', type: 'Date' },
      { apiName: 'endDate', label: 'End Date', type: 'Date' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], defaultValue: 'Planning' },
      // ── Project List report fields (Tischler master project-tracking sheet) ──
      { apiName: 'tusOrderNumber', label: 'TUS Order #', type: 'Text' },
      { apiName: 'factory', label: 'Factory', type: 'Text' },
      { apiName: 'standardProductType', label: 'ST (Standard)', type: 'Text' },
      { apiName: 'dadeCountyProductType', label: 'DC (Dade County)', type: 'Text' },
      { apiName: 'doubleHungProductType', label: 'DH (Double Hung)', type: 'Text' },
      { apiName: 'screenFlag', label: 'Screen', type: 'Checkbox' },
      { apiName: 'lutronFlag', label: 'Lutron', type: 'Checkbox' },
      { apiName: 'checkFlag', label: 'Check', type: 'Checkbox' },
      { apiName: 'tischlerPM', label: 'Tischler PM', type: 'Text' },
      { apiName: 'factoryPM', label: 'Factory PM', type: 'Text' },
      { apiName: 'projectSalesman', label: 'Salesman', type: 'Text' },
      { apiName: 'projectLocation', label: 'Location', type: 'Text' },
      { apiName: 'woodSpecies', label: 'Wood Species', type: 'Text' },
      { apiName: 'dcSilicone', label: 'DC Silicone', type: 'Checkbox' },
      { apiName: 'solarControl', label: 'Solar Ctrl', type: 'Checkbox' },
      { apiName: 'finishColor', label: 'Finish Color', type: 'Text' },
      { apiName: 'changeOrderRow1', label: 'Change Order in Estim / To Client — Row 1', type: 'Text' },
      { apiName: 'changeOrderRow2', label: 'Change Order in Estim / To Client — Row 2', type: 'Text' },
      { apiName: 'changeOrderRow3', label: 'Change Order in Estim / To Client — Row 3', type: 'Text' },
      { apiName: 'changeOrderRow4', label: 'Change Order in Estim / To Client — Row 4', type: 'Text' },
      { apiName: 'set1Row1', label: 'Set 1 — Row 1', type: 'Text' },
      { apiName: 'set1Row2', label: 'Set 1 — Row 2', type: 'Text' },
      { apiName: 'set1Row3', label: 'Set 1 — Row 3', type: 'Text' },
      { apiName: 'set1Row4', label: 'Set 1 — Row 4', type: 'Text' },
      { apiName: 'set1Row5', label: 'Set 1 — Row 5', type: 'Text' },
      { apiName: 'set2Row1', label: 'Set 2 — Row 1', type: 'Text' },
      { apiName: 'set2Row2', label: 'Set 2 — Row 2', type: 'Text' },
      { apiName: 'set2Row3', label: 'Set 2 — Row 3', type: 'Text' },
      { apiName: 'set2Row4', label: 'Set 2 — Row 4', type: 'Text' },
      { apiName: 'set2Row5', label: 'Set 2 — Row 5', type: 'Text' },
      { apiName: 'set3Row1', label: 'Set 3 — Row 1', type: 'Text' },
      { apiName: 'set3Row2', label: 'Set 3 — Row 2', type: 'Text' },
      { apiName: 'set3Row3', label: 'Set 3 — Row 3', type: 'Text' },
      { apiName: 'set3Row4', label: 'Set 3 — Row 4', type: 'Text' },
      { apiName: 'set3Row5', label: 'Set 3 — Row 5', type: 'Text' },
      { apiName: 'set4Row1', label: 'Set 4 — Row 1', type: 'Text' },
      { apiName: 'set4Row2', label: 'Set 4 — Row 2', type: 'Text' },
      { apiName: 'set4Row3', label: 'Set 4 — Row 3', type: 'Text' },
      { apiName: 'set4Row4', label: 'Set 4 — Row 4', type: 'Text' },
      { apiName: 'set4Row5', label: 'Set 4 — Row 5', type: 'Text' },
      { apiName: 'finalSetRow1', label: 'Final — Row 1', type: 'Text' },
      { apiName: 'finalSetRow2', label: 'Final — Row 2', type: 'Text' },
      { apiName: 'finalSetRow3', label: 'Final — Row 3', type: 'Text' },
      { apiName: 'finalSetRow4', label: 'Final — Row 4', type: 'Text' },
      { apiName: 'finalSetRow5', label: 'Final — Row 5', type: 'Text' },
      { apiName: 'installSetRow1', label: 'Install Set — Row 1', type: 'Text' },
      { apiName: 'installSetRow2', label: 'Install Set — Row 2', type: 'Text' },
      { apiName: 'installSetRow3', label: 'Install Set — Row 3', type: 'Text' },
      { apiName: 'installSetRow4', label: 'Install Set — Row 4', type: 'Text' },
      { apiName: 'installSetRow5', label: 'Install Set — Row 5', type: 'Text' },
      { apiName: 'jobStatusOrderDateRow1', label: 'Job Status / Order Date — Row 1', type: 'Text' },
      { apiName: 'jobStatusOrderDateRow2', label: 'Job Status / Order Date — Row 2', type: 'Text' },
      { apiName: 'jobStatusOrderDateRow3', label: 'Job Status / Order Date — Row 3', type: 'Text' },
      { apiName: 'onHoldUnits', label: 'On-Hold Units', type: 'Number' },
      { apiName: 'customHardware', label: 'Custom Hardware', type: 'Text' },
      { apiName: 'factoryOCRow1', label: 'Factory O.C. — Row 1', type: 'Text' },
      { apiName: 'factoryOCRow2', label: 'Factory O.C. — Row 2', type: 'Text' },
      { apiName: 'installationMaterialRow1', label: 'Installation Material — Row 1', type: 'Text' },
      { apiName: 'installationMaterialRow2', label: 'Installation Material — Row 2', type: 'Text' },
      { apiName: 'installationInstructionRow1', label: 'Installation Instruction — Row 1', type: 'Text' },
      { apiName: 'installationInstructionRow2', label: 'Installation Instruction — Row 2', type: 'Text' },
      { apiName: 'installationInstructionRow3', label: 'Installation Instruction — Row 3', type: 'Text' },
      { apiName: 'shippingWeekRow1', label: 'Shipping Week — Row 1', type: 'Text' },
      { apiName: 'shippingWeekRow2', label: 'Shipping Week — Row 2', type: 'Text' },
      { apiName: 'shippingWeekRow3', label: 'Shipping Week — Row 3', type: 'Text' },
      { apiName: 'shippingWeekRow4', label: 'Shipping Week — Row 4', type: 'Text' },
      { apiName: 'shippingWeekRow5', label: 'Shipping Week — Row 5', type: 'Text' },
      { apiName: 'estimatedDeliveryWeekRow1', label: 'Estimated Delivery Wk — Row 1', type: 'Text' },
      { apiName: 'estimatedDeliveryWeekRow2', label: 'Estimated Delivery Wk — Row 2', type: 'Text' },
      { apiName: 'estimatedDeliveryWeekRow3', label: 'Estimated Delivery Wk — Row 3', type: 'Text' },
      { apiName: 'estimatedDeliveryWeekRow4', label: 'Estimated Delivery Wk — Row 4', type: 'Text' },
      { apiName: 'estimatedDeliveryWeekRow5', label: 'Estimated Delivery Wk — Row 5', type: 'Text' },
      { apiName: 'loadingListRFRow1', label: 'RF — Row 1', type: 'Text' },
      { apiName: 'loadingListRFRow2', label: 'RF — Row 2', type: 'Text' },
      { apiName: 'loadingListRFRow3', label: 'RF — Row 3', type: 'Text' },
      { apiName: 'loadingListRFRow4', label: 'RF — Row 4', type: 'Text' },
      { apiName: 'loadingListRFRow5', label: 'RF — Row 5', type: 'Text' },
      { apiName: 'loadingListRSRow1', label: 'RS — Row 1', type: 'Text' },
      { apiName: 'loadingListRSRow2', label: 'RS — Row 2', type: 'Text' },
      { apiName: 'loadingListRSRow3', label: 'RS — Row 3', type: 'Text' },
      { apiName: 'loadingListRSRow4', label: 'RS — Row 4', type: 'Text' },
      { apiName: 'loadingListRSRow5', label: 'RS — Row 5', type: 'Text' },
      { apiName: 'loadingListOFRow1', label: 'OF — Row 1', type: 'Text' },
      { apiName: 'loadingListOFRow2', label: 'OF — Row 2', type: 'Text' },
      { apiName: 'loadingListOFRow3', label: 'OF — Row 3', type: 'Text' },
      { apiName: 'loadingListOFRow4', label: 'OF — Row 4', type: 'Text' },
      { apiName: 'loadingListOFRow5', label: 'OF — Row 5', type: 'Text' },
      { apiName: 'completionSignOff', label: 'Completion Sign-off', type: 'TextArea' },
    ],
  },
  {
    apiName: 'Service',
    label: 'Service',
    pluralLabel: 'Services',
    description: 'Service tickets and requests',
    fields: [
      { apiName: 'serviceNumber', label: 'Service Number', type: 'Text', required: true, unique: true },
      { apiName: 'serviceName', label: 'Service Name', type: 'Text', required: true },
      { apiName: 'description', label: 'Description', type: 'TextArea' },
      { apiName: 'priority', label: 'Priority', type: 'Picklist', picklistValues: ['Low', 'Medium', 'High', 'Critical'], defaultValue: 'Medium' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['New', 'In Progress', 'Pending', 'Completed', 'Cancelled'], defaultValue: 'New' },
    ],
  },
  {
    apiName: 'Quote',
    label: 'Quote',
    pluralLabel: 'Quotes',
    description: 'Sales quotes and proposals',
    fields: [
      { apiName: 'quoteNumber', label: 'Quote Number', type: 'Text', required: true, unique: true },
      { apiName: 'quoteName', label: 'Quote Name', type: 'Text', required: true },
      { apiName: 'totalAmount', label: 'Total Amount', type: 'Currency' },
      { apiName: 'validUntil', label: 'Valid Until', type: 'Date' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'], defaultValue: 'Draft' },
    ],
  },
  {
    apiName: 'Installation',
    label: 'Installation',
    pluralLabel: 'Installations',
    description: 'Installation tracking',
    fields: [
      { apiName: 'installationNumber', label: 'Installation Number', type: 'Text', required: true, unique: true },
      { apiName: 'installationName', label: 'Installation Name', type: 'Text', required: true },
      { apiName: 'scheduledDate', label: 'Scheduled Date', type: 'Date' },
      { apiName: 'completedDate', label: 'Completed Date', type: 'Date' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], defaultValue: 'Scheduled' },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding database with all core objects...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@crm.local' },
    update: {},
    create: {
      email: 'admin@crm.local',
      passwordHash: hashPassword('admin123'),
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create demo user for testing
  const demoUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      passwordHash: hashPassword('password123'),
      name: 'Test User',
      role: 'USER',
    },
  });

  console.log('✅ Created demo user:', demoUser.email);

  // Create all core objects with their fields
  for (const objDef of CORE_OBJECTS) {
    console.log(`Creating ${objDef.apiName} object...`);
    
    const obj = await prisma.customObject.upsert({
      where: { apiName: objDef.apiName },
      update: {
        label: objDef.label,
        pluralLabel: objDef.pluralLabel,
        description: objDef.description,
      },
      create: {
        apiName: objDef.apiName,
        label: objDef.label,
        pluralLabel: objDef.pluralLabel,
        description: objDef.description,
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });

    // Create fields for this object
    for (const fieldDef of objDef.fields) {
      await prisma.customField.upsert({
        where: {
          objectId_apiName: {
            objectId: obj.id,
            apiName: fieldDef.apiName,
          },
        },
        update: {
          label: fieldDef.label,
          type: fieldDef.type,
          required: fieldDef.required || false,
          unique: fieldDef.unique || false,
          picklistValues: fieldDef.picklistValues ? JSON.stringify(fieldDef.picklistValues) : null,
          defaultValue: fieldDef.defaultValue || null,
        },
        create: {
          objectId: obj.id,
          apiName: fieldDef.apiName,
          label: fieldDef.label,
          type: fieldDef.type,
          required: fieldDef.required || false,
          unique: fieldDef.unique || false,
          picklistValues: fieldDef.picklistValues ? JSON.stringify(fieldDef.picklistValues) : null,
          defaultValue: fieldDef.defaultValue || null,
          createdById: adminUser.id,
          modifiedById: adminUser.id,
        },
      });
    }

    // Create a default page layout for the object
    const layoutExists = await prisma.pageLayout.findFirst({
      where: {
        objectId: obj.id,
        name: 'Default Layout',
      },
    });

    if (!layoutExists) {
      const layout = await prisma.pageLayout.create({
        data: {
          objectId: obj.id,
          name: 'Default Layout',
          layoutType: 'edit',
          isDefault: true,
          createdById: adminUser.id,
          modifiedById: adminUser.id,
        },
      });

      // Create a default tab
      const tab = await prisma.layoutTab.create({
        data: {
          layoutId: layout.id,
          label: 'Details',
          order: 0,
        },
      });

      // Create a default section
      const section = await prisma.layoutSection.create({
        data: {
          tabId: tab.id,
          label: 'Information',
          columns: 2,
          order: 0,
        },
      });

      // Add all fields to the section
      const objFields = await prisma.customField.findMany({
        where: { objectId: obj.id },
      });

      for (let i = 0; i < objFields.length; i++) {
        const field = objFields[i];
        if (field) {
          await prisma.layoutField.create({
            data: {
              sectionId: section.id,
              fieldId: field.id,
              column: i % 2,
              order: Math.floor(i / 2),
            },
          });
        }
      }
    }

    console.log(`  ✅ ${objDef.apiName} created with ${objDef.fields.length} fields`);
  }

  console.log('\n🎉 Database seeding completed!');
  console.log(`\n📊 Created ${CORE_OBJECTS.length} core objects`);
  console.log('\n📧 Admin credentials:');
  console.log('   Email: admin@crm.local');
  console.log('   Password: admin123');
  console.log('\n📧 Demo user credentials:');
  console.log('   Email: test@example.com');
  console.log('   Password: password123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
