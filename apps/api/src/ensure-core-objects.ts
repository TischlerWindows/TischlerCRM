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
      // Existing fields (ensureFields will skip these)
      { apiName: 'workOrderNumber', label: 'Work Order Number', type: 'Text', unique: true },
      { apiName: 'name', label: 'Work Order', type: 'Text' },
      { apiName: 'title', label: 'Title', type: 'TextArea' },
      { apiName: 'workOrderType', label: 'Work Order Type', type: 'Picklist', picklistValues: ['Installation', 'Repair', 'Maintenance', 'Inspection', 'Warranty', 'Punch List', 'Other'], defaultValue: 'Repair' },
      { apiName: 'scheduledStartDate', label: 'Scheduled Start Date', type: 'Date' },
      { apiName: 'scheduledEndDate', label: 'Scheduled End Date', type: 'Date' },
      { apiName: 'estimateCost', label: 'Estimate Cost', type: 'Currency' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
      // New fields
      { apiName: 'workOrderCategory', label: 'Category', type: 'Picklist', picklistValues: ['Client Service', 'Internal'], defaultValue: 'Client Service' },
      { apiName: 'workOrderStatus', label: 'Work Order Status', type: 'Picklist', picklistValues: ['Scheduled', 'In Progress', 'Completed', 'Closed'], defaultValue: 'Scheduled' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'leadTech', label: 'Lead Tech', type: 'Lookup' },
      { apiName: 'workDescription', label: 'Work Description', type: 'LongTextArea' },
      { apiName: 'toolsNeeded', label: 'Tools Needed', type: 'LongTextArea' },
      { apiName: 'outsideContractors', label: 'Outside Contractors', type: 'LongTextArea' },
      { apiName: 'completedDate', label: 'Completed Date', type: 'DateTime' },
      { apiName: 'completedBy', label: 'Completed By', type: 'Lookup' },
      { apiName: 'closedDate', label: 'Closed Date', type: 'DateTime' },
      { apiName: 'closedBy', label: 'Closed By', type: 'Lookup' },
      { apiName: 'customerSignature', label: 'Customer Signature', type: 'Text' },
      { apiName: 'signatureDate', label: 'Signature Date', type: 'Date' },
      { apiName: 'invoiceNumber', label: 'Invoice Number', type: 'Text' },
      { apiName: 'totalEstimatedHours', label: 'Total Estimated Hours', type: 'Number' },
      { apiName: 'totalActualHours', label: 'Total Actual Hours', type: 'Number' },
      { apiName: 'totalLaborCost', label: 'Total Labor Cost', type: 'Currency' },
      { apiName: 'totalExpenses', label: 'Total Expenses', type: 'Currency' },
      { apiName: 'totalJobCost', label: 'Total Job Cost', type: 'Currency' },
    ],
  },
  {
    apiName: 'TeamMember',
    label: 'Team Member',
    pluralLabel: 'Team Members',
    description: 'Junction object linking contacts and accounts to properties, opportunities, projects, work orders, and installations',
    fields: [
      { apiName: 'teamMemberNumber', label: 'Team Member Number', type: 'Text', unique: true },
      { apiName: 'contact', label: 'Contact', type: 'Lookup' },
      { apiName: 'account', label: 'Account', type: 'Lookup' },
      { apiName: 'property', label: 'Property', type: 'Lookup' },
      { apiName: 'opportunity', label: 'Opportunity', type: 'Lookup' },
      { apiName: 'project', label: 'Project', type: 'Lookup' },
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup' },
      { apiName: 'installation', label: 'Installation', type: 'Lookup' },
      { apiName: 'role', label: 'Role', type: 'Picklist', required: true, picklistValues: ['Homeowner', 'General Contractor', 'Subcontractor', 'Architect / Designer', 'Property Manager', 'Sales Rep', 'Installer', 'Inspector', 'Engineer', 'Other'] },
      { apiName: 'primaryContact', label: 'Primary Contact', type: 'Checkbox' },
      { apiName: 'contractHolder', label: 'Contract Holder', type: 'Checkbox' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
  {
    apiName: 'Technician',
    label: 'Technician',
    pluralLabel: 'Technicians',
    description: 'Service and installation technicians',
    fields: [
      { apiName: 'technicianName', label: 'Technician Name', type: 'Text', required: true },
      { apiName: 'techCode', label: 'Tech Code', type: 'Text', unique: true },
      { apiName: 'departmentTags', label: 'Department Tags', type: 'MultiPicklist', picklistValues: ['Install', 'Service'] },
      { apiName: 'hourlyRate', label: 'Hourly Rate', type: 'Currency', required: true },
      { apiName: 'overtimeRate', label: 'Overtime Rate', type: 'Currency' },
      { apiName: 'phone', label: 'Phone', type: 'Phone' },
      { apiName: 'email', label: 'Email', type: 'Email' },
      { apiName: 'skills', label: 'Skills', type: 'MultiPicklist', picklistValues: ['Glazing', 'Framing', 'Electrical', 'Plumbing', 'General'] },
      { apiName: 'user', label: 'User', type: 'Lookup' },
      { apiName: 'active', label: 'Active', type: 'Checkbox', defaultValue: 'true' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Active', 'Inactive'], defaultValue: 'Active' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
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
  {
    apiName: 'WorkOrderAssignment',
    label: 'Work Order Assignment',
    pluralLabel: 'Work Order Assignments',
    description: 'Junction linking technicians to work orders',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'isLead', label: 'Lead Tech', type: 'Checkbox' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
      { apiName: 'notified', label: 'Notified', type: 'Checkbox' },
      { apiName: 'notifiedDate', label: 'Notified Date', type: 'DateTime' },
    ],
  },
  {
    apiName: 'PunchListItem',
    label: 'Punch List Item',
    pluralLabel: 'Punch List Items',
    description: 'Work items within a work order',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'itemNumber', label: 'Item Number', type: 'Number' },
      { apiName: 'location', label: 'Location', type: 'Text' },
      { apiName: 'description', label: 'Description', type: 'LongTextArea' },
      { apiName: 'assignedTech', label: 'Assigned Tech', type: 'Lookup' },
      { apiName: 'status', label: 'Status', type: 'Picklist', picklistValues: ['Open', 'In Progress', 'Completed', 'N/A'], defaultValue: 'Open' },
      { apiName: 'estimatedHours', label: 'Estimated Hours', type: 'Number' },
      { apiName: 'estimatedMen', label: 'Estimated Men', type: 'Number' },
      { apiName: 'materialsInWarehouse', label: 'Materials in Warehouse', type: 'LongTextArea' },
      { apiName: 'materialsToOrder', label: 'Materials to Order', type: 'LongTextArea' },
      { apiName: 'specialEquipment', label: 'Special Equipment', type: 'LongTextArea' },
      { apiName: 'elevationPage', label: 'Elevation Page', type: 'Text' },
      { apiName: 'serviceDate', label: 'Service Date', type: 'Date' },
    ],
  },
  {
    apiName: 'TimeEntry',
    label: 'Time Entry',
    pluralLabel: 'Time Entries',
    description: 'Hours tracking per technician per work order',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'date', label: 'Date', type: 'Date', required: true },
      { apiName: 'workHours', label: 'Work Hours', type: 'Number' },
      { apiName: 'travelHours', label: 'Travel Hours', type: 'Number' },
      { apiName: 'prepHours', label: 'Prep Hours', type: 'Number' },
      { apiName: 'miscHours', label: 'Misc Hours', type: 'Number' },
      { apiName: 'totalHours', label: 'Total Hours', type: 'Number' },
      { apiName: 'rateAtEntry', label: 'Rate at Entry', type: 'Currency' },
      { apiName: 'totalCost', label: 'Total Cost', type: 'Currency' },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
    ],
  },
  {
    apiName: 'WorkOrderExpense',
    label: 'Work Order Expense',
    pluralLabel: 'Work Order Expenses',
    description: 'Per diem, mileage, materials, and other job expenses',
    fields: [
      { apiName: 'workOrder', label: 'Work Order', type: 'Lookup', required: true },
      { apiName: 'technician', label: 'Technician', type: 'Lookup' },
      { apiName: 'expenseType', label: 'Expense Type', type: 'Picklist', picklistValues: ['Per Diem', 'Mileage', 'Materials', 'Equipment', 'Other'], required: true },
      { apiName: 'amount', label: 'Amount', type: 'Currency', required: true },
      { apiName: 'quantity', label: 'Quantity', type: 'Number' },
      { apiName: 'rate', label: 'Rate', type: 'Currency' },
      { apiName: 'date', label: 'Date', type: 'Date', required: true },
      { apiName: 'description', label: 'Description', type: 'Text' },
    ],
  },
  {
    apiName: 'TechnicianRateHistory',
    label: 'Technician Rate History',
    pluralLabel: 'Technician Rate History',
    description: 'Audit trail for technician rate changes',
    fields: [
      { apiName: 'technician', label: 'Technician', type: 'Lookup', required: true },
      { apiName: 'effectiveDate', label: 'Effective Date', type: 'Date', required: true },
      { apiName: 'previousRate', label: 'Previous Rate', type: 'Currency', required: true },
      { apiName: 'newRate', label: 'New Rate', type: 'Currency', required: true },
      { apiName: 'rateType', label: 'Rate Type', type: 'Picklist', picklistValues: ['Hourly', 'Overtime'], required: true },
      { apiName: 'notes', label: 'Notes', type: 'LongTextArea' },
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

  // NOTE: Temporarily disabled — the existing frontend Setting blob stores
  // field apiNames with the "ObjectName__" prefix (e.g. "Technician__techCode"),
  // but CORE_OBJECTS uses bare names (e.g. "techCode"). The old function's
  // simple equality check did not match across the two formats, causing
  // duplicate fields to be appended to every existing object. New objects
  // are still created in the DB by the ensureFields() path above, and are
  // exposed to the UI via the object manager's own CustomObject/CustomField
  // queries. Fixing the sync properly requires name-matching logic that
  // understands the prefix convention.
  // await syncCoreObjectsToSchemaSetting();

  // One-time cleanup: remove any fields that the previous broken version of
  // syncCoreObjectsToSchemaSetting() appended to the schema Setting blob.
  // Those fields have ids starting with "core-". Safe to call every startup.
  await removeCoreSyncPollution();

  // ── Service Department & Profiles ──────────────────────────────────
  // Ensure Service department exists
  const existingDept = await prisma.department.findFirst({
    where: { name: { equals: 'Service', mode: 'insensitive' } },
  })
  if (!existingDept) {
    await prisma.department.create({
      data: {
        id: generateId('Department'),
        name: 'Service',
        description: 'Service Department — technicians and managers',
      },
    })
    console.log('[ensure-core-objects] Created Service department')
  }

  // Ensure Service Manager profile exists
  const existingMgrProfile = await prisma.profile.findFirst({
    where: { name: { equals: 'Service Manager', mode: 'insensitive' } },
  })
  if (!existingMgrProfile) {
    await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: 'Service Manager',
        label: 'Service Manager',
        description: 'Full access to service module objects and features',
        permissions: JSON.stringify({
          objectPermissions: {},
          appPermissions: {},
        }),
      },
    })
    console.log('[ensure-core-objects] Created Service Manager profile')
  }

  // Ensure Service Technician profile exists
  const existingTechProfile = await prisma.profile.findFirst({
    where: { name: { equals: 'Service Technician', mode: 'insensitive' } },
  })
  if (!existingTechProfile) {
    await prisma.profile.create({
      data: {
        id: generateId('Profile'),
        name: 'Service Technician',
        label: 'Service Technician',
        description: 'Graduated access for service technicians — starts restricted',
        permissions: JSON.stringify({
          objectPermissions: {},
          appPermissions: {},
        }),
      },
    })
    console.log('[ensure-core-objects] Created Service Technician profile')
  }
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

/**
 * Clean up schema-Setting corruption. Removes:
 *   1. Fields/objects with id starting with "core-" (added by the previous
 *      broken version of syncCoreObjectsToSchemaSetting).
 *   2. Any null/undefined entries in the objects array or in any object's
 *      fields array — these cause `field.type` TypeErrors in the frontend
 *      when it maps over fields.
 *   3. Any fields missing a `type` or `apiName` — invalid by definition;
 *      the frontend's field renderer switch on `field.type` chokes on them.
 *
 * Idempotent and safe to call every startup.
 */
async function removeCoreSyncPollution(): Promise<void> {
  const SETTING_KEY = 'tces-object-manager-schema';
  try {
    const existing = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!existing || !existing.value) return;

    const schema = existing.value as any;
    if (!Array.isArray(schema.objects)) return;

    let removedFields = 0;
    let removedObjects = 0;

    // Sanitize each object's fields array
    for (const obj of schema.objects) {
      if (!obj || !Array.isArray(obj.fields)) continue;
      const before = obj.fields.length;
      obj.fields = obj.fields.filter((f: any) => {
        if (!f || typeof f !== 'object') return false;
        // Drop fields added by the broken sync
        if (typeof f.id === 'string' && f.id.startsWith('core-')) return false;
        // Drop fields without required shape — these cause frontend TypeErrors
        if (typeof f.apiName !== 'string' || !f.apiName) return false;
        if (typeof f.type !== 'string' || !f.type) return false;
        return true;
      });
      removedFields += before - obj.fields.length;
    }

    // Sanitize the objects array itself
    const beforeCount = schema.objects.length;
    schema.objects = schema.objects.filter((o: any) => {
      if (!o || typeof o !== 'object') return false;
      if (typeof o.id === 'string' && o.id.startsWith('core-')) return false;
      if (typeof o.apiName !== 'string' || !o.apiName) return false;
      return true;
    });
    removedObjects = beforeCount - schema.objects.length;

    if (removedFields > 0 || removedObjects > 0) {
      schema.version = (Number(schema.version) || 0) + 1;
      schema.updatedAt = new Date().toISOString();
      await prisma.setting.update({
        where: { key: SETTING_KEY },
        data: { value: schema as any },
      });
      console.log(
        `[ensure-core-objects] Cleaned up schema pollution: -${removedObjects} objects, -${removedFields} fields`
      );
    }
  } catch (err) {
    console.warn('[ensure-core-objects] Could not clean up schema pollution:', err);
  }
}

/**
 * Sync CORE_OBJECTS to the frontend schema Setting blob
 * (key: 'tces-object-manager-schema').
 *
 * The frontend loads its schema from this Setting, NOT directly from the
 * CustomObject / CustomField tables. Without this sync, new core objects
 * defined in this file do not appear in the Object Manager UI even though
 * they exist in the database.
 *
 * This function is additive and idempotent:
 * - If the Setting does not exist, creates it with all CORE_OBJECTS.
 * - If an object is missing from the Setting, adds it with all its fields.
 * - If an object exists but is missing fields, adds the missing fields.
 * - Never removes or modifies existing objects/fields (UI edits win).
 */
async function syncCoreObjectsToSchemaSetting(): Promise<void> {
  const SETTING_KEY = 'tces-object-manager-schema';
  try {
    const existing = await prisma.setting.findUnique({ where: { key: SETTING_KEY } });
    const now = new Date().toISOString();

    // Build a core-object representation in the shape the frontend expects.
    const buildCoreObject = (def: typeof CORE_OBJECTS[number]) => ({
      id: `core-${def.apiName}`,
      apiName: def.apiName,
      label: def.label,
      pluralLabel: def.pluralLabel,
      description: def.description,
      fields: def.fields.map((f) => ({
        id: `core-${def.apiName}-${f.apiName}`,
        apiName: f.apiName,
        label: f.label,
        type: f.type,
        required: (f as any).required ?? false,
        unique: (f as any).unique ?? false,
        picklistValues: (f as any).picklistValues,
        defaultValue: (f as any).defaultValue,
        custom: false,
      })),
      recordTypes: [],
      pageLayouts: [],
      validationRules: [],
    });

    if (!existing || !existing.value) {
      // No schema yet — seed it with all core objects.
      const schema = {
        version: 1,
        objects: CORE_OBJECTS.map(buildCoreObject),
        updatedAt: now,
      };
      await prisma.setting.create({
        data: { key: SETTING_KEY, value: schema as any },
      });
      console.log(`[ensure-core-objects] Seeded '${SETTING_KEY}' with ${CORE_OBJECTS.length} core objects`);
      return;
    }

    const schema = existing.value as any;
    const objects: any[] = Array.isArray(schema.objects) ? schema.objects : [];
    let addedObjects = 0;
    let addedFields = 0;

    for (const def of CORE_OBJECTS) {
      const idx = objects.findIndex(
        (o) => o && typeof o.apiName === 'string' && o.apiName.toLowerCase() === def.apiName.toLowerCase()
      );
      if (idx === -1) {
        objects.push(buildCoreObject(def));
        addedObjects++;
        continue;
      }
      // Object exists — merge any new fields without touching existing ones.
      const obj = objects[idx];
      if (!Array.isArray(obj.fields)) obj.fields = [];
      for (const f of def.fields) {
        const hasField = obj.fields.some(
          (ef: any) => ef && typeof ef.apiName === 'string' && ef.apiName === f.apiName
        );
        if (!hasField) {
          obj.fields.push({
            id: `core-${def.apiName}-${f.apiName}`,
            apiName: f.apiName,
            label: f.label,
            type: f.type,
            required: (f as any).required ?? false,
            unique: (f as any).unique ?? false,
            picklistValues: (f as any).picklistValues,
            defaultValue: (f as any).defaultValue,
            custom: false,
          });
          addedFields++;
        }
      }
    }

    if (addedObjects > 0 || addedFields > 0) {
      schema.objects = objects;
      schema.version = (Number(schema.version) || 0) + 1;
      schema.updatedAt = now;
      await prisma.setting.update({
        where: { key: SETTING_KEY },
        data: { value: schema as any },
      });
      console.log(
        `[ensure-core-objects] Updated '${SETTING_KEY}': +${addedObjects} objects, +${addedFields} fields`
      );
    }
  } catch (err) {
    console.warn(`[ensure-core-objects] Could not sync core objects to schema setting:`, err);
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
