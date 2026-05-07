import { prisma } from '@crm/db/client';
import { Prisma } from '@prisma/client';
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
      { apiName: 'firstName', label: 'First Name', type: 'Text', required: true },
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
      { apiName: 'type', label: 'Type', type: 'Picklist', required: true, picklistValues: ['Customer', 'Prospect', 'Partner', 'Vendor'] },
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
      { apiName: 'lastName', label: 'Last Name', type: 'Text' },
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
      { apiName: 'probability', label: 'Probability (%)', type: 'Percent', min: 0, max: 100 },
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
      { apiName: 'contact2', label: 'Contact 2', type: 'Checkbox' },
      { apiName: 'contact3', label: 'Contact 3', type: 'Checkbox' },
      { apiName: 'contact4', label: 'Contact 4', type: 'Checkbox' },
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

  // Fix: ensure name/identity fields that users may have deleted are NOT required.
  // These fields are re-created on startup (ensureFields), so they must never block
  // record creation. Covers both prefixed (Contact__firstName) and bare (firstName) forms.
  // NOTE: Contact name validation (at least one of firstName/lastName) is enforced
  // in the records API route, not via schema required flags, because the fields must
  // remain individually optional for the CompositeText name widget to work.
  try {
    // Un-require Contact firstName/lastName
    const contactObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Contact', mode: 'insensitive' } },
    });
    if (contactObj) {
      const result = await prisma.customField.updateMany({
        where: {
          objectId: contactObj.id,
          apiName: { in: ['firstName', 'lastName', 'Contact__firstName', 'Contact__lastName', 'status', 'Contact__status'] },
          required: true,
        },
        data: { required: false },
      });
      if (result.count > 0) console.log(`[ensure-core-objects] Un-required ${result.count} Contact identity field(s)`);
    }
    // Un-require Lead lastName
    const leadObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Lead', mode: 'insensitive' } },
    });
    if (leadObj) {
      const result = await prisma.customField.updateMany({
        where: {
          objectId: leadObj.id,
          apiName: { in: ['firstName', 'lastName'] },
          required: true,
        },
        data: { required: false },
      });
      if (result.count > 0) console.log(`[ensure-core-objects] Un-required ${result.count} Lead identity field(s)`);
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix name field requirements:', err);
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
    const autoResult = await prisma.customField.updateMany({
      where: {
        apiName: { in: autoNumberFieldNames },
        required: true,
      },
      data: { required: false },
    });
    if (autoResult.count > 0) console.log(`[ensure-core-objects] Un-required ${autoResult.count} auto-number field(s)`);

    // Account 'name' field is stored as 'accountName' in the web schema
    const accountObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Account', mode: 'insensitive' } },
    });
    if (accountObj) {
      const nameResult = await prisma.customField.updateMany({
        where: {
          objectId: accountObj.id,
          apiName: 'name',
          required: true,
        },
        data: { required: false },
      });
      if (nameResult.count > 0) console.log('[ensure-core-objects] Un-required Account name field');
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
      const result = await prisma.customField.updateMany({
        where: {
          objectId: leadObj.id,
          apiName: 'property',
          required: false,
        },
        data: { required: true },
      });
      if (result.count > 0) console.log('[ensure-core-objects] Set Lead property field to required');
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix Lead property field requirement:', err);
  }

  // Fix: ensure Opportunity probability fields have min=0, max=100 constraints.
  // This covers both the code-defined 'probability' field AND any user-created
  // custom fields whose label contains "probability" (e.g. "Salesman Probability").
  try {
    const oppObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
    });
    if (oppObj) {
      // Fix the code-defined probability field
      const codeResult = await prisma.customField.updateMany({
        where: {
          objectId: oppObj.id,
          apiName: 'probability',
          max: null,
        },
        data: { min: 0, max: 100 },
      });
      if (codeResult.count > 0) console.log('[ensure-core-objects] Set min/max on Opportunity.probability field');

      // Fix field type from Picklist to Percent if created with old schema definition
      const typeFixResult = await prisma.customField.updateMany({
        where: {
          objectId: oppObj.id,
          apiName: 'probability',
          type: 'Picklist',
        },
        data: { type: 'Percent', min: 0, max: 100, picklistValues: Prisma.DbNull },
      });
      if (typeFixResult.count > 0) console.log('[ensure-core-objects] Fixed Opportunity.probability type from Picklist to Percent');

      // Fix any user-created probability fields (e.g. "Salesman Probability").
      // DB field type may be stored in any case (Percent, percent, PERCENT etc.)
      // so we match each variant separately.
      let customTotal = 0;
      for (const typeName of ['Percent', 'percent', 'Number', 'number']) {
        const r = await prisma.customField.updateMany({
          where: {
            objectId: oppObj.id,
            type: typeName,
            label: { contains: 'probability', mode: 'insensitive' },
            OR: [{ max: null }, { max: { not: 100 } }],
          },
          data: { min: 0, max: 100 },
        });
        customTotal += r.count;
      }
      if (customTotal > 0) console.log(`[ensure-core-objects] Set min/max on ${customTotal} custom probability field(s)`);
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix Opportunity probability constraints:', err);
  }

  // Fix: ensure Account 'type' (accountType) field is required in the DB.
  // The CORE_OBJECTS definition has required: true, but the schema-service
  // fallback may have created it without required, causing a mismatch.
  try {
    const accountObj = await prisma.customObject.findFirst({
      where: { apiName: { equals: 'Account', mode: 'insensitive' } },
    });
    if (accountObj) {
      const result = await prisma.customField.updateMany({
        where: {
          objectId: accountObj.id,
          apiName: { in: ['type', 'accountType', 'Account__accountType', 'Account__type'] },
          type: 'Picklist',
          required: false,
        },
        data: { required: true },
      });
      if (result.count > 0) console.log(`[ensure-core-objects] Set Account type field to required (${result.count} field(s))`);
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not fix Account type field requirement:', err);
  }

  // Fix: patch orgSchema JSON for:
  //  1. min/max on Opportunity probability fields (code-defined AND user-created)
  //  2. "Associated Opportunies" → "Associated Opportunities" typo in ALL label locations
  //  3. Property RelatedList widget that incorrectly queries Account instead of Opportunity
  //  4. Account type field required flag
  //  5. Opportunity propertyAddress field visibility (redundant with property Lookup)
  try {
    const schemaSetting = await prisma.setting.findUnique({ where: { key: 'orgSchema' } });
    if (schemaSetting?.value) {
      const orgSchema = schemaSetting.value as any;
      let changed = false;
      const fixes: string[] = []; // track which fixes fired for logging

      for (const obj of orgSchema.objects || []) {
        // 1. Patch probability min/max — match by label containing "probability"
        //    (covers both code-defined and user-created fields like "Salesman Probability")
        if (obj.apiName === 'Opportunity') {
          for (const field of obj.fields || []) {
            const fieldTypeLower = (field.type || '').toLowerCase();
            const isProbField =
              field.apiName === 'Opportunity__probability' ||
              field.apiName === 'probability' ||
              (typeof field.label === 'string' &&
               field.label.toLowerCase().includes('probability') &&
               (fieldTypeLower === 'percent' || fieldTypeLower === 'number'));
            if (isProbField && (field.min === undefined || field.max === undefined || field.max !== 100)) {
              field.min = 0;
              field.max = 100;
              changed = true;
              fixes.push(`probability min/max on ${field.apiName || field.label}`);
            }
            if (isProbField && fieldTypeLower === 'picklist') {
              field.type = 'Percent';
              field.precision = 3;
              field.scale = 0;
              field.min = 0;
              field.max = 100;
              delete field.picklistValues;
              changed = true;
              fixes.push(`probability type Picklist→Percent on ${field.apiName || field.label}`);
            }
          }
        }

        // 4. Ensure Account type field has required: true in orgSchema
        if (obj.apiName === 'Account') {
          for (const field of obj.fields || []) {
            const isTypeField =
              field.apiName === 'Account__accountType' ||
              field.apiName === 'accountType' ||
              field.apiName === 'type' ||
              field.apiName === 'Account__type';
            if (isTypeField && field.type === 'Picklist' && !field.required) {
              field.required = true;
              changed = true;
              fixes.push('Account type required');
            }
          }
        }

        // 5. Remove Opportunity__propertyAddress entirely — it's redundant
        //    with the Opportunity__property Lookup field and displays raw IDs.
        //    Remove from both the fields array and all page layouts.
        if (obj.apiName === 'Opportunity') {
          // Check if the Lookup property field exists
          const hasPropertyLookup = (obj.fields || []).some(
            (f: any) => {
              const api = (f.apiName || '').toLowerCase();
              const t = (f.type || '').toLowerCase();
              return (api === 'opportunity__property' || api === 'property') && t === 'lookup';
            }
          );
          if (hasPropertyLookup && Array.isArray(obj.fields)) {
            // Remove propertyAddress from the fields array itself
            const fieldsBefore = obj.fields.length;
            obj.fields = obj.fields.filter((f: any) => {
              const api = (f.apiName || '').toLowerCase();
              return api !== 'opportunity__propertyaddress' && api !== 'propertyaddress';
            });
            if (obj.fields.length < fieldsBefore) {
              changed = true;
              fixes.push('removed propertyAddress from Opportunity fields array');
            }
            // Also remove from all layout panels
            for (const layout of obj.pageLayouts || []) {
              for (const tab of layout.tabs || []) {
                for (const region of tab.regions || []) {
                  for (const panel of region.panels || []) {
                    if (Array.isArray(panel.fields)) {
                      const before = panel.fields.length;
                      panel.fields = panel.fields.filter(
                        (f: any) => {
                          const fieldApi = typeof f === 'string' ? f : f?.apiName || f?.fieldApiName;
                          const fLower = (fieldApi || '').toLowerCase();
                          return fLower !== 'opportunity__propertyaddress' && fLower !== 'propertyaddress';
                        }
                      );
                      if (panel.fields.length < before) {
                        changed = true;
                        fixes.push('removed propertyAddress from Opportunity layout');
                      }
                    }
                  }
                }
              }
            }
          }
        }

        // 2. Fix "Opportunies" typo in ALL label locations:
        //    tab.label, region.label, panel.label, and widget.config.label
        for (const layout of obj.pageLayouts || []) {
          for (const tab of layout.tabs || []) {
            // Check tab label
            if (typeof tab.label === 'string' && tab.label.includes('Opportunies')) {
              fixes.push(`typo in tab label (was: "${tab.label}")`);
              tab.label = tab.label.replace(/Opportunies/g, 'Opportunities');
              changed = true;
            }
            for (const region of tab.regions || []) {
              // Check region label
              if (typeof region.label === 'string' && region.label.includes('Opportunies')) {
                fixes.push(`typo in region label (was: "${region.label}")`);
                region.label = region.label.replace(/Opportunies/g, 'Opportunities');
                changed = true;
              }
              for (const panel of region.panels || []) {
                // Check panel label
                if (typeof panel.label === 'string' && panel.label.includes('Opportunies')) {
                  fixes.push(`typo in panel label (was: "${panel.label}")`);
                  panel.label = panel.label.replace(/Opportunies/g, 'Opportunities');
                  changed = true;
                }
              }
            }
          }

          // 3. Fix Related List widget on Property that queries Account instead of Opportunity.
          //    Property has no direct Account relationship — the only RelatedList should
          //    show Opportunities. Fix both objectApiName and relatedObjectApiName, and
          //    ensure linkField is set to "property" for the query to work.
          // Also fix "Opportunies" typo in widget config labels.
          const fixWidgets = (widgets: any[]) => {
            for (const widget of widgets) {
              if (obj.apiName === 'Property' && widget.widgetType === 'RelatedList' && widget.config) {
                // Check both objectApiName and relatedObjectApiName (case-insensitive)
                const objApi = (widget.config.objectApiName || '').toLowerCase();
                const relApi = (widget.config.relatedObjectApiName || '').toLowerCase();
                if (objApi === 'account' || relApi === 'account') {
                  widget.config.objectApiName = 'Opportunity';
                  widget.config.relatedObjectApiName = 'Opportunity';
                  // Ensure linkField is correct for the Opportunity→Property relationship
                  if (!widget.config.linkField) {
                    widget.config.linkField = 'property';
                  }
                  changed = true;
                  fixes.push(`Property RelatedList: Account → Opportunity (objApi="${objApi}", relApi="${relApi}", linkField="${widget.config.linkField}")`);
                }
              }
              // Fix typo in widget config label
              if (typeof widget.config?.label === 'string' && widget.config.label.includes('Opportunies')) {
                const origLabel = widget.config.label;
                widget.config.label = widget.config.label.replace(/Opportunies/g, 'Opportunities');
                changed = true;
                fixes.push(`typo in widget label: "${origLabel}" → "${widget.config.label}"`);
              }
            }
          };
          for (const tab of layout.tabs || []) {
            fixWidgets(tab.widgets || []);
            for (const region of tab.regions || []) {
              fixWidgets(region.widgets || []);
              for (const panel of region.panels || []) {
                fixWidgets(panel.widgets || []);
              }
            }
          }
        }
      }

      if (changed) {
        await prisma.setting.update({
          where: { key: 'orgSchema' },
          data: { value: orgSchema },
        });
        console.log(`[ensure-core-objects] Patched orgSchema: ${fixes.join('; ')}`);
      } else {
        console.log('[ensure-core-objects] orgSchema checked — no patches needed');
      }
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not patch orgSchema:', err);
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
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
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
        min: fieldDef.min ?? null,
        max: fieldDef.max ?? null,
        minLength: fieldDef.minLength ?? null,
        maxLength: fieldDef.maxLength ?? null,
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
