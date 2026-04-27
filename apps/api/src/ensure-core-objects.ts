import { prisma } from '@crm/db/client';
import { generateId } from '@crm/db/record-id';

/**
 * Core CRM object definitions that must always exist in the database.
 * On API startup we upsert each one so the records routes never return 404
 * for a known object type.
 */
const CORE_OBJECTS = [
  {
    apiName: 'Property',
    label: 'Property',
    pluralLabel: 'Properties',
    description: 'Real estate properties',
    fields: [
      { apiName: 'propertyNumber', label: 'Property Number', type: 'Text', unique: true },
      { apiName: 'address', label: 'Address', type: 'Text', required: true },
      { apiName: 'city', label: 'City', type: 'Text', required: true },
      { apiName: 'state', label: 'State/Province', type: 'Text', required: true },
      { apiName: 'zipCode', label: 'Postal / Zip Code', type: 'Text' },
      { apiName: 'country', label: 'Country', type: 'Text' },
      { apiName: 'latitude', label: 'Latitude', type: 'Number' },
      { apiName: 'longitude', label: 'Longitude', type: 'Number' },
      { apiName: 'status', label: 'Status', type: 'Picklist', required: true, picklistValues: ['Active', 'Inactive', 'Pending'], defaultValue: 'Active' },
    ],
  },
  {
    apiName: 'Contact',
    label: 'Contact',
    pluralLabel: 'Contacts',
    description: 'People and contacts',
    fields: [
      { apiName: 'firstName', label: 'First Name', type: 'Text' },
      { apiName: 'lastName', label: 'Last Name', type: 'Text' },
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
      { apiName: 'accountNumber', label: 'Account Number', type: 'Text', unique: true },
      { apiName: 'name', label: 'Account Name', type: 'Text' },
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
      { apiName: 'productCode', label: 'Product Code', type: 'Text', unique: true },
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
      { apiName: 'leadNumber', label: 'Lead Number', type: 'Text', unique: true },
      { apiName: 'firstName', label: 'First Name', type: 'Text' },
      { apiName: 'lastName', label: 'Last Name', type: 'Text', required: true },
      { apiName: 'company', label: 'Company', type: 'Text' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'leadSource', label: 'Lead Source', type: 'Picklist', picklistValues: ['Web', 'Phone', 'Referral', 'Partner', 'Other'] },
      { apiName: 'stage', label: 'Stage', type: 'Picklist', picklistValues: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'], defaultValue: 'New' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
    ],
  },
  {
    apiName: 'Opportunity',
    label: 'Opportunity',
    pluralLabel: 'Opportunities',
    description: 'Sales opportunities',
    fields: [
      { apiName: 'opportunityNumber', label: 'Opportunity Number', type: 'Text', unique: true },
      { apiName: 'opportunityName', label: 'Opportunity Name', type: 'Text', required: true },
      { apiName: 'amount', label: 'Amount', type: 'Currency' },
      { apiName: 'closeDate', label: 'Close Date', type: 'Date' },
      { apiName: 'stage', label: 'Stage', type: 'Picklist', picklistValues: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'], defaultValue: 'Prospecting' },
      { apiName: 'probability', label: 'Probability (%)', type: 'Percent' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
      { apiName: 'lead', label: 'Lead', type: 'Lookup' },
    ],
  },
  {
    apiName: 'Project',
    label: 'Project',
    pluralLabel: 'Projects',
    description: 'Project management',
    fields: [
      { apiName: 'projectNumber', label: 'Project Number', type: 'Text', unique: true },
      { apiName: 'projectName', label: 'Project Name', type: 'Text', required: true },
      { apiName: 'description', label: 'Description', type: 'TextArea' },
      { apiName: 'startDate', label: 'Start Date', type: 'Date' },
      { apiName: 'endDate', label: 'End Date', type: 'Date' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], defaultValue: 'Planning' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
      { apiName: 'opportunity', label: 'Opportunity', type: 'Lookup' },
    ],
  },
  {
    apiName: 'Service',
    label: 'Service',
    pluralLabel: 'Services',
    description: 'Service tickets and requests',
    fields: [
      { apiName: 'serviceNumber', label: 'Service Number', type: 'Text', unique: true },
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
      { apiName: 'quoteNumber', label: 'Quote Number', type: 'Text', unique: true },
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
      { apiName: 'installationNumber', label: 'Installation Number', type: 'Text', unique: true },
      { apiName: 'installationName', label: 'Installation Name', type: 'Text', required: true },
      { apiName: 'scheduledDate', label: 'Scheduled Date', type: 'Date' },
      { apiName: 'completedDate', label: 'Completed Date', type: 'Date' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Scheduled', 'In Progress', 'Completed', 'Cancelled'], defaultValue: 'Scheduled' },
      // Core
      { apiName: 'startDate', label: 'Start Date', type: 'Date' },
      { apiName: 'endDate', label: 'End Date', type: 'Date' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'installationBudget', label: 'Installation Budget', type: 'Currency' },
      // Calculated (set by controller)
      { apiName: 'finalCost', label: 'Final Cost', type: 'Currency' },
      { apiName: 'finalProfit', label: 'Final Profit', type: 'Currency' },
      { apiName: 'techExpenseTotal', label: 'Tech Expense Total', type: 'Currency' },
      // Estimated costs (for variance reporting)
      { apiName: 'estimatedLaborCost', label: 'Estimated Labor Cost', type: 'Currency' },
      { apiName: 'estimatedHotel', label: 'Estimated Hotel', type: 'Currency' },
      { apiName: 'estimatedTravelExp', label: 'Estimated Travel Expense', type: 'Currency' },
      { apiName: 'estimatedMileage', label: 'Estimated Mileage', type: 'Currency' },
      { apiName: 'estimatedPerDiem', label: 'Estimated Per Diem', type: 'Currency' },
      { apiName: 'estimatedFlights', label: 'Estimated Flights', type: 'Currency' },
      { apiName: 'estimatedCarRental', label: 'Estimated Car Rental', type: 'Currency' },
      { apiName: 'estimatedParking', label: 'Estimated Parking', type: 'Currency' },
      { apiName: 'estimatedEquipment', label: 'Estimated Equipment', type: 'Currency' },
      { apiName: 'estimatedMiscellaneous', label: 'Estimated Miscellaneous', type: 'Currency' },
      { apiName: 'estimatedWaterproofing', label: 'Estimated Waterproofing', type: 'Currency' },
      { apiName: 'estimatedWoodBucks', label: 'Estimated Wood Bucks', type: 'Currency' },
      { apiName: 'estimatedAirportTransportation', label: 'Estimated Airport Transportation', type: 'Currency' },
      { apiName: 'estimatedMaterials', label: 'Estimated Materials', type: 'Currency' },
      { apiName: 'estimatedContainerUnload', label: 'Estimated Container Unload', type: 'Currency' },
      { apiName: 'estimatedLaborHours', label: 'Estimated Labor Hours', type: 'Number' },
      { apiName: 'estimatedWaterproofingLabor', label: 'Estimated WP Labor', type: 'Currency' },
      { apiName: 'estimatedWoodBucksLabor', label: 'Estimated WB Labor', type: 'Currency' },
      { apiName: 'estimatedTravelTime', label: 'Estimated Travel Time', type: 'Currency' },
      { apiName: 'estimatedInternalLabor', label: 'Estimated Internal Labor', type: 'Currency' },
    ],
  },
  {
    apiName: 'WorkOrder',
    label: 'Work Order',
    pluralLabel: 'Work Orders',
    description: 'Scheduled work orders for service and maintenance',
    fields: [
      { apiName: 'workOrderNumber', label: 'Work Order Number', type: 'Text', unique: true },
      { apiName: 'name', label: 'Work Order', type: 'Text' },
      { apiName: 'title', label: 'Title', type: 'TextArea' },
      { apiName: 'workOrderType', label: 'Work Order Type', type: 'Picklist', picklistValues: ['Installation', 'Repair', 'Maintenance', 'Inspection', 'Warranty', 'Punch List', 'Other'], defaultValue: 'Repair' },
      { apiName: 'workStatus', label: 'Work Status', type: 'Picklist', picklistValues: ['New', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], defaultValue: 'New' },
      { apiName: 'scheduledStartDate', label: 'Scheduled Start Date', type: 'Date' },
      { apiName: 'scheduledEndDate', label: 'Scheduled End Date', type: 'Date' },
      { apiName: 'estimateCost', label: 'Estimate Cost', type: 'Currency' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
    ],
  },
  {
    apiName: 'TeamMember',
    label: 'Team Member',
    pluralLabel: 'Team Members',
    description: 'Junction object linking contacts and accounts to properties, opportunities, projects, work orders, installations, and leads',
    fields: [
      { apiName: 'teamMemberNumber', label: 'Team Member Number', type: 'Text', unique: true },
      { apiName: 'contact', label: 'Contact', type: 'Lookup' },
      { apiName: 'account', label: 'Account', type: 'Lookup' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
      { apiName: 'opportunity', label: 'Opportunity', type: 'Lookup' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup' },
      { apiName: 'installation', label: 'Installation', type: 'Lookup' },
      { apiName: 'lead', label: 'Lead', type: 'Lookup' },
      { apiName: 'role', label: 'Role', type: 'Picklist', required: true, picklistValues: ['Homeowner', 'General Contractor', 'Subcontractor', 'Architect / Designer', 'Property Manager', 'Sales Rep', 'Installer', 'Inspector', 'Engineer', 'Other'] },
      { apiName: 'primaryContact', label: 'Primary Contact', type: 'Checkbox' },
      { apiName: 'contractHolder', label: 'Contract Holder', type: 'Checkbox' },
      { apiName: 'quoteRecipient', label: 'Quote Recipient', type: 'Checkbox' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
  {
    apiName: 'Technician',
    label: 'Technician',
    pluralLabel: 'Technicians',
    description: 'Installation technicians for cost analysis',
    fields: [
      { apiName: 'technicianName', label: 'Technician Name', type: 'Text', required: true },
      { apiName: 'hourlyRate', label: 'Hourly Rate', type: 'Currency', required: true },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Active', 'Inactive'], defaultValue: 'Active' },
    ],
  },
  {
    apiName: 'InstallationTechnician',
    label: 'Installation Technician',
    pluralLabel: 'Installation Technicians',
    description: 'Junction linking technicians to installations with frozen hourly rate',
    fields: [
      { apiName: 'installation', label: 'Installation', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'assignedHourlyRate', label: 'Assigned Hourly Rate', type: 'Currency', required: true },
    ],
  },
  {
    apiName: 'InstallationCost',
    label: 'Installation Cost',
    pluralLabel: 'Installation Costs',
    description: 'Weekly project-level cost records for an installation',
    fields: [
      { apiName: 'installation', label: 'Installation', type: 'Lookup', required: true },
      { apiName: 'weekNumber', label: 'Week Number', type: 'Number', required: true },
      { apiName: 'weekStartDate', label: 'Week Start Date', type: 'Date', required: true },
      { apiName: 'weekEndDate', label: 'Week End Date', type: 'Date', required: true },
      { apiName: 'flightsActual', label: 'Flights', type: 'Currency' },
      { apiName: 'lodgingActual', label: 'Lodging', type: 'Currency' },
      { apiName: 'carRental', label: 'Car Rental', type: 'Currency' },
      { apiName: 'airportTransportation', label: 'Airport Transportation', type: 'Currency' },
      { apiName: 'parking', label: 'Parking', type: 'Currency' },
      { apiName: 'equipment', label: 'Equipment', type: 'Currency' },
      { apiName: 'miscellaneousExpenses', label: 'Miscellaneous', type: 'Currency' },
      { apiName: 'waterproofing', label: 'Waterproofing', type: 'Currency' },
      { apiName: 'woodBucks', label: 'Wood Bucks', type: 'Currency' },
    ],
  },
  {
    apiName: 'InstallationTechExpense',
    label: 'Installation Tech Expense',
    pluralLabel: 'Installation Tech Expenses',
    description: 'Per-technician weekly labor hours and expenses',
    fields: [
      { apiName: 'installation', label: 'Installation', type: 'Lookup', required: true },
      { apiName: 'installationTechnician', label: 'Installation Technician', type: 'Lookup', required: true },
      { apiName: 'weekNumber', label: 'Week Number', type: 'Number', required: true },
      { apiName: 'weekStartDate', label: 'Week Start Date', type: 'Date', required: true },
      { apiName: 'weekEndDate', label: 'Week End Date', type: 'Date', required: true },
      { apiName: 'containerUnload', label: 'Container Unload', type: 'Number' },
      { apiName: 'woodbucks', label: 'Woodbucks', type: 'Number' },
      { apiName: 'waterproofing', label: 'Waterproofing', type: 'Number' },
      { apiName: 'installationLabor', label: 'Installation Labor', type: 'Number' },
      { apiName: 'travel', label: 'Travel', type: 'Number' },
      { apiName: 'waterTesting', label: 'Water Testing', type: 'Number' },
      { apiName: 'sills', label: 'Sills', type: 'Number' },
      { apiName: 'finishCaulking', label: 'Finish Caulking', type: 'Number' },
      { apiName: 'screenLutronShades', label: 'Screen/Lutron/Shades', type: 'Number' },
      { apiName: 'punchListWork', label: 'Punch List Work', type: 'Number' },
      { apiName: 'finishHardware', label: 'Finish Hardware', type: 'Number' },
      { apiName: 'finalAdjustments', label: 'Final Adjustments', type: 'Number' },
      { apiName: 'perDiem', label: 'Per Diem', type: 'Currency' },
      { apiName: 'mileage', label: 'Mileage', type: 'Currency' },
      { apiName: 'materials', label: 'Materials', type: 'Currency' },
    ],
  },
  {
    apiName: 'Task',
    label: 'Task',
    pluralLabel: 'Tasks',
    description: 'Tasks and activities',
    fields: [
      { apiName: 'taskNumber', label: 'Task Number', type: 'Text', unique: true },
      { apiName: 'subject', label: 'Subject', type: 'Text', required: true },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Open', 'In Progress', 'Completed', 'Cancelled'], defaultValue: 'Open' },
      { apiName: 'priority', label: 'Priority', type: 'Picklist', picklistValues: ['High', 'Normal', 'Low'], defaultValue: 'Normal' },
      { apiName: 'dueDate', label: 'Due Date', type: 'Date' },
      { apiName: 'description', label: 'Description', type: 'LongTextArea' },
      { apiName: 'assignedToUserId', label: 'Assigned To', type: 'Lookup' },
      { apiName: 'relatedObjectApi', label: 'Related Object', type: 'Text' },
      { apiName: 'relatedRecordId', label: 'Related Record', type: 'Text' },
    ],
  },
];

/**
 * Ensures every core CRM object (and its fields + default layout) exists in the
 * database.  Uses upsert so it is safe to call on every startup.
 *
 * Requires at least one User row in the database to set as createdBy / modifiedBy.
 */
export async function ensureCoreObjects(): Promise<void> {
  console.log('[ensure-core-objects] Checking core objects...');

  // Rename Deal→Opportunity if the legacy name still exists
  const legacyDeal = await prisma.customObject.findFirst({ where: { apiName: 'Deal' } });
  if (legacyDeal) {
    // Check if Opportunity already exists separately
    const existingOpp = await prisma.customObject.findFirst({ where: { apiName: 'Opportunity' } });
    if (existingOpp) {
      // Both exist — migrate records from Deal to Opportunity, then delete Deal
      await prisma.record.updateMany({ where: { objectId: legacyDeal.id }, data: { objectId: existingOpp.id } });
      await prisma.customObject.delete({ where: { id: legacyDeal.id } });
      console.log('[ensure-core-objects] Merged Deal records into Opportunity and removed Deal object');
    } else {
      // Rename Deal → Opportunity in place (preserves records + fields)
      await prisma.customObject.update({
        where: { id: legacyDeal.id },
        data: { apiName: 'Opportunity', label: 'Opportunity', pluralLabel: 'Opportunities' },
      });
      console.log('[ensure-core-objects] Renamed Deal → Opportunity (preserved records)');
    }
  }

  // Grab any existing user to use as the creator/modifier
  let systemUser = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });

  if (!systemUser) {
    // If somehow no users exist yet, create a system user
    const crypto = await import('crypto');
    const ITERATIONS = 310_000;
    const KEYLEN = 32;
    const DIGEST = 'sha256';
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.pbkdf2Sync('admin123', salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
    const passwordHash = `pbkdf2$${ITERATIONS}$${DIGEST}$${salt}$${derived}`;

    systemUser = await prisma.user.create({
      data: {
        id: generateId('User'),
        email: 'admin@crm.local',
        passwordHash,
        name: 'System Admin',
        role: 'ADMIN',
      },
    });
    console.log('[ensure-core-objects] Created system admin user');
  }

  let created = 0;
  let existed = 0;

  for (const objDef of CORE_OBJECTS) {
    const existing = await prisma.customObject.findFirst({
      where: { apiName: { equals: objDef.apiName, mode: 'insensitive' } },
    });

    if (existing) {
      existed++;
      // Ensure fields exist even if the object already exists
      await ensureFields(existing.id, objDef.fields, systemUser.id);
      continue;
    }

    // Object doesn't exist — create it
    const obj = await prisma.customObject.create({
      data: {
        id: generateId('CustomObject'),
        apiName: objDef.apiName,
        label: objDef.label,
        pluralLabel: objDef.pluralLabel,
        description: objDef.description,
        createdById: systemUser.id,
        modifiedById: systemUser.id,
      },
    });

    // Create fields
    await ensureFields(obj.id, objDef.fields, systemUser.id);

    // Create default page layout
    await createDefaultLayout(obj.id, systemUser.id);

    created++;
    console.log(`[ensure-core-objects] Created ${objDef.apiName} with ${objDef.fields.length} fields`);
  }

  console.log(
    `[ensure-core-objects] Done — ${created} created, ${existed} already existed (${CORE_OBJECTS.length} total)`
  );

  // Fix: ensure Contact firstName/lastName are NOT required in the DB.
  // The web schema uses a CompositeText "Name" field instead of separate
  // firstName/lastName fields, so requiring them blocks record creation.
  try {
    const contactObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Contact', mode: 'insensitive' } },
    });
    if (contactObj) {
      await prisma.customField.updateMany({
        where: {
          objectId: contactObj.id,
          apiName: { in: ['firstName', 'lastName'] },
          required: true,
        },
        data: { required: false },
      });
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix Contact name field requirements:', err);
  }

  // Fix: ensure auto-generated number fields are NOT required in the DB.
  // These are populated by the application (e.g., 'A-001'), not by the user.
  // Also fix the Account 'name' field — the web schema stores it as
  // 'accountName' so requiring the DB 'name' field blocks inline creates.
  try {
    const autoNumberFieldNames = [
      'accountNumber', 'propertyNumber', 'contactNumber', 'leadNumber',
      'opportunityNumber', 'productCode', 'projectNumber', 'quoteNumber',
      'serviceNumber', 'installationNumber', 'workOrderNumber', 'teamMemberNumber',
    ];
    await prisma.customField.updateMany({
      where: {
        apiName: { in: autoNumberFieldNames },
        required: true,
      },
      data: { required: false },
    });

    // Account 'name' field is stored as 'accountName' in the web schema
    const accountObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Account', mode: 'insensitive' } },
    });
    if (accountObj) {
      await prisma.customField.updateMany({
        where: {
          objectId: accountObj.id,
          apiName: 'name',
          required: true,
        },
        data: { required: false },
      });
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix auto-number/name field requirements:', err);
  }

  // Fix: ensure Lead 'property' lookup field is required.
  // Every Lead must be linked to a Property so Dropbox folder auto-creation works.
  try {
    const leadObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Lead', mode: 'insensitive' } },
    });
    if (leadObj) {
      await prisma.customField.updateMany({
        where: {
          objectId: leadObj.id,
          apiName: 'property',
          required: false,
        },
        data: { required: true },
      });
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix Lead property field requirement:', err);
  }

  // Also sync any user-created objects from the schema settings to the DB.
  // The schema (stored in the Setting table under 'orgSchema') may contain
  // objects that were created in the UI but whose apiClient.createObject call
  // failed (e.g., first letter not capitalised, transient network error, etc.).
  await syncSchemaObjectsToDb(systemUser.id);
}

/**
 * Read the saved OrgSchema from the settings table and ensure every object
 * defined in it also exists in the customObject + customField tables.
 */
async function syncSchemaObjectsToDb(userId: string): Promise<void> {
  try {
    const schemaSetting = await prisma.setting.findUnique({ where: { key: 'orgSchema' } });
    if (!schemaSetting || !schemaSetting.value) return;

    const schema = schemaSetting.value as any;
    const objects: any[] = schema.objects || [];

    let synced = 0;
    for (const obj of objects) {
      if (!obj.apiName || obj.apiName === 'Home') continue;

      const existing = await prisma.customObject.findFirst({
        where: { apiName: { equals: obj.apiName, mode: 'insensitive' } },
      });

      if (existing) continue;

      // Validate apiName starts with uppercase (API requirement)
      const validApiName = /^[A-Z][A-Za-z0-9_]*$/.test(obj.apiName)
        ? obj.apiName
        : obj.apiName.charAt(0).toUpperCase() + obj.apiName.slice(1);

      try {
        const dbObj = await prisma.customObject.create({
          data: {
            id: generateId('CustomObject'),
            apiName: validApiName,
            label: obj.label || validApiName,
            pluralLabel: obj.pluralLabel || obj.label || validApiName,
            description: obj.description || null,
            createdById: userId,
            modifiedById: userId,
          },
        });

        // Sync fields from the schema
        const fields: any[] = obj.fields || [];
        const systemFieldNames = new Set(['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById']);
        const customFields = fields.filter((f: any) =>
          !systemFieldNames.has(f.apiName) &&
          f.type !== 'Lookup' && f.type !== 'ExternalLookup'
        );

        for (const fieldDef of customFields) {
          try {
            await prisma.customField.create({
              data: {
                id: generateId('CustomField'),
                objectId: dbObj.id,
                apiName: fieldDef.apiName,
                label: fieldDef.label || fieldDef.apiName,
                type: fieldDef.type || 'Text',
                required: fieldDef.required || false,
                unique: fieldDef.unique || false,
                picklistValues: fieldDef.picklistValues ? JSON.stringify(fieldDef.picklistValues) : null,
                defaultValue: fieldDef.defaultValue || null,
                createdById: userId,
                modifiedById: userId,
              },
            });
          } catch {
            // Skip fields that fail (e.g., duplicates)
          }
        }

        // Create a default layout
        await createDefaultLayout(dbObj.id, userId);

        synced++;
        console.log(`[ensure-core-objects] Synced schema object "${validApiName}" to DB with ${customFields.length} fields`);
      } catch (err) {
        console.warn(`[ensure-core-objects] Failed to sync schema object "${obj.apiName}":`, err);
      }
    }

    if (synced > 0) {
      console.log(`[ensure-core-objects] Synced ${synced} additional objects from schema settings`);
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not sync schema objects:', err);
  }
}

interface FieldDef {
  apiName: string;
  label: string;
  type: string;
  required?: boolean;
  unique?: boolean;
  picklistValues?: string[];
  defaultValue?: string;
}

async function ensureFields(objectId: string, fields: FieldDef[], userId: string): Promise<void> {
  for (const fieldDef of fields) {
    const existing = await prisma.customField.findFirst({
      where: { objectId, apiName: fieldDef.apiName },
    });
    if (existing) continue;

    await prisma.customField.create({
      data: {
        id: generateId('CustomField'),
        objectId,
        apiName: fieldDef.apiName,
        label: fieldDef.label,
        type: fieldDef.type,
        required: fieldDef.required || false,
        unique: fieldDef.unique || false,
        picklistValues: fieldDef.picklistValues ? JSON.stringify(fieldDef.picklistValues) : null,
        defaultValue: fieldDef.defaultValue || null,
        createdById: userId,
        modifiedById: userId,
      },
    });
  }
}

async function createDefaultLayout(objectId: string, userId: string): Promise<void> {
  const layoutExists = await prisma.pageLayout.findFirst({
    where: { objectId, name: 'Default Layout' },
  });
  if (layoutExists) return;

  const layout = await prisma.pageLayout.create({
    data: {
      id: generateId('PageLayout'),
      objectId,
      name: 'Default Layout',
      layoutType: 'edit',
      isDefault: true,
      createdById: userId,
      modifiedById: userId,
    },
  });

  const tab = await prisma.layoutTab.create({
    data: {
      id: generateId('LayoutTab'),
      layoutId: layout.id,
      label: 'Details',
      order: 0,
    },
  });

  const section = await prisma.layoutSection.create({
    data: {
      id: generateId('LayoutSection'),
      tabId: tab.id,
      label: 'Information',
      columns: 2,
      order: 0,
    },
  });

  const objFields = await prisma.customField.findMany({ where: { objectId } });
  for (let i = 0; i < objFields.length; i++) {
    const field = objFields[i];
    if (field) {
      await prisma.layoutField.create({
        data: {
          id: generateId('LayoutField'),
          sectionId: section.id,
          fieldId: field.id,
          column: i % 2,
          order: Math.floor(i / 2),
        },
      });
    }
  }
}
