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
      { apiName: 'standardProductType', label: 'ST (Standard)', type: 'Checkbox' },
      { apiName: 'dadeCountyProductType', label: 'DC (Dade County)', type: 'Checkbox' },
      { apiName: 'doubleHungProductType', label: 'DH (Double Hung)', type: 'Checkbox' },
      { apiName: 'rollSystem', label: 'Roll System', type: 'Text' },
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
      { apiName: 'changeOrderEstimToClient', label: 'Change Order in Estim / To Client', type: 'TextArea' },
      { apiName: 'shopDrawingsStatus', label: 'Shop Drawings Status', type: 'Picklist', picklistValues: ['Not Started', 'In Progress', 'Done'], defaultValue: 'Not Started' },
      { apiName: 'percentComplete', label: '% Complete', type: 'Percent', min: 0, max: 100 },
      { apiName: 'set1OrderDate', label: 'Set 1 - Order Date', type: 'Date' },
      { apiName: 'set1BackDate', label: 'Set 1 - Back Date', type: 'Date' },
      { apiName: 'set1DueDate', label: 'Set 1 - Due Date', type: 'Date' },
      { apiName: 'set2OrderDate', label: 'Set 2 - Order Date', type: 'Date' },
      { apiName: 'set2BackDate', label: 'Set 2 - Back Date', type: 'Date' },
      { apiName: 'set2DueDate', label: 'Set 2 - Due Date', type: 'Date' },
      { apiName: 'set3OrderDate', label: 'Set 3 - Order Date', type: 'Date' },
      { apiName: 'set3BackDate', label: 'Set 3 - Back Date', type: 'Date' },
      { apiName: 'set3DueDate', label: 'Set 3 - Due Date', type: 'Date' },
      { apiName: 'set4OrderDate', label: 'Set 4 - Order Date', type: 'Date' },
      { apiName: 'set4BackDate', label: 'Set 4 - Back Date', type: 'Date' },
      { apiName: 'set4DueDate', label: 'Set 4 - Due Date', type: 'Date' },
      { apiName: 'finalSetOrderDate', label: 'Final Set - Order Date', type: 'Date' },
      { apiName: 'finalSetBackDate', label: 'Final Set - Back Date', type: 'Date' },
      { apiName: 'finalSetDueDate', label: 'Final Set - Due Date', type: 'Date' },
      { apiName: 'coDownDate', label: 'Change Order Down Date', type: 'Date' },
      { apiName: 'coOutDate', label: 'Change Order Out Date', type: 'Date' },
      { apiName: 'coBackDate', label: 'Change Order Back Date', type: 'Date' },
      { apiName: 'installSetDate', label: 'Install Set Date', type: 'Date' },
      { apiName: 'jobStatusDetail', label: 'Job Status', type: 'Picklist', picklistValues: ['To be scheduled', 'Ordered', 'Shipped', 'Delivered'], defaultValue: 'To be scheduled' },
      { apiName: 'jobOrderDate', label: 'Job Order Date', type: 'Date' },
      { apiName: 'onHoldUnits', label: 'On-Hold Units', type: 'Number' },
      { apiName: 'customHardware', label: 'Custom Hardware', type: 'Text' },
      { apiName: 'factoryOC', label: 'Factory O.C.', type: 'Text' },
      { apiName: 'installationMaterialNotes', label: 'Installation Material', type: 'TextArea' },
      { apiName: 'installationInstructionNotes', label: 'Installation Instruction', type: 'TextArea' },
      { apiName: 'shippingWeek', label: 'Shipping Week', type: 'Number' },
      { apiName: 'estimatedDeliveryWeek', label: 'Estimated Delivery Wk', type: 'Number' },
      { apiName: 'loadingListRF', label: 'Loading List - RF', type: 'Date' },
      { apiName: 'loadingListRS', label: 'Loading List - RS', type: 'Date' },
      { apiName: 'loadingListOF', label: 'Loading List - OF', type: 'Date' },
      { apiName: 'completionSignOffOrdered', label: 'Completion Sign-off - Ordered', type: 'Date' },
      { apiName: 'completionSignOffComplete', label: 'Completion Sign-off - Complete', type: 'Date' },
      { apiName: 'completionSignOffBilled', label: 'Completion Sign-off - Billed', type: 'Date' },
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
