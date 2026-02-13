import { prisma } from '@crm/db/client';

async function createDefaultLayouts() {
  try {
    console.log('Creating default page layouts for all objects...');

    // Get or create system user
    let systemUser = await prisma.user.findFirst({
      where: { email: 'system@crm.local' },
    });

    if (!systemUser) {
      systemUser = await prisma.user.create({
        data: {
          email: 'system@crm.local',
          name: 'System',
          role: 'ADMIN',
        },
      });
      console.log('✅ Created system user');
    }

    const userId = systemUser.id;

    // Get all active objects
    const objects = await prisma.customObject.findMany({
      where: { isActive: true },
      include: { fields: { where: { isActive: true } } },
    });

    for (const obj of objects) {
      // Check if object already has layouts
      const existingLayouts = await prisma.pageLayout.findMany({
        where: { objectId: obj.id },
      });

      if (existingLayouts.length > 0) {
        console.log(`⏭️  ${obj.apiName} already has ${existingLayouts.length} layout(s)`);
        continue;
      }

      // Create a default layout for this object
      const layout = await prisma.pageLayout.create({
        data: {
          objectId: obj.id,
          name: 'Default',
          layoutType: 'edit',
          isDefault: true,
          isActive: true,
          createdById: userId,
          modifiedById: userId,
        },
      });

      // Create a default tab
      const tab = await prisma.layoutTab.create({
        data: {
          layoutId: layout.id,
          label: 'Information',
          order: 0,
        },
      });

      // Create a default section with first 10 fields
      const section = await prisma.layoutSection.create({
        data: {
          tabId: tab.id,
          label: 'Details',
          columns: 2,
          order: 0,
        },
      });

      // Add fields to the section (first 10 non-system fields)
      const fieldsToAdd = obj.fields.slice(0, 10);
      
      for (let i = 0; i < fieldsToAdd.length; i++) {
        const field = fieldsToAdd[i];
        await prisma.layoutField.create({
          data: {
            sectionId: section.id,
            fieldId: field.id,
            column: i % 2,
            order: Math.floor(i / 2),
          },
        });
      }

      console.log(`✅ Created default layout for ${obj.apiName} with ${fieldsToAdd.length} fields`);
    }

    console.log('\n✅ All default layouts created successfully!');
  } catch (error) {
    console.error('Error creating default layouts:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultLayouts();
