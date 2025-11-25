import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@crm.local' },
    update: {},
    create: {
      email: 'admin@crm.local',
      passwordHash: hashedPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create Property object
  const propertyObject = await prisma.customObject.upsert({
    where: { apiName: 'Property' },
    update: {},
    create: {
      apiName: 'Property',
      label: 'Property',
      pluralLabel: 'Properties',
      description: 'Real estate properties',
      createdById: adminUser.id,
      modifiedById: adminUser.id,
    },
  });

  console.log('✅ Created Property object');

  // Create fields for Property
  const propertyFields = [
    {
      apiName: 'propertyNumber',
      label: 'Property Number',
      type: 'Text',
      required: true,
      unique: true,
    },
    {
      apiName: 'address',
      label: 'Address',
      type: 'Text',
      required: true,
    },
    {
      apiName: 'city',
      label: 'City',
      type: 'Text',
      required: true,
    },
    {
      apiName: 'state',
      label: 'State/Province',
      type: 'Text',
      required: true,
    },
    {
      apiName: 'zipCode',
      label: 'Zip Code',
      type: 'Text',
    },
    {
      apiName: 'status',
      label: 'Status',
      type: 'Picklist',
      required: true,
      picklistValues: ['Active', 'Inactive', 'Pending'],
      defaultValue: 'Active',
    },
  ];

  for (const fieldData of propertyFields) {
    await prisma.customField.upsert({
      where: {
        objectId_apiName: {
          objectId: propertyObject.id,
          apiName: fieldData.apiName,
        },
      },
      update: {},
      create: {
        ...fieldData,
        objectId: propertyObject.id,
        picklistValues: fieldData.picklistValues ? JSON.stringify(fieldData.picklistValues) : null,
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });
  }

  console.log('✅ Created Property fields');

  // Create Account object
  const accountObject = await prisma.customObject.upsert({
    where: { apiName: 'Account' },
    update: {},
    create: {
      apiName: 'Account',
      label: 'Account',
      pluralLabel: 'Accounts',
      description: 'Business accounts and organizations',
      createdById: adminUser.id,
      modifiedById: adminUser.id,
    },
  });

  console.log('✅ Created Account object');

  // Create fields for Account
  const accountFields = [
    {
      apiName: 'accountNumber',
      label: 'Account Number',
      type: 'Text',
      required: true,
      unique: true,
    },
    {
      apiName: 'name',
      label: 'Account Name',
      type: 'Text',
      required: true,
    },
    {
      apiName: 'type',
      label: 'Type',
      type: 'Picklist',
      picklistValues: ['Customer', 'Prospect', 'Partner', 'Vendor'],
    },
    {
      apiName: 'email',
      label: 'Email',
      type: 'Email',
    },
    {
      apiName: 'phone',
      label: 'Phone',
      type: 'Phone',
    },
  ];

  for (const fieldData of accountFields) {
    await prisma.customField.upsert({
      where: {
        objectId_apiName: {
          objectId: accountObject.id,
          apiName: fieldData.apiName,
        },
      },
      update: {},
      create: {
        ...fieldData,
        objectId: accountObject.id,
        picklistValues: fieldData.picklistValues ? JSON.stringify(fieldData.picklistValues) : null,
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });
  }

  console.log('✅ Created Account fields');

  console.log('🎉 Database seeding completed!');
  console.log('\n📧 Admin credentials:');
  console.log('   Email: admin@crm.local');
  console.log('   Password: admin123');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
