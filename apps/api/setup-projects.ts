import { prisma } from '@crm/db/client';

async function setupProjects() {
  console.log('⏳ Setting up Projects object and layout...');

  // Get admin user
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@crm.local' } });
  if (!adminUser) {
    console.error('❌ Admin user not found. Make sure to seed first.');
    process.exit(1);
  }

  // Create or get Projects object
  let projectObject = await prisma.customObject.findUnique({ where: { apiName: 'Project' } });
  
  if (!projectObject) {
    projectObject = await prisma.customObject.create({
      data: {
        apiName: 'Project',
        label: 'Project',
        pluralLabel: 'Projects',
        description: 'Client projects and installations',
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });
    console.log('✅ Created Project object');
  } else {
    console.log('✅ Project object already exists');
  }

  // Define all fields for Projects
  const projectFields = [
    // General Information
    { apiName: 'projectName', label: 'Project Name', type: 'Text', required: true },
    { apiName: 'projectNumber', label: 'Project Number', type: 'AutoNumber' },
    { apiName: 'propertyAddress', label: 'Property Address', type: 'Lookup' },
    { apiName: 'contractDate', label: 'Contract Date', type: 'Date' },

    // Contact Information
    { apiName: 'primaryContactAtSite', label: 'Primary Contact at Site', type: 'Lookup' },
    { apiName: 'architectFirm', label: 'Architect Firm', type: 'Lookup' },
    { apiName: 'architectContact', label: 'Architect Contact', type: 'Lookup' },
    { apiName: 'contractor', label: 'Contractor', type: 'Lookup' },
    { apiName: 'contractorContact', label: 'Contractor Contact', type: 'Lookup' },
    { apiName: 'contractHolder', label: 'Contract Holder', type: 'Lookup' },
    { apiName: 'contractSignee', label: 'Contract Signee', type: 'Lookup' },
    { apiName: 'secondaryAccount', label: 'Secondary Account', type: 'Lookup' },
    { apiName: 'secondaryContact', label: 'Secondary Contact', type: 'Lookup' },
    { apiName: 'internalProjectManager', label: 'Internal Project Manager', type: 'Lookup' },
    { apiName: 'salesperson', label: 'Salesperson', type: 'Lookup' },
    { apiName: 'factoryProjectManager', label: 'Factory Project Manager', type: 'Lookup' },

    // Project Details
    { apiName: 'factory', label: 'Factory', type: 'Picklist', picklistValues: ['MHB', 'Korn', 'Arcadia', 'Airlux', 'Albertini', 'Aldra', 'Avers', 'CoMep', 'Kentucky Millwork', 'Kowa', 'Lockwood', 'Menck', 'Michael Reilly', 'Norwood', 'Riviera Bronze', 'Vedder'] },
    { apiName: 'productMaterial', label: 'Product Material', type: 'MultiPicklist', picklistValues: ['Airlux', 'Steel', 'Clad', 'Sipo', 'Teak'] },
    { apiName: 'productType', label: 'Product Type', type: 'MultiPicklist', picklistValues: ['Standard', 'Dade County', 'Double Hung'] },
    { apiName: 'productTypeQuantities', label: 'Product Type Quantities', type: 'Number' },
    { apiName: 'glassSpecifications', label: 'Glass Specifications', type: 'MultiPicklist', picklistValues: ['1-Clear', '2-Tinted', '3-Reflective', '4-Low-E', '5-Tempered', '6-Laminated', '7-Insulated', '8-Safety', '9-Decorative', '10-Obscured', '11-Toughened', '12-Coated', '13-Chromatic', '14-Switchable', '15-Smart', '16-Impact', '17-Fireproof', '18-Soundproof', '19-UV', '20-Thermal', '21-Privacy', '22-Anti-Glare', '23-Hydrophobic', '24-Oleophobic', '25-Self-Cleaning', '26-Electrochromic', '27-Photochromic', '28-Thermochromic', '29-Holographic', '30-Crystalline', '31-Borosilicate', '32-Soda-Lime', '33-Lead', '34-Bismuth', '35-Barium', '36-Strontium', '37-Zinc', '38-Titanium', '39-Rare-Earth', '40-Specialty'] },
    { apiName: 'finishSpecificationsMetal', label: 'Finish Specifications (Metal)', type: 'Picklist', picklistValues: ['Painted Steel', 'Painted Steel Split Finish', 'Cor-Ten Finish', '304 Satin Finish Stainless', '316 Polished Stainless', 'Marine Finish (Arcadia)', 'Maritime Finish (Airlux)', 'Anodized Aluminum', 'Painted Aluminum'] },
    { apiName: 'finishSpecificationsWood', label: 'Finish Specifications (Wood)', type: 'Picklist', picklistValues: ['Same Finish Inside/Outside (paint/paint or stain/stain)', 'Partial Split Finish (stain or painted exterior/clear or white dip interior)', 'Split Finish (alternate color interior/exterior, NOT split stain)', 'Split Stain Finish (alternate stain colors interior/exterior)'] },
    { apiName: 'dcSilicone', label: 'DC Silicone', type: 'Checkbox' },
    { apiName: 'solarControl', label: 'Solar Control', type: 'Checkbox' },
    { apiName: 'rollSystem', label: 'Roll System', type: 'MultiPicklist', picklistValues: ['Screen', 'Lutron', 'Check'] },
    { apiName: 'rollSystemQuantities', label: 'Roll System Quantities', type: 'Number' },

    // Shop Drawings
    { apiName: 'cadDrafter', label: 'CAD Drafter', type: 'MultiPicklist' },
    { apiName: 'submissionsDate', label: 'Submissions', type: 'Date' },

    // Project Ordering
    { apiName: 'orderStatus', label: 'Order Status', type: 'Picklist', picklistValues: ['To be scheduled', 'Scheduled', 'Delivered'] },
    { apiName: 'orderDate', label: 'Order Date', type: 'Date' },
    { apiName: 'expectedDeliveryMonth', label: 'Expected Delivery Date', type: 'Picklist', picklistValues: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
    { apiName: 'onHoldUnits', label: 'On Hold Units', type: 'Number' },
    { apiName: 'customHardwareDeliveryDate', label: 'Custom Hardware', type: 'Date' },
    { apiName: 'factoryOrderConfirmationReceivedDate', label: 'Factory Order Confirmation Received', type: 'Date' },
    { apiName: 'factoryOrderConfirmationConfirmedDate', label: 'Factory Order Confirmation Confirmed', type: 'Date' },
    { apiName: 'loadingListReceivedFromFactory', label: 'Loading List Received from Factory', type: 'Date' },
    { apiName: 'loadingListReceivedFromSite', label: 'Loading List Received from Site', type: 'Date' },
    { apiName: 'loadingListOutToFactory', label: 'Loading List Out to Factory', type: 'Date' },

    // Installation
    { apiName: 'preInstallSurveyDate', label: 'Pre-Install Survey', type: 'Date' },
    { apiName: 'preInstallSummary', label: 'Pre-Install Summary', type: 'LongText' },
    { apiName: 'installationTeam', label: 'Installation Team', type: 'MultiPicklist', picklistValues: ['Tischler und Sohn', 'Other'] },
    { apiName: 'installationMaterialACQ', label: 'Installation Material – ACQ', type: 'Picklist', picklistValues: ['Yes', 'No'] },
    { apiName: 'customerSignoffSentDate', label: 'Customer Signoff Sent', type: 'Date' },
    { apiName: 'customerSignoffReceivedDate', label: 'Customer Signoff Received', type: 'Date' },

    // Product Warranty
    { apiName: 'productDeliveryDate', label: 'Product Delivery Date', type: 'Date' },
    { apiName: 'unconditionalTerm', label: 'Unconditional Term', type: 'Picklist', picklistValues: ['2 Years', '3 Years', '4 Years', '5 Years', '6 Years', '7 Years', '8 Years', '9 Years', '10 Years'] },
    { apiName: 'unconditionalExpirationDate', label: 'Unconditional Expiration Date', type: 'Date' },
    { apiName: 'glassTerm', label: 'Glass Term', type: 'Picklist', picklistValues: ['2 Years', '10 Years', '11 Years', '12 Years', '13 Years', '14 Years', '15 Years', '16 Years', '17 Years', '18 Years'] },
    { apiName: 'glassExpirationDate', label: 'Glass Expiration Date', type: 'Date' },
    { apiName: 'finishTerm', label: 'Finish Term', type: 'Picklist', picklistValues: ['2 Years', '3 Years', '4 Years', '5 Years'] },
    { apiName: 'finishExpirationDate', label: 'Finish Expiration Date', type: 'Date' },
    { apiName: 'corrosionTerm', label: 'Corrosion Term', type: 'Picklist', picklistValues: ['20 Years', '21 Years', '22 Years', '23 Years'] },
    { apiName: 'corrosionExpirationDate', label: 'Corrosion Expiration Date', type: 'Date' },
    { apiName: 'warrantyFactory', label: 'Factory Type', type: 'Picklist', picklistValues: ['Korn', 'Airlux', 'Arcadia', 'MHB', 'Riviera Bronze'] },
    { apiName: 'hardwareWarranty', label: 'Hardware Warranty', type: 'Checkbox' },
    { apiName: 'magneticAlarm', label: 'Magnetic Alarm', type: 'Checkbox' },
  ];

  // Create or update all fields
  const projectFieldIds: Record<string, string> = {};
  for (const fieldData of projectFields) {
    const { apiName, label, type, picklistValues } = fieldData;
    
    const field = await prisma.customField.upsert({
      where: {
        objectId_apiName: {
          objectId: projectObject.id,
          apiName,
        },
      },
      update: {},
      create: {
        objectId: projectObject.id,
        apiName,
        label,
        type,
        picklistValues: picklistValues ? JSON.stringify(picklistValues) : null,
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });
    projectFieldIds[apiName] = field.id;
  }

  console.log(`✅ Created/updated ${Object.keys(projectFieldIds).length} fields`);

  // Check if layout already exists
  const existingLayout = await prisma.pageLayout.findFirst({
    where: { objectId: projectObject.id, name: 'Project Details' },
  });

  if (!existingLayout) {
    // Create page layout
    await prisma.pageLayout.create({
      data: {
        objectId: projectObject.id,
        name: 'Project Details',
        layoutType: 'edit',
        isDefault: true,
        createdById: adminUser.id,
        modifiedById: adminUser.id,
        tabs: {
          create: [
            {
              label: 'General Information',
              order: 0,
              sections: {
                create: [{
                  label: 'General Information',
                  order: 0,
                  columns: 2,
                  fields: { create: [
                    { fieldId: projectFieldIds['projectName'], order: 0, column: 0 },
                    { fieldId: projectFieldIds['projectNumber'], order: 1, column: 1 },
                    { fieldId: projectFieldIds['propertyAddress'], order: 2, column: 0 },
                    { fieldId: projectFieldIds['contractDate'], order: 3, column: 1 },
                  ]},
                }],
              },
            },
            {
              label: 'Contact Information',
              order: 1,
              sections: {
                create: [
                  {
                    label: 'External Contacts',
                    order: 0,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['primaryContactAtSite'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['architectFirm'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['architectContact'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['contractor'], order: 3, column: 1 },
                      { fieldId: projectFieldIds['contractorContact'], order: 4, column: 0 },
                      { fieldId: projectFieldIds['contractHolder'], order: 5, column: 1 },
                      { fieldId: projectFieldIds['contractSignee'], order: 6, column: 0 },
                      { fieldId: projectFieldIds['secondaryAccount'], order: 7, column: 1 },
                      { fieldId: projectFieldIds['secondaryContact'], order: 8, column: 0 },
                    ]},
                  },
                  {
                    label: 'Internal Contacts',
                    order: 1,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['internalProjectManager'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['salesperson'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['factoryProjectManager'], order: 2, column: 0 },
                    ]},
                  },
                ],
              },
            },
            {
              label: 'Project Details',
              order: 2,
              sections: {
                create: [
                  {
                    label: 'Factory & Materials',
                    order: 0,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['factory'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['productMaterial'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['productType'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['productTypeQuantities'], order: 3, column: 1 },
                    ]},
                  },
                  {
                    label: 'Glass & Finishes',
                    order: 1,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['glassSpecifications'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['finishSpecificationsMetal'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['finishSpecificationsWood'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['dcSilicone'], order: 3, column: 1 },
                      { fieldId: projectFieldIds['solarControl'], order: 4, column: 0 },
                    ]},
                  },
                  {
                    label: 'Roll Systems',
                    order: 2,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['rollSystem'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['rollSystemQuantities'], order: 1, column: 1 },
                    ]},
                  },
                ],
              },
            },
            {
              label: 'Shop Drawings',
              order: 3,
              sections: {
                create: [{
                  label: 'CAD & Submissions',
                  order: 0,
                  columns: 2,
                  fields: { create: [
                    { fieldId: projectFieldIds['cadDrafter'], order: 0, column: 0 },
                    { fieldId: projectFieldIds['submissionsDate'], order: 1, column: 1 },
                  ]},
                }],
              },
            },
            {
              label: 'Project Ordering',
              order: 4,
              sections: {
                create: [
                  {
                    label: 'Order Status',
                    order: 0,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['orderStatus'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['orderDate'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['expectedDeliveryMonth'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['onHoldUnits'], order: 3, column: 1 },
                    ]},
                  },
                  {
                    label: 'Confirmations & Loading',
                    order: 1,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['customHardwareDeliveryDate'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['factoryOrderConfirmationReceivedDate'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['factoryOrderConfirmationConfirmedDate'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['loadingListReceivedFromFactory'], order: 3, column: 1 },
                      { fieldId: projectFieldIds['loadingListReceivedFromSite'], order: 4, column: 0 },
                      { fieldId: projectFieldIds['loadingListOutToFactory'], order: 5, column: 1 },
                    ]},
                  },
                ],
              },
            },
            {
              label: 'Installation',
              order: 5,
              sections: {
                create: [
                  {
                    label: 'Pre-Installation',
                    order: 0,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['preInstallSurveyDate'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['preInstallSummary'], order: 1, column: 0 },
                    ]},
                  },
                  {
                    label: 'Installation & Sign-off',
                    order: 1,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['installationTeam'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['installationMaterialACQ'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['customerSignoffSentDate'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['customerSignoffReceivedDate'], order: 3, column: 1 },
                    ]},
                  },
                ],
              },
            },
            {
              label: 'Product Warranty',
              order: 6,
              sections: {
                create: [
                  {
                    label: 'Warranty Terms',
                    order: 0,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['productDeliveryDate'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['unconditionalTerm'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['unconditionalExpirationDate'], order: 2, column: 0 },
                      { fieldId: projectFieldIds['glassTerm'], order: 3, column: 1 },
                      { fieldId: projectFieldIds['glassExpirationDate'], order: 4, column: 0 },
                      { fieldId: projectFieldIds['finishTerm'], order: 5, column: 1 },
                      { fieldId: projectFieldIds['finishExpirationDate'], order: 6, column: 0 },
                      { fieldId: projectFieldIds['corrosionTerm'], order: 7, column: 1 },
                      { fieldId: projectFieldIds['corrosionExpirationDate'], order: 8, column: 0 },
                    ]},
                  },
                  {
                    label: 'Warranty Details',
                    order: 1,
                    columns: 2,
                    fields: { create: [
                      { fieldId: projectFieldIds['warrantyFactory'], order: 0, column: 0 },
                      { fieldId: projectFieldIds['hardwareWarranty'], order: 1, column: 1 },
                      { fieldId: projectFieldIds['magneticAlarm'], order: 2, column: 0 },
                    ]},
                  },
                ],
              },
            },
          ],
        },
      },
    });
    console.log('✅ Created Project page layout');
  } else {
    console.log('✅ Layout already exists');
  }

  console.log('\n🎉 Projects setup complete!');
  process.exit(0);
}

setupProjects().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
