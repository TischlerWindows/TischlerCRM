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
    apiName: 'Deal',
    label: 'Deal',
    pluralLabel: 'Deals',
    description: 'Sales opportunities and deals',
    fields: [
      { apiName: 'dealNumber', label: 'Deal Number', type: 'Text', required: true, unique: true },
      { apiName: 'dealName', label: 'Deal Name', type: 'Text', required: true },
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
