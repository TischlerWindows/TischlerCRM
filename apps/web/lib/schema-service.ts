import { OrgSchema, ObjectDef, generateId, createDefaultPageLayout, createDefaultRecordType, SYSTEM_FIELDS } from './schema';

const STORAGE_KEY = 'tces-object-manager-schema';
const VERSIONS_KEY = 'tces-object-manager-versions';

export interface SchemaService {
  loadSchema(): Promise<OrgSchema>;
  saveSchema(schema: OrgSchema): Promise<void>;
  getVersionHistory(): Promise<OrgSchema[]>;
  rollbackToVersion(version: number): Promise<OrgSchema>;
  exportSchema(schema: OrgSchema): string;
  importSchema(jsonData: string): Promise<OrgSchema>;
  createSampleData(): OrgSchema;
}

class LocalStorageSchemaService implements SchemaService {
  async loadSchema(): Promise<OrgSchema> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse stored schema:', error);
      }
    }
    
    // Return default schema with sample data
    return this.createSampleData();
  }

  async saveSchema(schema: OrgSchema): Promise<void> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    try {
      // Save current schema
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
      
      // Save to version history
      await this.saveToVersionHistory(schema);
    } catch (error) {
      throw new Error('Failed to save schema: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  async getVersionHistory(): Promise<OrgSchema[]> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const stored = localStorage.getItem(VERSIONS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse version history:', error);
      }
    }
    return [];
  }

  async rollbackToVersion(version: number): Promise<OrgSchema> {
    const versions = await this.getVersionHistory();
    const targetVersion = versions.find(v => v.version === version);
    
    if (!targetVersion) {
      throw new Error(`Version ${version} not found`);
    }

    // Create new version with incremented version number
    const rolledBackSchema = {
      ...targetVersion,
      version: Math.max(...versions.map(v => v.version)) + 1,
      updatedAt: new Date().toISOString()
    };

    await this.saveSchema(rolledBackSchema);
    return rolledBackSchema;
  }

  exportSchema(schema: OrgSchema): string {
    return JSON.stringify(schema, null, 2);
  }

  async importSchema(jsonData: string): Promise<OrgSchema> {
    try {
      const parsed = JSON.parse(jsonData);
      
      // Validate basic structure
      if (!parsed.version || !parsed.objects || !Array.isArray(parsed.objects)) {
        throw new Error('Invalid schema format');
      }

      // Assign new IDs to prevent conflicts
      const importedSchema: OrgSchema = {
        ...parsed,
        version: 1,
        updatedAt: new Date().toISOString(),
        objects: parsed.objects.map((obj: any) => ({
          ...obj,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          fields: obj.fields?.map((field: any) => ({
            ...field,
            id: generateId()
          })) || [],
          recordTypes: obj.recordTypes?.map((rt: any) => ({
            ...rt,
            id: generateId()
          })) || [],
          pageLayouts: obj.pageLayouts?.map((layout: any) => ({
            ...layout,
            id: generateId(),
            tabs: layout.tabs?.map((tab: any) => ({
              ...tab,
              id: generateId(),
              sections: tab.sections?.map((section: any) => ({
                ...section,
                id: generateId()
              })) || []
            })) || []
          })) || [],
          validationRules: obj.validationRules?.map((rule: any) => ({
            ...rule,
            id: generateId()
          })) || []
        })),
        permissionSets: parsed.permissionSets?.map((ps: any) => ({
          ...ps,
          id: generateId()
        })) || []
      };

      return importedSchema;
    } catch (error) {
      throw new Error('Failed to parse JSON: ' + (error instanceof Error ? error.message : 'Invalid format'));
    }
  }

  private async saveToVersionHistory(schema: OrgSchema): Promise<void> {
    const versions = await this.getVersionHistory();
    
    // Keep only last 10 versions
    const updatedVersions = [schema, ...versions.slice(0, 9)];
    
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(updatedVersions));
  }

  createSampleData(): OrgSchema {
    const objects: ObjectDef[] = [];
    const now = new Date().toISOString();

    // Helper to create basic object structure
    const createBasicObject = (apiName: string, label: string, pluralLabel: string, description: string, fields: any[]) => {
      const layout = createDefaultPageLayout(apiName);
      const recordType = createDefaultRecordType(apiName, layout.id);
      
      return {
        id: generateId(),
        apiName,
        label,
        pluralLabel,
        description,
        createdAt: now,
        updatedAt: now,
        fields: [...SYSTEM_FIELDS, ...fields],
        recordTypes: [recordType],
        pageLayouts: [layout],
        validationRules: [],
        defaultRecordTypeId: recordType.id
      };
    };

    // 1. Property
    objects.push(createBasicObject(
      'Property',
      'Property',
      'Properties',
      'Physical locations and real estate properties',
      [
        {
          id: generateId(),
          apiName: 'Property__propertyNumber',
          label: 'Property Number',
          type: 'AutoNumber',
          required: true,
          autoNumber: { displayFormat: 'P-{0000}', startingNumber: 1 },
          helpText: 'Auto-generated property identifier'
        },
        {
          id: generateId(),
          apiName: 'Property__address',
          label: 'Address',
          type: 'Text',
          required: true,
          maxLength: 255,
          helpText: 'Street address of the property'
        },
        {
          id: generateId(),
          apiName: 'Property__city',
          label: 'City',
          type: 'Text',
          required: true,
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Property__state',
          label: 'State/Province',
          type: 'Text',
          required: true,
          maxLength: 50
        },
        {
          id: generateId(),
          apiName: 'Property__zipCode',
          label: 'Zip/Postal Code',
          type: 'Text',
          required: true,
          maxLength: 20
        },
        {
          id: generateId(),
          apiName: 'Property__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['Active', 'Inactive'],
          defaultValue: 'Active',
          helpText: 'Properties automatically become Inactive after 8 months of no activity'
        },
        {
          id: generateId(),
          apiName: 'Property__sharepointFolder',
          label: 'SharePoint Folder',
          type: 'Text',
          maxLength: 255,
          helpText: 'Link to SharePoint document folder'
        }
      ]
    ));

    // 2. Contact
    objects.push(createBasicObject(
      'Contact',
      'Contact',
      'Contacts',
      'People and their contact information',
      [
        {
          id: generateId(),
          apiName: 'Contact__firstName',
          label: 'First Name',
          type: 'Text',
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Contact__lastName',
          label: 'Last Name',
          type: 'Text',
          required: true,
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Contact__email',
          label: 'Email',
          type: 'Email',
          unique: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Contact__phone',
          label: 'Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__title',
          label: 'Job Title',
          type: 'Text',
          maxLength: 128
        }
      ]
    ));

    // 3. Account
    objects.push(createBasicObject(
      'Account',
      'Account',
      'Accounts',
      'Companies and organizations',
      [
        {
          id: generateId(),
          apiName: 'Account__accountName',
          label: 'Account Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Account__accountNumber',
          label: 'Account Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'A-{00000}', startingNumber: 10000 }
        },
        {
          id: generateId(),
          apiName: 'Account__accountType',
          label: 'Account Type',
          type: 'Picklist',
          picklistValues: ['General Contractor', 'Sub-Contractor', 'Property Management', 'Developer', 'Consultant', 'Supplier', 'Government', 'Non-Profit', 'Other']
        },
        {
          id: generateId(),
          apiName: 'Account__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['Active', 'Inactive'],
          defaultValue: 'Active'
        },
        {
          id: generateId(),
          apiName: 'Account__website',
          label: 'Website',
          type: 'URL',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Account__primaryEmail',
          label: 'Primary Email',
          type: 'Email',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Account__primaryPhone',
          label: 'Primary Phone',
          type: 'Phone',
          maxLength: 40
        }
      ]
    ));

    // 4. Product
    objects.push(createBasicObject(
      'Product',
      'Product',
      'Products',
      'Products and services offered',
      [
        {
          id: generateId(),
          apiName: 'Product__productName',
          label: 'Product Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Product__productCode',
          label: 'Product Code',
          type: 'Text',
          unique: true,
          maxLength: 50
        },
        {
          id: generateId(),
          apiName: 'Product__category',
          label: 'Category',
          type: 'Picklist',
          picklistValues: ['Service', 'Equipment', 'Material', 'Labor', 'Other']
        },
        {
          id: generateId(),
          apiName: 'Product__unitPrice',
          label: 'Unit Price',
          type: 'Currency',
          precision: 18,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Product__isActive',
          label: 'Active',
          type: 'Checkbox',
          defaultValue: true
        },
        {
          id: generateId(),
          apiName: 'Product__description',
          label: 'Description',
          type: 'TextArea',
          maxLength: 2000
        }
      ]
    ));

    // 5. Lead
    objects.push(createBasicObject(
      'Lead',
      'Lead',
      'Leads',
      'Potential customers and opportunities',
      [
        {
          id: generateId(),
          apiName: 'Lead__firstName',
          label: 'First Name',
          type: 'Text',
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Lead__lastName',
          label: 'Last Name',
          type: 'Text',
          required: true,
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Lead__company',
          label: 'Company',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__email',
          label: 'Email',
          type: 'Email',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__phone',
          label: 'Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Lead__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['New', 'Contacted', 'Qualified', 'Unqualified', 'Converted'],
          defaultValue: 'New'
        },
        {
          id: generateId(),
          apiName: 'Lead__leadSource',
          label: 'Lead Source',
          type: 'Picklist',
          picklistValues: ['Web', 'Phone', 'Referral', 'Event', 'Partner', 'Other']
        }
      ]
    ));

    // 6. Deal
    objects.push(createBasicObject(
      'Deal',
      'Deal',
      'Deals',
      'Sales opportunities and deals',
      [
        {
          id: generateId(),
          apiName: 'Deal__dealName',
          label: 'Deal Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Deal__amount',
          label: 'Amount',
          type: 'Currency',
          precision: 18,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Deal__closeDate',
          label: 'Expected Close Date',
          type: 'Date',
          required: true
        },
        {
          id: generateId(),
          apiName: 'Deal__stage',
          label: 'Stage',
          type: 'Picklist',
          required: true,
          picklistValues: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
          defaultValue: 'Prospecting'
        },
        {
          id: generateId(),
          apiName: 'Deal__probability',
          label: 'Probability (%)',
          type: 'Percent',
          precision: 3,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Deal__description',
          label: 'Description',
          type: 'TextArea',
          maxLength: 5000
        }
      ]
    ));

    // 7. Project
    objects.push(createBasicObject(
      'Project',
      'Project',
      'Projects',
      'Construction and service projects',
      [
        {
          id: generateId(),
          apiName: 'Project__projectName',
          label: 'Project Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Project__projectNumber',
          label: 'Project Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'PRJ-{0000}', startingNumber: 1 }
        },
        {
          id: generateId(),
          apiName: 'Project__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled'],
          defaultValue: 'Planning'
        },
        {
          id: generateId(),
          apiName: 'Project__startDate',
          label: 'Start Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Project__endDate',
          label: 'End Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Project__budget',
          label: 'Budget',
          type: 'Currency',
          precision: 18,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Project__description',
          label: 'Description',
          type: 'LongTextArea',
          maxLength: 10000
        }
      ]
    ));

    // 8. Service
    objects.push(createBasicObject(
      'Service',
      'Service',
      'Services',
      'Service requests and work orders',
      [
        {
          id: generateId(),
          apiName: 'Service__serviceNumber',
          label: 'Service Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'SRV-{00000}', startingNumber: 1 }
        },
        {
          id: generateId(),
          apiName: 'Service__subject',
          label: 'Subject',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Service__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['New', 'In Progress', 'On Hold', 'Resolved', 'Closed'],
          defaultValue: 'New'
        },
        {
          id: generateId(),
          apiName: 'Service__priority',
          label: 'Priority',
          type: 'Picklist',
          picklistValues: ['Low', 'Medium', 'High', 'Urgent'],
          defaultValue: 'Medium'
        },
        {
          id: generateId(),
          apiName: 'Service__description',
          label: 'Description',
          type: 'LongTextArea',
          maxLength: 10000
        },
        {
          id: generateId(),
          apiName: 'Service__scheduledDate',
          label: 'Scheduled Date',
          type: 'DateTime'
        }
      ]
    ));

    // 9. Quote
    objects.push(createBasicObject(
      'Quote',
      'Quote',
      'Quotes',
      'Price quotes and estimates',
      [
        {
          id: generateId(),
          apiName: 'Quote__quoteNumber',
          label: 'Quote Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'Q-{00000}', startingNumber: 1 }
        },
        {
          id: generateId(),
          apiName: 'Quote__quoteName',
          label: 'Quote Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Quote__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['Draft', 'Pending', 'Approved', 'Rejected', 'Accepted'],
          defaultValue: 'Draft'
        },
        {
          id: generateId(),
          apiName: 'Quote__totalAmount',
          label: 'Total Amount',
          type: 'Currency',
          precision: 18,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Quote__validUntil',
          label: 'Valid Until',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Quote__description',
          label: 'Description',
          type: 'TextArea',
          maxLength: 5000
        }
      ]
    ));

    // 10. Installation
    objects.push(createBasicObject(
      'Installation',
      'Installation',
      'Installations',
      'Equipment and system installations',
      [
        {
          id: generateId(),
          apiName: 'Installation__installationNumber',
          label: 'Installation Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'INST-{0000}', startingNumber: 1 }
        },
        {
          id: generateId(),
          apiName: 'Installation__installationName',
          label: 'Installation Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Installation__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['Scheduled', 'In Progress', 'Completed', 'Cancelled', 'Failed'],
          defaultValue: 'Scheduled'
        },
        {
          id: generateId(),
          apiName: 'Installation__scheduledDate',
          label: 'Scheduled Date',
          type: 'DateTime'
        },
        {
          id: generateId(),
          apiName: 'Installation__completedDate',
          label: 'Completed Date',
          type: 'DateTime'
        },
        {
          id: generateId(),
          apiName: 'Installation__technician',
          label: 'Technician',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Installation__notes',
          label: 'Installation Notes',
          type: 'LongTextArea',
          maxLength: 10000
        }
      ]
    ));

    // Create permission sets for all objects
    const allObjectPermissions: Record<string, any> = {};
    objects.forEach(obj => {
      allObjectPermissions[obj.apiName] = { read: true, create: true, edit: true, delete: false };
    });

    return {
      version: 1,
      objects,
      permissionSets: [
        {
          id: generateId(),
          name: 'Standard User',
          objectPermissions: allObjectPermissions,
          fieldPermissions: {}
        },
        {
          id: generateId(),
          name: 'System Administrator',
          objectPermissions: Object.keys(allObjectPermissions).reduce((acc, key) => {
            acc[key] = { read: true, create: true, edit: true, delete: true };
            return acc;
          }, {} as Record<string, any>),
          fieldPermissions: {}
        }
      ],
      updatedAt: now
    };
  }
}

// Export singleton instance
export const schemaService = new LocalStorageSchemaService();