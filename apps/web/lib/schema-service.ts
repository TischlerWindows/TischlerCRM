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
    const opportunityId = generateId();
    const contactId = generateId();
    
    // Create sample Opportunity object
    const opportunityLayout = createDefaultPageLayout('Opportunity');
    opportunityLayout.tabs = [
      {
        id: generateId(),
        label: 'Details',
        sections: [
          {
            id: generateId(),
            label: 'Opportunity Information',
            columns: 2,
            fields: ['Name', 'Amount', 'CloseDate', 'StageName', 'Probability']
          },
          {
            id: generateId(),
            label: 'Description Information',
            columns: 1,
            fields: ['Description']
          }
        ]
      },
      {
        id: generateId(),
        label: 'Additional Information',
        sections: [
          {
            id: generateId(),
            label: 'System Information',
            columns: 2,
            fields: ['CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById']
          }
        ]
      }
    ];

    const opportunityRecordType = createDefaultRecordType('Opportunity', opportunityLayout.id);

    const opportunityObject: ObjectDef = {
      id: opportunityId,
      apiName: 'Opportunity',
      label: 'Opportunity',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: [
        ...SYSTEM_FIELDS,
        {
          id: generateId(),
          apiName: 'Name',
          label: 'Opportunity Name',
          type: 'text',
          required: true,
          maxLength: 120,
          helpText: 'The name of this opportunity'
        },
        {
          id: generateId(),
          apiName: 'Amount',
          label: 'Amount',
          type: 'currency',
          precision: 18,
          scale: 2,
          helpText: 'Expected revenue for this opportunity'
        },
        {
          id: generateId(),
          apiName: 'CloseDate',
          label: 'Close Date',
          type: 'date',
          required: true,
          helpText: 'Date when the opportunity is expected to close'
        },
        {
          id: generateId(),
          apiName: 'StageName',
          label: 'Stage',
          type: 'picklist',
          required: true,
          picklistValues: ['Prospecting', 'Qualification', 'Proposal/Quote', 'Negotiation/Review', 'Closed Won', 'Closed Lost'],
          defaultValue: 'Prospecting',
          helpText: 'Current stage of the opportunity'
        },
        {
          id: generateId(),
          apiName: 'Probability',
          label: 'Probability (%)',
          type: 'percent',
          precision: 3,
          scale: 0,
          helpText: 'Likelihood of closing this opportunity successfully'
        },
        {
          id: generateId(),
          apiName: 'Description',
          label: 'Description',
          type: 'textarea',
          maxLength: 32768,
          helpText: 'Additional details about this opportunity'
        },
        {
          id: generateId(),
          apiName: 'LeadSource',
          label: 'Lead Source',
          type: 'picklist',
          picklistValues: ['Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List', 'Other'],
          helpText: 'Source that generated this opportunity'
        }
      ],
      recordTypes: [opportunityRecordType],
      pageLayouts: [opportunityLayout],
      validationRules: [
        {
          id: generateId(),
          name: 'Amount_Required_For_Negotiation',
          errorMessage: 'Amount is required when stage is Negotiation/Review or later',
          active: true,
          condition: 'StageName IN ["Negotiation/Review", "Closed Won", "Closed Lost"] && Amount == null'
        },
        {
          id: generateId(),
          name: 'Probability_Range_Validation',
          errorMessage: 'Probability must be between 0 and 100',
          active: true,
          condition: 'Probability < 0 || Probability > 100'
        }
      ],
      defaultRecordTypeId: opportunityRecordType.id
    };

    // Create sample Contact object
    const contactLayout = createDefaultPageLayout('Contact');
    contactLayout.tabs = [
      {
        id: generateId(),
        label: 'Details',
        sections: [
          {
            id: generateId(),
            label: 'Name',
            columns: 2,
            fields: ['FirstName', 'LastName', 'Email', 'Phone']
          },
          {
            id: generateId(),
            label: 'Address Information',
            columns: 2,
            fields: ['MailingStreet', 'MailingCity', 'MailingState', 'MailingPostalCode']
          }
        ]
      }
    ];

    const contactRecordType = createDefaultRecordType('Contact', contactLayout.id);

    const contactObject: ObjectDef = {
      id: contactId,
      apiName: 'Contact',
      label: 'Contact',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      fields: [
        ...SYSTEM_FIELDS,
        {
          id: generateId(),
          apiName: 'FirstName',
          label: 'First Name',
          type: 'text',
          maxLength: 40,
          helpText: 'The contact\'s first name'
        },
        {
          id: generateId(),
          apiName: 'LastName',
          label: 'Last Name',
          type: 'text',
          required: true,
          maxLength: 80,
          helpText: 'The contact\'s last name'
        },
        {
          id: generateId(),
          apiName: 'Email',
          label: 'Email',
          type: 'text',
          unique: true,
          maxLength: 80,
          helpText: 'The contact\'s email address'
        },
        {
          id: generateId(),
          apiName: 'Phone',
          label: 'Phone',
          type: 'text',
          maxLength: 40,
          helpText: 'The contact\'s phone number'
        },
        {
          id: generateId(),
          apiName: 'MailingStreet',
          label: 'Mailing Street',
          type: 'textarea',
          maxLength: 255,
          helpText: 'Street address for mailing'
        },
        {
          id: generateId(),
          apiName: 'MailingCity',
          label: 'Mailing City',
          type: 'text',
          maxLength: 40,
          helpText: 'City for mailing address'
        },
        {
          id: generateId(),
          apiName: 'MailingState',
          label: 'Mailing State/Province',
          type: 'text',
          maxLength: 80,
          helpText: 'State or province for mailing address'
        },
        {
          id: generateId(),
          apiName: 'MailingPostalCode',
          label: 'Mailing Zip/Postal Code',
          type: 'text',
          maxLength: 20,
          helpText: 'Postal code for mailing address'
        }
      ],
      recordTypes: [contactRecordType],
      pageLayouts: [contactLayout],
      validationRules: [
        {
          id: generateId(),
          name: 'Email_Format_Validation',
          errorMessage: 'Please enter a valid email address',
          active: true,
          condition: 'Email != null && !Email.includes("@")'
        }
      ],
      defaultRecordTypeId: contactRecordType.id
    };

    return {
      version: 1,
      objects: [opportunityObject, contactObject],
      permissionSets: [
        {
          id: generateId(),
          name: 'Standard User',
          objectPermissions: {
            'Opportunity': { read: true, create: true, edit: true, delete: false },
            'Contact': { read: true, create: true, edit: true, delete: false }
          },
          fieldPermissions: {
            'Opportunity.Amount': { read: true, edit: true },
            'Contact.Email': { read: true, edit: true }
          }
        },
        {
          id: generateId(),
          name: 'System Administrator',
          objectPermissions: {
            'Opportunity': { read: true, create: true, edit: true, delete: true },
            'Contact': { read: true, create: true, edit: true, delete: true }
          },
          fieldPermissions: {
            'Opportunity.Amount': { read: true, edit: true },
            'Contact.Email': { read: true, edit: true }
          }
        }
      ],
      updatedAt: new Date().toISOString()
    };
  }
}

// Export singleton instance
export const schemaService = new LocalStorageSchemaService();