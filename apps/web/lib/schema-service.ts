import { OrgSchema, ObjectDef, FieldDef, generateId, createDefaultPageLayout, createDefaultRecordType, SYSTEM_FIELDS } from './schema';

const STORAGE_KEY = 'tces-object-manager-schema';
const VERSIONS_KEY = 'tces-object-manager-versions';

const PROPERTY_WOOD_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Personal Information',
    columns: 2,
    fields: [
      'Opportunity Name',
      'Opportunity Owner',
      'Architect Firm',
      'Account Name',
      'Architect',
      'Who is this Quoted to?',
      'Contractor Company',
      'Who is it quoted to information',
      'Contractor',
      'Secondary Contact',
      'When is Product Required Onsite?',
      'Is this a Shared Opportunity',
      'Salesman to Share'
    ]
  },
  {
    label: 'Opportunity Information',
    columns: 2,
    fields: [
      'Opportunity Number',
      'Close Date',
      'Quote Due',
      'Quote Budget',
      'Project Addresses',
      'Stage',
      'Plans Dated',
      'Amount',
      'Korn Priority',
      'Salesman Probability',
      'Competitors'
    ]
  },
  {
    label: 'Estimating Information',
    columns: 2,
    fields: [
      'Estimators',
      'Estimating Starting/Last worked on Date',
      'Priority/Next job',
      'Estimating Current Status'
    ]
  },
  {
    label: 'Opportunity Information',
    columns: 2,
    fields: [
      'Quote Spec',
      'Site Measurements',
      'New Construction',
      'High Altitude',
      'Renovation',
      'Product Specifications',
      'Waterfront Exposure',
      'Delivery Requirements',
      'Reference For unit Dimensions',
      'Delivery Req Notes',
      'Wind Load Speed MPH',
      'Click Link to Find Wind Speed'
    ]
  },
  {
    label: 'Wood & Glass Questions',
    columns: 2,
    fields: [
      'Wood Type',
      'Glass Type',
      'Finish Specifications',
      'Alternative Glass',
      'Wood Notes',
      'Glass Notes',
      'Final Finish',
      'Spacer Bars'
    ]
  },
  {
    label: 'Hardware Questions',
    columns: 2,
    fields: [
      'Window Hardware',
      'Hardware Finish Notes',
      'Hinge Finish Specification',
      'Finials',
      'Finial Type',
      'Security'
    ]
  },
  {
    label: 'Windows',
    columns: 2,
    fields: [
      'Window Options',
      'Fixed Options',
      'Window Option Notes',
      'Single, Double, & Triple Hung Windows',
      'Single/Double Hung Notes',
      'Sill',
      'Sill Notes'
    ]
  },
  {
    label: 'Doors',
    columns: 2,
    fields: [
      'Door Options',
      'Inswing Doors Threshold',
      'Outswing Doors Threshold',
      'Lift and slide doors Striker Bolts',
      'Door Option Notes',
      'Entry Door'
    ]
  },
  {
    label: 'Accessories and Add-ons',
    columns: 2,
    fields: [
      'Rollscreens',
      'Roll Screen Location',
      'Screens',
      'Screen location',
      'Mesh Type',
      'Roll Shades',
      'Shades Location',
      'Product Options',
      'Product Option Locations',
      'Wood Exterior Trim and Casing'
    ]
  },
  {
    label: 'Installation',
    columns: 2,
    fields: [
      'Installation',
      'Required Installation Scope/Notes'
    ]
  },
  {
    label: 'Notes',
    columns: 1,
    fields: [
      'NOTES',
      'Korn Meeting Notes'
    ]
  },
  {
    label: 'Revised Quote',
    columns: 2,
    fields: [
      'Revised Quote',
      'Revision Date',
      'Revision due date',
      'Revision Notes'
    ]
  },
  {
    label: 'Loss Reason',
    columns: 2,
    fields: [
      'Loss Reason',
      'Loss Reason Notes'
    ]
  },
  {
    label: 'Estimating Start and end date',
    columns: 2,
    fields: [
      'Date Started',
      'Date Finished',
      'Revision Date Started',
      'Revision Date Finished',
      'Revision Date Started (2)',
      'Revision Date Finished (2)',
      'Revision Date Started (3)',
      'Revision Date Finished (3)',
      'Revision Date Started (4)',
      'Revision Date Finished (4)',
      'Revision Date Started (5)',
      'Revision Date Finished (5)',
      'Revision Date Started (6)',
      'Revision Date Finished (6)',
      'Revision Date Started (7)',
      'Revision Date Finished (7)'
    ]
  },
  {
    label: 'System Information',
    columns: 2,
    fields: [
      'Created By',
      'Last Modified By',
      'Create a Project',
      'Probability (%)',
      'Project'
    ]
  }
];

const CONTACT_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Contact Information',
    columns: 2,
    fields: [
      'Name',
      'Account Name',
      'Contact type',
      'Reports To',
      'Email',
      'Secondary E-Mail',
      'Mobile',
      'Fax',
      'Phone',
      'Other Phone'
    ]
  },
  {
    label: 'Address Information',
    columns: 2,
    fields: [
      'Mailing Address',
      'Other Address',
      'PO Box'
    ]
  },
  {
    label: 'Additional Information',
    columns: 1,
    fields: []
  },
  {
    label: 'Description Information',
    columns: 1,
    fields: [
      'General Notes'
    ]
  },
  {
    label: 'System Information',
    columns: 2,
    fields: [
      'Created By',
      'Last Modified By',
      'Contact Owner'
    ]
  },
  {
    label: 'Custom Links',
    columns: 2,
    fields: [
      'Google Maps',
      'Google Search'
    ]
  }
];

const ACCOUNT_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Account Information',
    columns: 2,
    fields: [
      'Account Name',
      'Parent Account',
      'Account #',
      'Phone',
      'Account Type',
      'Email',
      'Description',
      'Website'
    ]
  },
  {
    label: 'Address Information',
    columns: 2,
    fields: [
      'Shipping Address',
      'Billing Address'
    ]
  },
  {
    label: 'System Information',
    columns: 2,
    fields: [
      'Created By',
      'Last Modified By'
    ]
  },
  {
    label: 'Custom Links',
    columns: 2,
    fields: [
      'Google Maps',
      'Google News',
      'Google Search'
    ]
  }
];

const PRODUCT_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Product Information',
    columns: 2,
    fields: [
      'Product Name',
      'Product Family',
      'Product Code',
      'Active',
      'Product Currency'
    ]
  },
  {
    label: 'Description Information',
    columns: 1,
    fields: [
      'Product Description'
    ]
  },
  {
    label: 'System Information',
    columns: 2,
    fields: [
      'Created By',
      'Last Modified By'
    ]
  }
];

const LEAD_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Lead Information',
    columns: 2,
    fields: [
      'Lead Status',
      'Lead Type',
      'Lead Owner',
      'Lead Source',
      'Competitors',
      'Close Date',
      'Confidence Level',
      'Type of Sale',
      'Single Sales Objective'
    ]
  },
  {
    label: 'Contact Information',
    columns: 2,
    fields: [
      'Name',
      'Account',
      'Primary Email',
      'Secondary Email',
      'Primary Phone',
      'Secondary Phone',
      'Property Address'
    ]
  },
  {
    label: 'Buying Influences',
    columns: 2,
    fields: [
      'Role',
      'Mode',
      'Rating',
      'Degrees of Influence',
      'Buying Influence',
      'Base Coverage'
    ]
  },
  {
    label: 'Summary',
    columns: 1,
    fields: [
      'Summary of Position: Strengths',
      'Summary of Position: Red Flags',
      'Actions',
      'Lead Notes'
    ]
  },
  {
    label: 'Sharepoint Files',
    columns: 1,
    fields: [
      'Sharepoint Files'
    ]
  },
  {
    label: 'System Information',
    columns: 2,
    fields: [
      'Created By',
      'Last Modified By',
      'Lead Number'
    ]
  }
];

const DEAL_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Contact Information',
    columns: 2,
    fields: [
      'Deal Name',
      'Architect Firm',
      'Architect',
      'Contractor Company',
      'Contractor',
      'Quote Account',
      'Quote Contact',
      'Quote Email',
      'Quote Phone',
      'Secondary Quote Phone',
      'Deal Owner'
    ]
  },
  {
    label: 'Deal Information',
    columns: 2,
    fields: [
      'Deal Number',
      'Property Address',
      'Estimated Contract Date',
      'Product Required Onsite',
      'Quote Due',
      'Stage',
      'Competitors',
      'Probability',
      'Amount',
      'Quote Budget',
      'Plans Dated',
      'Shared Opportunity',
      'Deal Notes',
      'Korn Priority'
    ]
  },
  {
    label: 'Estimating Information',
    columns: 2,
    fields: [
      'Estimators',
      'Status',
      'Priority/Next Job',
      'Estimating Notes'
    ]
  },
  {
    label: 'Quote Specifications',
    columns: 2,
    fields: [
      'Site Measurements',
      'High Altitude',
      'New Construction',
      'Renovation',
      'Waterfront Exposure',
      'Product Specifications',
      'Delivery Requirements',
      'Delivery Notes',
      'Reference for Unit Dimensions',
      'Wind Load Speed MPH',
      'Wind Speed Reference'
    ]
  },
  {
    label: 'Product Specifications',
    columns: 2,
    fields: [
      'Wood Type',
      'Finish Specifications',
      'Wood Notes',
      'Final Finish',
      'Glass Type',
      'Alternative Glass',
      'Glass Notes',
      'Spacer Bars',
      'Window Hardware',
      'Hardware Finish Notes',
      'Hinge Finish Specification',
      'Finials',
      'Finial Type',
      'Security'
    ]
  },
  {
    label: 'Windows',
    columns: 2,
    fields: [
      'Window Type',
      'Fixed Options',
      'Window Type Notes',
      'Single, Double & Triple Hung Windows',
      'Single/Double Hung Notes',
      'Sill',
      'Sill Notes'
    ]
  },
  {
    label: 'Doors',
    columns: 2,
    fields: [
      'Door Options',
      'Inswing Door Threshold',
      'Outswing Door Threshold',
      'Lift and Slide Doors Striker Bolts',
      'Door Option Notes',
      'Entry Door'
    ]
  },
  {
    label: 'Accessories and Add-ons',
    columns: 2,
    fields: [
      'Roll Screens',
      'Roll Screen Location',
      'Screens',
      'Screen Location',
      'Mesh Type',
      'Roll Shades',
      'Shades Location',
      'Add-on Products',
      'Add-on Locations',
      'Wood Exterior Trim and Casing'
    ]
  },
  {
    label: 'Installation',
    columns: 2,
    fields: [
      'Installation',
      'Required Installation Scope/Notes'
    ]
  },
  {
    label: 'Revisions',
    columns: 2,
    fields: [
      'Start Date',
      'Finish Date',
      'Revision'
    ]
  },
  {
    label: 'General Notes',
    columns: 1,
    fields: [
      'General Notes',
      'Korn Notes',
      'Loss Reason',
      'Loss Notes'
    ]
  },
  {
    label: 'System Information',
    columns: 2,
    fields: [
      'Created By',
      'Last Modified By'
    ]
  }
];

export interface SchemaService {
  loadSchema(): Promise<OrgSchema>;
  saveSchema(schema: OrgSchema): Promise<void>;
  getVersionHistory(): Promise<OrgSchema[]>;
  rollbackToVersion(version: number): Promise<OrgSchema>;
  exportSchema(schema: OrgSchema): string;
  importSchema(jsonData: string): Promise<OrgSchema>;
  createSampleData(): OrgSchema;
  resetSchema(): Promise<OrgSchema>;
}

class LocalStorageSchemaService implements SchemaService {
  private normalizeSectionLabel(label: string): string {
    return label.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  }

  async loadSchema(): Promise<OrgSchema> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const schema = JSON.parse(stored);
        
        // Auto-migrate: Mark all non-system fields as custom if not already marked
        let migratedSchema = this.ensureCustomFieldsMarked(schema);
        migratedSchema = this.ensureHomeObject(migratedSchema);
        migratedSchema = this.ensureRelationshipFields(migratedSchema);
        migratedSchema = this.ensurePropertyWoodLayout(migratedSchema);
        migratedSchema = this.ensureContactTemplateLayout(migratedSchema);
        migratedSchema = this.ensureAccountTemplateLayout(migratedSchema);
        migratedSchema = this.ensureProductTemplateLayout(migratedSchema);
        migratedSchema = this.ensureLeadTemplateLayout(migratedSchema);
        migratedSchema = this.ensureDealTemplateLayout(migratedSchema);
        if (migratedSchema !== schema) {
          // Schema was modified, save it back
          await this.saveSchema(migratedSchema);
          return migratedSchema;
        }
        
        return schema;
      } catch (error) {
        console.error('Failed to parse stored schema:', error);
      }
    }
    
    // Return default schema with sample data
    return this.createSampleData();
  }

  private ensureCustomFieldsMarked(schema: OrgSchema): OrgSchema {
    // List of system field API names
    const systemFieldNames = SYSTEM_FIELDS.map(f => f.apiName);
    
    // Check if any field is missing the custom flag
    let needsMigration = false;
    
    schema.objects.forEach(obj => {
      obj.fields.forEach(field => {
        // If field doesn't have custom flag and isn't a system field, mark as custom
        if (field.custom === undefined && !systemFieldNames.includes(field.apiName)) {
          needsMigration = true;
        }
      });
    });
    
    if (!needsMigration) {
      return schema;
    }
    
    // Migrate schema to mark all non-system fields as custom
    const migratedObjects = schema.objects.map(obj => ({
      ...obj,
      fields: obj.fields.map(field => {
        // If field doesn't have custom flag and isn't a system field, mark as custom
        if (field.custom === undefined && !systemFieldNames.includes(field.apiName)) {
          return { ...field, custom: true };
        }
        return field;
      })
    }));
    
    return {
      ...schema,
      objects: migratedObjects,
      updatedAt: new Date().toISOString()
    };
  }

  private ensureHomeObject(schema: OrgSchema): OrgSchema {
    const existing = schema.objects.find((obj) => obj.apiName === 'Home');
    if (existing) {
      return schema;
    }

    const now = new Date().toISOString();
    const layoutId = generateId();
    const tabId = generateId();
    const sectionId = generateId();

    const homeRecordType = createDefaultRecordType('Home', layoutId);

    const homeObject: ObjectDef = {
      id: generateId(),
      apiName: 'Home',
      label: 'Home Page',
      pluralLabel: 'Home Page',
      description: 'Homepage layout and panels',
      createdAt: now,
      updatedAt: now,
      fields: [
        ...SYSTEM_FIELDS,
        {
          id: generateId(),
          apiName: 'Home__ReportsPanel',
          label: 'Reports Panel',
          type: 'Text',
          custom: true,
        },
        {
          id: generateId(),
          apiName: 'Home__DashboardsPanel',
          label: 'Dashboards Panel',
          type: 'Text',
          custom: true,
        },
      ],
      recordTypes: [homeRecordType],
      pageLayouts: [
        {
          id: layoutId,
          name: 'Home Layout',
          layoutType: 'edit',
          tabs: [
            {
              id: tabId,
              label: 'Home',
              order: 0,
              sections: [
                {
                  id: sectionId,
                  label: 'Main',
                  columns: 2,
                  order: 0,
                  fields: [
                    { apiName: 'Home__ReportsPanel', column: 0, order: 0 },
                    { apiName: 'Home__DashboardsPanel', column: 1, order: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      validationRules: [],
      defaultRecordTypeId: homeRecordType.id,
    };

    return {
      ...schema,
      objects: [...schema.objects, homeObject],
      updatedAt: now,
    };
  }

  private ensureRelationshipFields(schema: OrgSchema): OrgSchema {
    const excludedObjects = new Set(['Home']);
    let updated = false;

    const objects = schema.objects.map((source) => {
      if (excludedObjects.has(source.apiName)) {
        return source;
      }

      let fields = source.fields;
      let addedField = false;

      const hasContactObject = schema.objects.some((obj) => obj.apiName === 'Contact');
      const hasAccountObject = schema.objects.some((obj) => obj.apiName === 'Account');

      if (hasContactObject) {
        const contactFieldIndex = fields.findIndex(
          (field) => field.label === 'Contacts' && field.type === 'TextArea'
        );
        if (contactFieldIndex >= 0) {
          fields = fields.map((field, index) =>
            index === contactFieldIndex
              ? {
                  ...field,
                  type: 'Lookup',
                  lookupObject: 'Contact',
                  relationshipName: 'Contacts',
                  helpText: 'Search and select a contact'
                }
              : field
          );
          updated = true;
          addedField = true;
        }
      }

      if (hasAccountObject) {
        const accountFieldIndex = fields.findIndex(
          (field) => field.label === 'Accounts' && field.type === 'TextArea'
        );
        if (accountFieldIndex >= 0) {
          fields = fields.map((field, index) =>
            index === accountFieldIndex
              ? {
                  ...field,
                  type: 'Lookup',
                  lookupObject: 'Account',
                  relationshipName: 'Accounts',
                  helpText: 'Search and select an account'
                }
              : field
          );
          updated = true;
          addedField = true;
        }
      }

      schema.objects.forEach((target) => {
        if (target.apiName === source.apiName || excludedObjects.has(target.apiName)) {
          return;
        }

        const targetApi = target.apiName;
        const targetLabel = target.label;
        const targetPlural = target.pluralLabel || target.label;

        const hasLookup = fields.some((field) => {
          const relatedObject = (field as any).relatedObject as string | undefined;
          return (
            (field.type === 'Lookup' || field.type === 'ExternalLookup') &&
            ((field.lookupObject && field.lookupObject === targetApi) || (relatedObject && relatedObject === targetApi))
          ) || field.apiName === `${targetApi}Id`;
        });

        if (!hasLookup) {
          const relationshipField: FieldDef = {
            id: generateId(),
            apiName: `${targetApi}Id`,
            label: targetLabel,
            type: 'Lookup',
            lookupObject: targetApi,
            relationshipName: targetPlural,
            custom: false,
            helpText: `Lookup to ${targetLabel}`
          };

          fields = [...fields, relationshipField];
          updated = true;
          addedField = true;
        }
      });

      if (!addedField) {
        return source;
      }

      const updatedLayouts = source.pageLayouts.map((layout) => {
        if (!layout.tabs.length || !layout.tabs[0]) return layout;
        const tabs = layout.tabs.map((tab, tabIndex) => {
          if (tabIndex !== 0 || !tab.sections.length || !tab.sections[0]) return tab;
          const section = tab.sections[0];
          const existingFieldApi = new Set(section.fields.map((f) => f.apiName));
          const relationshipFields = fields.filter((field) =>
            (field.type === 'Lookup' || field.type === 'ExternalLookup') &&
            !existingFieldApi.has(field.apiName)
          );

          if (relationshipFields.length === 0) return tab;

          const nextFields = section.fields.slice();
          const nextOrderStart = nextFields.length;

          relationshipFields.forEach((field, index) => {
            nextFields.push({
              apiName: field.apiName,
              column: index % section.columns,
              order: nextOrderStart + index
            });
          });

          return {
            ...tab,
            sections: [
              {
                ...section,
                fields: nextFields
              },
              ...tab.sections.slice(1)
            ]
          };
        });

        return {
          ...layout,
          tabs
        };
      });

      return { ...source, fields, pageLayouts: updatedLayouts, updatedAt: new Date().toISOString() };
    });

    if (!updated) {
      return schema;
    }

    return {
      ...schema,
      objects,
      updatedAt: new Date().toISOString()
    };
  }

  private ensurePropertyWoodLayout(schema: OrgSchema): OrgSchema {
    const property = schema.objects.find((obj) => obj.apiName === 'Property');
    if (!property) return schema;

    const hasLayout = property.pageLayouts?.some((layout) => layout.name === 'Property - Wood Template');
    if (hasLayout) {
      const updatedObjects = schema.objects.map((obj) => {
        if (obj.apiName !== 'Property') return obj;
        const updatedLayouts = (obj.pageLayouts || []).map((layout) => {
          if (layout.name !== 'Property - Wood Template') return layout;
          const tabs = layout.tabs.map((tab) => ({
            ...tab,
            sections: tab.sections.map((section) => ({
              ...section,
              label: this.normalizeSectionLabel(section.label)
            }))
          }));
          return { ...layout, tabs };
        });
        return { ...obj, pageLayouts: updatedLayouts, updatedAt: new Date().toISOString() };
      });

      return {
        ...schema,
        objects: updatedObjects,
        updatedAt: new Date().toISOString()
      };
    }

    const fieldMap = new Map(property.fields.map((field) => [field.label, field.apiName]));
    const missing = new Set<string>();

    const sections = PROPERTY_WOOD_LAYOUT_SECTIONS.map((section, sectionIndex) => {
      const sectionFields = section.fields
        .map((label, index) => {
          const apiName = fieldMap.get(label) || property.fields.find((f) => f.apiName === label)?.apiName;
          if (!apiName) {
            missing.add(label);
            return null;
          }
          return {
            apiName,
            column: index % section.columns,
            order: index
          };
        })
        .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

      return {
        id: generateId(),
        label: section.label,
        columns: section.columns,
        order: sectionIndex,
        fields: sectionFields
      };
    });

    if (missing.size > 0) {
      console.warn('[Schema] Missing Property fields for Wood template:', Array.from(missing));
    }

    const layoutId = generateId();
    const layout = {
      id: layoutId,
      name: 'Property - Wood Template',
      layoutType: 'create',
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          order: 0,
          sections
        }
      ]
    };

    const updatedRecordTypes = property.recordTypes.map((recordType, index) => {
      if (property.defaultRecordTypeId && recordType.id === property.defaultRecordTypeId) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      if (!property.defaultRecordTypeId && index === 0) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      return recordType;
    });

    const updatedObjects = schema.objects.map((obj) =>
      obj.apiName === 'Property'
        ? {
            ...obj,
            pageLayouts: [...(obj.pageLayouts || []), layout],
            recordTypes: updatedRecordTypes,
            updatedAt: new Date().toISOString()
          }
        : obj
    );

    return {
      ...schema,
      objects: updatedObjects,
      updatedAt: new Date().toISOString()
    };
  }

  private ensureContactTemplateLayout(schema: OrgSchema): OrgSchema {
    const contact = schema.objects.find((obj) => obj.apiName === 'Contact');
    if (!contact) return schema;

    const hasLayout = contact.pageLayouts?.some((layout) => layout.name === 'Contact - Default Template');
    if (hasLayout) {
      const updatedObjects = schema.objects.map((obj) => {
        if (obj.apiName !== 'Contact') return obj;
        const updatedLayouts = (obj.pageLayouts || []).map((layout) => {
          if (layout.name !== 'Contact - Default Template') return layout;
          const tabs = layout.tabs.map((tab) => ({
            ...tab,
            sections: tab.sections.map((section) => ({
              ...section,
              label: this.normalizeSectionLabel(section.label)
            }))
          }));
          return { ...layout, tabs };
        });
        return { ...obj, pageLayouts: updatedLayouts, updatedAt: new Date().toISOString() };
      });

      return {
        ...schema,
        objects: updatedObjects,
        updatedAt: new Date().toISOString()
      };
    }

    const fieldMap = new Map(contact.fields.map((field) => [field.label, field.apiName]));
    const missing = new Set<string>();

    const sections = CONTACT_LAYOUT_SECTIONS.map((section, sectionIndex) => {
      const sectionFields = section.fields
        .map((label, index) => {
          const apiName = fieldMap.get(label) || contact.fields.find((f) => f.apiName === label)?.apiName;
          if (!apiName) {
            missing.add(label);
            return null;
          }
          return {
            apiName,
            column: index % section.columns,
            order: index
          };
        })
        .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

      return {
        id: generateId(),
        label: section.label,
        columns: section.columns,
        order: sectionIndex,
        fields: sectionFields
      };
    });

    if (missing.size > 0) {
      console.warn('[Schema] Missing Contact fields for default template:', Array.from(missing));
    }

    const layoutId = generateId();
    const layout = {
      id: layoutId,
      name: 'Contact - Default Template',
      layoutType: 'edit',
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          order: 0,
          sections
        }
      ]
    };

    const updatedRecordTypes = contact.recordTypes.map((recordType, index) => {
      if (contact.defaultRecordTypeId && recordType.id === contact.defaultRecordTypeId) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      if (!contact.defaultRecordTypeId && index === 0) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      return recordType;
    });

    const updatedObjects = schema.objects.map((obj) =>
      obj.apiName === 'Contact'
        ? {
            ...obj,
            pageLayouts: [...(obj.pageLayouts || []), layout],
            recordTypes: updatedRecordTypes,
            updatedAt: new Date().toISOString()
          }
        : obj
    );

    return {
      ...schema,
      objects: updatedObjects,
      updatedAt: new Date().toISOString()
    };
  }

  private ensureAccountTemplateLayout(schema: OrgSchema): OrgSchema {
    const account = schema.objects.find((obj) => obj.apiName === 'Account');
    if (!account) return schema;

    const hasLayout = account.pageLayouts?.some((layout) => layout.name === 'Account - Default Template');

    const requiredFields: FieldDef[] = [];

    const ensureField = (field: FieldDef) => {
      const exists = account.fields.some((f) => f.apiName === field.apiName || f.label === field.label);
      if (!exists) {
        requiredFields.push(field);
      }
    };

    ensureField({
      id: generateId(),
      apiName: 'Account__shippingAddress',
      label: 'Shipping Address',
      type: 'Address'
    });
    ensureField({
      id: generateId(),
      apiName: 'Account__billingAddress',
      label: 'Billing Address',
      type: 'Address'
    });
    ensureField({
      id: generateId(),
      apiName: 'Account__parentAccount',
      label: 'Parent Account',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Parent Accounts'
    });
    ensureField({
      id: generateId(),
      apiName: 'Account__description',
      label: 'Description',
      type: 'TextArea',
      maxLength: 2000
    });

    const mergedFields = requiredFields.length > 0
      ? [...account.fields, ...requiredFields]
      : account.fields;

    const ensureAddressFieldsInLayout = (layout: any) => {
      if (!layout?.tabs?.length) return layout;
      const tabs = layout.tabs.map((tab: any, tabIndex: number) => {
        if (tabIndex !== 0 || !tab.sections?.length) return tab;
        const sections = tab.sections.map((section: any) => {
          if (section.label !== 'Address Information') return section;
          const existing = new Set(section.fields?.map((f: any) => f.apiName) || []);
          const nextFields = [...(section.fields || [])];
          if (!existing.has('Account__shippingAddress')) {
            nextFields.push({
              apiName: 'Account__shippingAddress',
              column: nextFields.length % section.columns,
              order: nextFields.length
            });
          }
          if (!existing.has('Account__billingAddress')) {
            nextFields.push({
              apiName: 'Account__billingAddress',
              column: nextFields.length % section.columns,
              order: nextFields.length
            });
          }
          return { ...section, fields: nextFields };
        });
        return { ...tab, sections };
      });
      return { ...layout, tabs };
    };

    const fieldMap = new Map(mergedFields.map((field) => [field.label, field.apiName]));
    const missing = new Set<string>();

    const aliasMap = new Map<string, string>([
      ['Account #', 'Account Number'],
      ['Email', 'Primary Email'],
      ['Phone', 'Primary Phone']
    ]);

    const sections = ACCOUNT_LAYOUT_SECTIONS.map((section, sectionIndex) => {
      const sectionFields = section.fields
        .map((label, index) => {
          const labelKey = aliasMap.get(label) || label;
          const apiName = fieldMap.get(labelKey) || mergedFields.find((f) => f.apiName === label)?.apiName;
          if (!apiName) {
            missing.add(label);
            return null;
          }
          return {
            apiName,
            column: index % section.columns,
            order: index
          };
        })
        .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

      return {
        id: generateId(),
        label: section.label,
        columns: section.columns,
        order: sectionIndex,
        fields: sectionFields
      };
    });

    if (missing.size > 0) {
      console.warn('[Schema] Missing Account fields for default template:', Array.from(missing));
    }

    const layoutId = generateId();
    const layout = {
      id: layoutId,
      name: 'Account - Default Template',
      layoutType: 'edit',
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          order: 0,
          sections
        }
      ]
    };

    const updatedRecordTypes = account.recordTypes.map((recordType, index) => {
      if (account.defaultRecordTypeId && recordType.id === account.defaultRecordTypeId) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      if (!account.defaultRecordTypeId && index === 0) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      return recordType;
    });

    const updatedObjects = schema.objects.map((obj) => {
      if (obj.apiName !== 'Account') return obj;

      if (hasLayout) {
        const updatedLayouts = (obj.pageLayouts || []).map((existingLayout) => {
          if (existingLayout.name !== 'Account - Default Template') return existingLayout;
          const normalized = {
            ...existingLayout,
            tabs: existingLayout.tabs.map((tab: any) => ({
              ...tab,
              sections: tab.sections.map((section: any) => ({
                ...section,
                label: this.normalizeSectionLabel(section.label)
              }))
            }))
          };
          return ensureAddressFieldsInLayout(normalized);
        });

        return {
          ...obj,
          fields: mergedFields,
          pageLayouts: updatedLayouts,
          updatedAt: new Date().toISOString()
        };
      }

      return {
        ...obj,
        fields: mergedFields,
        pageLayouts: [...(obj.pageLayouts || []), layout],
        recordTypes: updatedRecordTypes,
        updatedAt: new Date().toISOString()
      };
    });

    return {
      ...schema,
      objects: updatedObjects,
      updatedAt: new Date().toISOString()
    };
  }

  private ensureProductTemplateLayout(schema: OrgSchema): OrgSchema {
    const product = schema.objects.find((obj) => obj.apiName === 'Product');
    if (!product) return schema;

    const hasLayout = product.pageLayouts?.some((layout) => layout.name === 'Product - Default Template');

    const requiredFields: FieldDef[] = [];
    const ensureField = (field: FieldDef) => {
      const exists = product.fields.some((f) => f.apiName === field.apiName || f.label === field.label);
      if (!exists) requiredFields.push(field);
    };

    ensureField({
      id: generateId(),
      apiName: 'Product__family',
      label: 'Product Family',
      type: 'Picklist',
      picklistValues: ['Core', 'Premium', 'Custom', 'Legacy']
    });
    ensureField({
      id: generateId(),
      apiName: 'Product__currency',
      label: 'Product Currency',
      type: 'Text',
      maxLength: 10
    });
    ensureField({
      id: generateId(),
      apiName: 'Product__description',
      label: 'Product Description',
      type: 'TextArea',
      maxLength: 2000
    });

    const mergedFields = requiredFields.length > 0
      ? [...product.fields, ...requiredFields]
      : product.fields;

    const ensureDescriptionFieldInLayout = (layout: any) => {
      if (!layout?.tabs?.length) return layout;
      const tabs = layout.tabs.map((tab: any, tabIndex: number) => {
        if (tabIndex !== 0 || !tab.sections?.length) return tab;
        const sections = tab.sections.map((section: any) => {
          if (this.normalizeSectionLabel(section.label) !== 'Description Information') return section;
          const existing = new Set(section.fields?.map((f: any) => f.apiName) || []);
          const nextFields = [...(section.fields || [])];
          if (!existing.has('Product__description')) {
            nextFields.push({
              apiName: 'Product__description',
              column: nextFields.length % section.columns,
              order: nextFields.length
            });
          }
          return { ...section, fields: nextFields };
        });
        return { ...tab, sections };
      });
      return { ...layout, tabs };
    };

    if (hasLayout) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Product'
            ? {
                ...obj,
                fields: mergedFields,
                pageLayouts: (obj.pageLayouts || []).map((layout) =>
                  layout.name === 'Product - Default Template'
                    ? ensureDescriptionFieldInLayout({
                        ...layout,
                        tabs: layout.tabs.map((tab) => ({
                          ...tab,
                          sections: tab.sections.map((section) => ({
                            ...section,
                            label: this.normalizeSectionLabel(section.label)
                          }))
                        }))
                      })
                    : layout
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }

    const fieldMap = new Map(mergedFields.map((field) => [field.label, field.apiName]));
    const missing = new Set<string>();

    const aliasMap = new Map<string, string>([
      ['Product Family', 'Product Family'],
      ['Product Description', 'Product Description']
    ]);

    const sections = PRODUCT_LAYOUT_SECTIONS.map((section, sectionIndex) => {
      const sectionFields = section.fields
        .map((label, index) => {
          const labelKey = aliasMap.get(label) || label;
          const apiName = fieldMap.get(labelKey) || mergedFields.find((f) => f.apiName === label)?.apiName;
          if (!apiName) {
            missing.add(label);
            return null;
          }
          return {
            apiName,
            column: index % section.columns,
            order: index
          };
        })
        .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

      return {
        id: generateId(),
        label: section.label,
        columns: section.columns,
        order: sectionIndex,
        fields: sectionFields
      };
    });

    if (missing.size > 0) {
      console.warn('[Schema] Missing Product fields for default template:', Array.from(missing));
    }

    const layoutId = generateId();
    const layout = {
      id: layoutId,
      name: 'Product - Default Template',
      layoutType: 'edit',
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          order: 0,
          sections
        }
      ]
    };

    const updatedRecordTypes = product.recordTypes.map((recordType, index) => {
      if (product.defaultRecordTypeId && recordType.id === product.defaultRecordTypeId) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      if (!product.defaultRecordTypeId && index === 0) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      return recordType;
    });

    return {
      ...schema,
      objects: schema.objects.map((obj) =>
        obj.apiName === 'Product'
          ? {
              ...obj,
              fields: mergedFields,
              pageLayouts: [...(obj.pageLayouts || []), layout],
              recordTypes: updatedRecordTypes,
              updatedAt: new Date().toISOString()
            }
          : obj
      ),
      updatedAt: new Date().toISOString()
    };
  }

  private ensureLeadTemplateLayout(schema: OrgSchema): OrgSchema {
    const lead = schema.objects.find((obj) => obj.apiName === 'Lead');
    if (!lead) return schema;

    const hasLayout = lead.pageLayouts?.some((layout) => layout.name === 'Lead - Default Template');

    const requiredFields: FieldDef[] = [];
    const ensureField = (field: FieldDef) => {
      const exists = lead.fields.some((f) => f.apiName === field.apiName || f.label === field.label);
      if (!exists) requiredFields.push(field);
    };

    ensureField({
      id: generateId(),
      apiName: 'Lead__leadType',
      label: 'Lead Type',
      type: 'Picklist',
      picklistValues: ['Architect', 'Client/Homeowner', 'Property Manager', 'Contractor', 'Designer', 'Associate']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__leadOwner',
      label: 'Lead Owner',
      type: 'Lookup',
      lookupObject: 'User',
      relationshipName: 'Lead Owners'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__competitors',
      label: 'Competitors',
      type: 'MultiSelectPicklist',
      picklistValues: ['Reilly Architectural', 'Peetz Windows and Doors, Inc', 'Hartman Doors and Windows', 'Trade Wood Industries', 'Other']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__closeDate',
      label: 'Close Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__confidenceLevel',
      label: 'Confidence Level',
      type: 'Text',
      maxLength: 100
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__saleType',
      label: 'Type of Sale',
      type: 'Picklist',
      picklistValues: ['Product', 'Service', 'Solution']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__singleSalesObjective',
      label: 'Single Sales Objective',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__contactName',
      label: 'Name',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__account',
      label: 'Account',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Accounts'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__primaryEmail',
      label: 'Primary Email',
      type: 'Email',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__secondaryEmail',
      label: 'Secondary Email',
      type: 'Email',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__primaryPhone',
      label: 'Primary Phone',
      type: 'Phone',
      maxLength: 40
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__secondaryPhone',
      label: 'Secondary Phone',
      type: 'Phone',
      maxLength: 40
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__property',
      label: 'Property',
      type: 'Lookup',
      lookupObject: 'Property',
      relationshipName: 'Properties'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__propertyAddress',
      label: 'Property Address',
      type: 'TextArea',
      maxLength: 2000
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__role',
      label: 'Role',
      type: 'Picklist',
      picklistValues: ['Economic', 'Technical', 'User', 'Coach']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__mode',
      label: 'Mode',
      type: 'Picklist',
      picklistValues: ['Growth', 'Trouble', 'Even Keel', 'Overconfident']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__rating',
      label: 'Rating',
      type: 'Picklist',
      picklistValues: ['Hot', 'Warm', 'Cold']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__degreesOfInfluence',
      label: 'Degrees of Influence',
      type: 'Picklist',
      picklistValues: ['Low', 'Medium', 'High']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__buyingInfluence',
      label: 'Buying Influence',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__baseCoverage',
      label: 'Base Coverage',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__summaryStrengths',
      label: 'Summary of Position: Strengths',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__summaryRedFlags',
      label: 'Summary of Position: Red Flags',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__actions',
      label: 'Actions',
      type: 'MultiSelectPicklist',
      picklistValues: ['Call', 'Email', 'Schedule Meeting', 'Send Quote', 'Follow Up']
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__leadNotes',
      label: 'Lead Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__sharepointFiles',
      label: 'Sharepoint Files',
      type: 'TextArea',
      maxLength: 2000
    });
    ensureField({
      id: generateId(),
      apiName: 'Lead__leadNumber',
      label: 'Lead Number',
      type: 'AutoNumber',
      autoNumber: { displayFormat: 'L{00}', startingNumber: 1 }
    });

    const mergedFields = requiredFields.length > 0
      ? [...lead.fields, ...requiredFields]
      : lead.fields;

    const aliasMap = new Map<string, string>([
      ['Lead Status', 'Status'],
      ['Name', 'Name']
    ]);

    const resolveApiName = (label: string) => {
      const labelKey = aliasMap.get(label) || label;
      const fieldMap = new Map(mergedFields.map((field) => [field.label, field.apiName]));
      return fieldMap.get(labelKey) || mergedFields.find((f) => f.apiName === label)?.apiName;
    };

    const applyTemplateToLayout = (layout: any) => {
      if (!layout?.tabs?.length) return layout;
      const tabs = layout.tabs.map((tab: any, tabIndex: number) => {
        if (tabIndex !== 0 || !tab.sections?.length) return tab;
        const sectionMap = new Map(
          tab.sections.map((section: any) => [this.normalizeSectionLabel(section.label), section])
        );

        const updatedSections = LEAD_LAYOUT_SECTIONS.map((templateSection, sectionIndex) => {
          const key = this.normalizeSectionLabel(templateSection.label);
          const existingSection = sectionMap.get(key);
          const baseSection = existingSection || {
            id: generateId(),
            label: templateSection.label,
            columns: templateSection.columns,
            order: sectionIndex,
            fields: []
          };

          const existingApi = new Set((baseSection.fields || []).map((f: any) => f.apiName));
          const nextFields = [...(baseSection.fields || [])];

          templateSection.fields.forEach((label, index) => {
            const apiName = resolveApiName(label);
            if (!apiName) return;
            if (!existingApi.has(apiName)) {
              nextFields.push({
                apiName,
                column: index % templateSection.columns,
                order: nextFields.length
              });
            }
          });

          return {
            ...baseSection,
            label: this.normalizeSectionLabel(templateSection.label),
            columns: templateSection.columns,
            order: sectionIndex,
            fields: nextFields
          };
        });

        return {
          ...tab,
          sections: updatedSections
        };
      });

      return { ...layout, tabs };
    };

    if (hasLayout) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Lead'
            ? {
                ...obj,
                fields: mergedFields,
                pageLayouts: (obj.pageLayouts || []).map((layout) =>
                  layout.name === 'Lead - Default Template'
                    ? applyTemplateToLayout(layout)
                    : layout
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }

    const missing = new Set<string>();
    const sections = LEAD_LAYOUT_SECTIONS.map((section, sectionIndex) => {
      const sectionFields = section.fields
        .map((label, index) => {
          const apiName = resolveApiName(label);
          if (!apiName) {
            missing.add(label);
            return null;
          }
          return {
            apiName,
            column: index % section.columns,
            order: index
          };
        })
        .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

      return {
        id: generateId(),
        label: section.label,
        columns: section.columns,
        order: sectionIndex,
        fields: sectionFields
      };
    });

    if (missing.size > 0) {
      console.warn('[Schema] Missing Lead fields for default template:', Array.from(missing));
    }

    const layoutId = generateId();
    const layout = {
      id: layoutId,
      name: 'Lead - Default Template',
      layoutType: 'edit',
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          order: 0,
          sections
        }
      ]
    };

    const updatedRecordTypes = lead.recordTypes.map((recordType, index) => {
      if (lead.defaultRecordTypeId && recordType.id === lead.defaultRecordTypeId) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      if (!lead.defaultRecordTypeId && index === 0) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      return recordType;
    });

    return {
      ...schema,
      objects: schema.objects.map((obj) =>
        obj.apiName === 'Lead'
          ? {
              ...obj,
              fields: mergedFields,
              pageLayouts: [...(obj.pageLayouts || []), layout],
              recordTypes: updatedRecordTypes,
              updatedAt: new Date().toISOString()
            }
          : obj
      ),
      updatedAt: new Date().toISOString()
    };
  }

  private ensureDealTemplateLayout(schema: OrgSchema): OrgSchema {
    const deal = schema.objects.find((obj) => obj.apiName === 'Deal');
    if (!deal) return schema;

    const hasLayout = deal.pageLayouts?.some((layout) => layout.name === 'Deal - Default Template');

    const requiredFields: FieldDef[] = [];
    const ensureField = (field: FieldDef) => {
      const exists = deal.fields.some((f) => f.apiName === field.apiName || f.label === field.label);
      if (!exists) requiredFields.push(field);
    };

    ensureField({
      id: generateId(),
      apiName: 'Deal__dealName',
      label: 'Deal Name',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__architectFirm',
      label: 'Architect Firm',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Architect Firms'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__architect',
      label: 'Architect',
      type: 'Lookup',
      lookupObject: 'Contact',
      relationshipName: 'Architects'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__contractorCompany',
      label: 'Contractor Company',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Contractor Companies'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__contractor',
      label: 'Contractor',
      type: 'Lookup',
      lookupObject: 'Contact',
      relationshipName: 'Contractors'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__quoteAccount',
      label: 'Quote Account',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Quote Accounts'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__quoteContact',
      label: 'Quote Contact',
      type: 'Lookup',
      lookupObject: 'Contact',
      relationshipName: 'Quote Contacts'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__quoteEmail',
      label: 'Quote Email',
      type: 'Email',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__quotePhone',
      label: 'Quote Phone',
      type: 'Phone',
      maxLength: 40
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__secondaryQuotePhone',
      label: 'Secondary Quote Phone',
      type: 'Phone',
      maxLength: 40
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__dealOwner',
      label: 'Deal Owner',
      type: 'Lookup',
      lookupObject: 'User',
      relationshipName: 'Deal Owners'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__dealNumber',
      label: 'Deal Number',
      type: 'AutoNumber',
      autoNumber: { displayFormat: 'YY{000}', startingNumber: 1 }
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__property',
      label: 'Property',
      type: 'Lookup',
      lookupObject: 'Property',
      relationshipName: 'Properties'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__propertyAddress',
      label: 'Property Address',
      type: 'TextArea',
      maxLength: 2000
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__estimatedContractDate',
      label: 'Estimated Contract Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__productRequiredOnsite',
      label: 'Product Required Onsite',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__quoteDue',
      label: 'Quote Due',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__stage',
      label: 'Stage',
      type: 'Picklist',
      picklistValues: ['Incomplete', 'Queued', 'Estimating', 'Quoted/Active', 'Requote/Active', 'Closed Won', 'Closed Lost']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__competitors',
      label: 'Competitors',
      type: 'MultiSelectPicklist',
      picklistValues: [
        'Reilly Architectural',
        'Peetz Windows and Doors, Inc',
        'Hartman Doors and Windows',
        'Trade Wood Industries',
        'Little Harbor Window Company',
        'Stuart Brannen Millworks',
        'Brombal',
        'COMEP Steel Windows/CO.ME.P Infissi',
        'LuxView',
        'Dynamic Fenestration',
        'Northeast Architectural',
        'Open Architectural',
        'H. Hirchman LTD',
        'Woodstone Architectural',
        'Harman Fensterbau',
        'Luxbaum Windows + Doors',
        'Hope’s Windows, Inc.',
        'Crittall Windows Ltd.',
        'Panoramic European Windows & Doors',
        'Marvin Modern',
        'Fleetwood',
        'Victrocsa',
        'Optimum',
        'Oliverri Windows and Doors',
        'Other'
      ]
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__probability',
      label: 'Probability',
      type: 'Picklist',
      picklistValues: ['25%', '50%', '75%', '90%']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__amount',
      label: 'Amount',
      type: 'Currency',
      precision: 16,
      scale: 2
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__quoteBudget',
      label: 'Quote Budget',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__plansDated',
      label: 'Plans Dated',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__sharedOpportunity',
      label: 'Shared Opportunity',
      type: 'Picklist',
      picklistValues: ['No', 'Yes']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__sharedOpportunityUsers',
      label: 'Shared Opportunity Users',
      type: 'MultiSelectPicklist',
      picklistValues: ['Andy', 'Chris', 'Jim', 'Tim', 'Brian']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__dealNotes',
      label: 'Deal Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__kornPriority',
      label: 'Korn Priority',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__estimators',
      label: 'Estimators',
      type: 'MultiSelectPicklist',
      picklistValues: ['Elaine', 'Nancy', 'Krystyna', 'Marianna', 'Estefania', 'Julian']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__estimatingStatus',
      label: 'Status',
      type: 'Picklist',
      picklistValues: ['Initial Review', 'Internal Info Request', 'External Info Request', 'In Progress', 'Final Review', 'Completed', 'Paused']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__priorityNextJob',
      label: 'Priority/Next Job',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__estimatingNotes',
      label: 'Estimating Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__siteMeasurements',
      label: 'Site Measurements',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__highAltitude',
      label: 'High Altitude',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__newConstruction',
      label: 'New Construction',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__renovation',
      label: 'Renovation',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__waterfrontExposure',
      label: 'Waterfront Exposure',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__productSpecifications',
      label: 'Product Specifications',
      type: 'Picklist',
      picklistValues: ['Premium', 'Coastal', 'Dade (HVHZ)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__deliveryRequirements',
      label: 'Delivery Requirements',
      type: 'Picklist',
      picklistValues: [
        'YES the job site CAN accept 40’ container and tractor trailer',
        'NO the job site can NOT accept 40’ container and tractor trailer'
      ]
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__deliveryNotes',
      label: 'Delivery Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__referenceUnitDimensions',
      label: 'Reference for Unit Dimensions',
      type: 'Picklist',
      picklistValues: ['Sash', 'Frame', 'Clear Opening', 'Rough Opening', 'Masonry Opening']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__windLoadSpeed',
      label: 'Wind Load Speed MPH',
      type: 'Text',
      maxLength: 50
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__windSpeedReference',
      label: 'Wind Speed Reference',
      type: 'URL',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__woodType',
      label: 'Wood Type',
      type: 'Picklist',
      picklistValues: ['Sipo', 'Split Sipo/Specify in Notes', 'Other/Specify in Notes']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__finishSpecifications',
      label: 'Finish Specifications',
      type: 'Picklist',
      picklistValues: [
        'Same finish inside and out (paint/paint or stain/stain) 200',
        'Partial split finish (stain or painted exterior/clear or white dip interior) 510',
        'Stain exterior/clear dip interior (clear dip considered “no finish”) 610',
        'Split paint finish & paint exterior stain interior 500',
        'Split stain finish (different stain colors inside and out) 600'
      ]
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__woodNotes',
      label: 'Wood Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__finalFinish',
      label: 'Final Finish',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__glassType',
      label: 'Glass Type',
      type: 'Picklist',
      picklistValues: ['Type 1', 'Type 2', 'Type 3', 'Type 4']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__alternativeGlass',
      label: 'Alternative Glass',
      type: 'Picklist',
      picklistValues: ['Type 1', 'Type 2', 'Type 3', 'Type 4']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__glassNotes',
      label: 'Glass Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__spacerBars',
      label: 'Spacer Bars',
      type: 'Picklist',
      picklistValues: ['Standard White', 'Silver', 'Brown', 'Black', 'Premium C31', 'C32', 'C33', 'C34', 'Warm Edge']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__windowHardware',
      label: 'Window Hardware',
      type: 'Picklist',
      picklistValues: ['White Zinc/Titan Silver', 'Corrosion Resistant Metal Alloy (E-Look)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__hardwareFinishNotes',
      label: 'Hardware Finish Notes',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__hingeFinishSpecification',
      label: 'Hinge Finish Specification',
      type: 'Picklist',
      picklistValues: ['Base (Brushed Stainless Steel)', 'Premium Custom Finish (Specify in Notes)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__finials',
      label: 'Finials',
      type: 'Picklist',
      picklistValues: ['Yes', 'No']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__finialType',
      label: 'Finial Type',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__security',
      label: 'Security',
      type: 'MultiSelectPicklist',
      picklistValues: ['Magnetic Contact', 'Integrated Contact', 'Alarm Spider Contact', 'Secondary or Pool Contact']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__windowType',
      label: 'Window Type',
      type: 'MultiSelectPicklist',
      picklistValues: ['Inswing', 'Inswing TT', 'Push Outswing', 'Crank Outswing', 'Offset Simulated Double Hung', 'Simulated Double Hung', 'Awning']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__fixedOptions',
      label: 'Fixed Options',
      type: 'MultiSelectPicklist',
      picklistValues: ['Direct Glaze', 'Fixed with Sash']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__windowTypeNotes',
      label: 'Window Type Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__singleDoubleTripleHung',
      label: 'Single, Double & Triple Hung Windows',
      type: 'MultiSelectPicklist',
      picklistValues: ['Single Hung', 'Double Hung', 'Triple Hung', 'Concealed Balance', 'Weight and Chain', 'Cross Cable Balance System', 'Vent Locks']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__singleDoubleHungNotes',
      label: 'Single/Double Hung Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__sill',
      label: 'Sill',
      type: 'Picklist',
      picklistValues: ['No Sill', 'Standard Sill', 'Custom Sill (Specify Dimensions in Notes)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__sillNotes',
      label: 'Sill Notes',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__doorOptions',
      label: 'Door Options',
      type: 'MultiSelectPicklist',
      picklistValues: ['Inswing', 'Outswing', 'Outswing Folding', 'Inswing Folding', 'Sliding']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__inswingDoorThreshold',
      label: 'Inswing Door Threshold',
      type: 'MultiSelectPicklist',
      picklistValues: ['Classic Bronze Threshold #6C', 'Premium Bronze Threshold #6', 'ADA Threshold']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__outswingDoorThreshold',
      label: 'Outswing Door Threshold',
      type: 'MultiSelectPicklist',
      picklistValues: ['Bronze Threshold #7 Flush', 'Bronze Threshold #8 Stepdown', 'ADA Threshold']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__liftSlideStrikerBolts',
      label: 'Lift and Slide Doors Striker Bolts',
      type: 'MultiSelectPicklist',
      picklistValues: ['White Zinc Hooks and Striker Bolts', 'SS Locking Hooks and Striker Bolts']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__doorOptionNotes',
      label: 'Door Option Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__entryDoor',
      label: 'Entry Door',
      type: 'Picklist',
      picklistValues: ['Include in base cost', 'Include as an option', 'Omit']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__rollScreens',
      label: 'Roll Screens',
      type: 'MultiSelectPicklist',
      picklistValues: ['Low Wind (Brush) Manual', 'Low Wind (Brush) Motorized', 'Zip Motorized', 'Manual Horizontal', 'Centor']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__rollScreenLocation',
      label: 'Roll Screen Location',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__screens',
      label: 'Screens',
      type: 'MultiSelectPicklist',
      picklistValues: ['Aluminum Window Screens', 'Wood-covered Aluminum Window Screens', 'Wood Framed Window Screens', 'Wood Framed Door Screens']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__screenLocation',
      label: 'Screen Location',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__meshType',
      label: 'Mesh Type',
      type: 'Picklist',
      picklistValues: ['Fiberglass', 'Clearview', 'Bronze', 'Dog']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__rollShades',
      label: 'Roll Shades',
      type: 'MultiSelectPicklist',
      picklistValues: ['Sun Shade', 'Blackout Shade']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__shadesLocation',
      label: 'Shades Location',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__addOnProducts',
      label: 'Add-on Products',
      type: 'MultiSelectPicklist',
      picklistValues: ['Motorized Operation', '180-Degree Hinges', 'Genius Locks', 'Bent Units', 'Butt Glazing', 'Curtain Wall', 'Retractable', 'Door Closer']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__addOnLocations',
      label: 'Add-on Locations',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__woodExteriorTrimAndCasing',
      label: 'Wood Exterior Trim and Casing',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__installation',
      label: 'Installation',
      type: 'MultiSelectPicklist',
      picklistValues: ['MHB', 'Korn', 'Arcadia']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__requiredInstallationScope',
      label: 'Required Installation Scope/Notes',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__revisionStartDate',
      label: 'Start Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__revisionFinishDate',
      label: 'Finish Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__revision',
      label: 'Revision',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__generalNotes',
      label: 'General Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__kornNotes',
      label: 'Korn Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__lossReason',
      label: 'Loss Reason',
      type: 'MultiSelectPicklist',
      picklistValues: ['Lost Budget', 'Internal Lead Time', 'External Lead Time', 'Lost to Competitor', 'Unresponsive']
    });
    ensureField({
      id: generateId(),
      apiName: 'Deal__lossNotes',
      label: 'Loss Notes',
      type: 'Text',
      maxLength: 255
    });

    const mergedFields = requiredFields.length > 0
      ? [...deal.fields, ...requiredFields]
      : deal.fields;

    const resolveApiName = (label: string) => {
      const fieldMap = new Map(mergedFields.map((field) => [field.label, field.apiName]));
      return fieldMap.get(label) || mergedFields.find((f) => f.apiName === label)?.apiName;
    };

    const applyTemplateToLayout = (layout: any) => {
      if (!layout?.tabs?.length) return layout;
      const tabs = layout.tabs.map((tab: any, tabIndex: number) => {
        if (tabIndex !== 0 || !tab.sections?.length) return tab;
        const sectionMap = new Map(
          tab.sections.map((section: any) => [this.normalizeSectionLabel(section.label), section])
        );

        const updatedSections = DEAL_LAYOUT_SECTIONS.map((templateSection, sectionIndex) => {
          const key = this.normalizeSectionLabel(templateSection.label);
          const existingSection = sectionMap.get(key);
          const baseSection = existingSection || {
            id: generateId(),
            label: templateSection.label,
            columns: templateSection.columns,
            order: sectionIndex,
            fields: []
          };

          const existingApi = new Set((baseSection.fields || []).map((f: any) => f.apiName));
          const nextFields = [...(baseSection.fields || [])];

          templateSection.fields.forEach((label, index) => {
            const apiName = resolveApiName(label);
            if (!apiName) return;
            if (!existingApi.has(apiName)) {
              nextFields.push({
                apiName,
                column: index % templateSection.columns,
                order: nextFields.length
              });
            }
          });

          return {
            ...baseSection,
            label: this.normalizeSectionLabel(templateSection.label),
            columns: templateSection.columns,
            order: sectionIndex,
            fields: nextFields
          };
        });

        return {
          ...tab,
          sections: updatedSections
        };
      });

      return { ...layout, tabs };
    };

    if (hasLayout) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Deal'
            ? {
                ...obj,
                fields: mergedFields,
                pageLayouts: (obj.pageLayouts || []).map((layout) =>
                  layout.name === 'Deal - Default Template'
                    ? applyTemplateToLayout(layout)
                    : layout
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }

    const missing = new Set<string>();
    const sections = DEAL_LAYOUT_SECTIONS.map((section, sectionIndex) => {
      const sectionFields = section.fields
        .map((label, index) => {
          const apiName = resolveApiName(label);
          if (!apiName) {
            missing.add(label);
            return null;
          }
          return {
            apiName,
            column: index % section.columns,
            order: index
          };
        })
        .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

      return {
        id: generateId(),
        label: section.label,
        columns: section.columns,
        order: sectionIndex,
        fields: sectionFields
      };
    });

    if (missing.size > 0) {
      console.warn('[Schema] Missing Deal fields for default template:', Array.from(missing));
    }

    const layoutId = generateId();
    const layout = {
      id: layoutId,
      name: 'Deal - Default Template',
      layoutType: 'edit',
      tabs: [
        {
          id: generateId(),
          label: 'Details',
          order: 0,
          sections
        }
      ]
    };

    const updatedRecordTypes = deal.recordTypes.map((recordType, index) => {
      if (deal.defaultRecordTypeId && recordType.id === deal.defaultRecordTypeId) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      if (!deal.defaultRecordTypeId && index === 0) {
        return { ...recordType, pageLayoutId: layoutId };
      }
      return recordType;
    });

    return {
      ...schema,
      objects: schema.objects.map((obj) =>
        obj.apiName === 'Deal'
          ? {
              ...obj,
              fields: mergedFields,
              pageLayouts: [...(obj.pageLayouts || []), layout],
              recordTypes: updatedRecordTypes,
              updatedAt: new Date().toISOString()
            }
          : obj
      ),
      updatedAt: new Date().toISOString()
    };
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
      
      // Mark all custom fields with custom: true
      const customFields = fields.map(field => ({ ...field, custom: true }));
      
      return {
        id: generateId(),
        apiName,
        label,
        pluralLabel,
        description,
        createdAt: now,
        updatedAt: now,
        fields: [...SYSTEM_FIELDS, ...customFields],
        recordTypes: [recordType],
        pageLayouts: [layout],
        validationRules: [],
        defaultRecordTypeId: recordType.id
      };
    };

    // 1. Property
    const propertyFields = [
        // Address Section
        {
          id: generateId(),
          apiName: 'Property__address',
          label: 'Address',
          type: 'Text',
          required: true,
          maxLength: 255,
          helpText: 'May start as a general location during the Leads pipeline before it is converted to the Deals pipeline'
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
          apiName: 'Property__propertyNumber',
          label: 'Property Number',
          type: 'AutoNumber',
          required: true,
          autoNumber: { displayFormat: 'P-{00}', startingNumber: 1 },
          helpText: 'Unique internal identification'
        },
        // Contact Information Section
        {
          id: generateId(),
          apiName: 'Property__contacts',
          label: 'Contacts',
          type: 'Lookup',
          lookupObject: 'Contact',
          relationshipName: 'Contacts',
          helpText: 'Search and select a contact'
        },
        {
          id: generateId(),
          apiName: 'Property__accounts',
          label: 'Accounts',
          type: 'Lookup',
          lookupObject: 'Account',
          relationshipName: 'Accounts',
          helpText: 'Search and select an account'
        },
        // System Information (Created By, Last Modified By are in SYSTEM_FIELDS)
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
        },
        // Custom fields from imported data
        {
          id: generateId(),
          apiName: 'Field1__c',
          label: '! Field1',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'X7_days_Before_Contract_Date__c',
          label: '7 days Before Contract Date',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'AccountId',
          label: 'Account Name',
          type: 'Lookup',
          relatedObject: 'Account'
        },
        {
          id: generateId(),
          apiName: 'Account_Type__c',
          label: 'Account Type',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'Air_Lux_Door_Sill__c',
          label: 'Air-Lux Door Sill',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Alt_Glass__c',
          label: 'Alternative Glass',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Amount',
          label: 'Amount',
          type: 'Currency',
          precision: 16,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Metal_Glass_Type__c',
          label: 'Arcadia Glass Type',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Arcadia_Glass_Type_Alternative__c',
          label: 'Arcadia Glass Type Alternative',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Architect__c',
          label: 'Architect',
          type: 'Lookup',
          relatedObject: 'Contact'
        },
        {
          id: generateId(),
          apiName: 'Architect_Firm__c',
          label: 'Architect Firm',
          type: 'Lookup',
          relatedObject: 'Account'
        },
        {
          id: generateId(),
          apiName: 'Budget_Confirmed__c',
          label: 'Budget Confirmed',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Casement_Stay_Outswing__c',
          label: 'Casement Stay',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Click_Link_to_Find_Wind_Speed__c',
          label: 'Click Link to Find Wind Speed',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'Competitors__c',
          label: 'Competitors',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'ContractId',
          label: 'Contract',
          type: 'Lookup',
          relatedObject: 'Contract'
        },
        {
          id: generateId(),
          apiName: 'Contractor__c',
          label: 'Contractor',
          type: 'Lookup',
          relatedObject: 'Contact'
        },
        {
          id: generateId(),
          apiName: 'Contractor_Company__c',
          label: 'Contractor Company',
          type: 'Lookup',
          relatedObject: 'Account'
        },
        {
          id: generateId(),
          apiName: 'Contribution__c',
          label: 'Contribution',
          type: 'Currency',
          precision: 15,
          scale: 3
        },
        {
          id: generateId(),
          apiName: 'Copied_Opportunity_URL__c',
          label: 'Copied Opportunity URL(Do This First!!)',
          type: 'URL',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Create_a_Project__c',
          label: 'Create a Project',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Date_Finished__c',
          label: 'Date Finished',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Date_Started__c',
          label: 'Date Started',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'DB_Competitor__c',
          label: 'DB Competitor',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Delivery_Req_Notes__c',
          label: 'Delivery Req Notes',
          type: 'Text',
          maxLength: 69
        },
        {
          id: generateId(),
          apiName: 'Delivery_Requirements__c',
          label: 'Delivery Requirements',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Description',
          label: 'Description',
          type: 'LongTextArea',
          maxLength: 32000
        },
        {
          id: generateId(),
          apiName: 'Discovery_Completed__c',
          label: 'Discovery Completed',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Does_Project_Contain_Accessories_Add__c',
          label: 'Does Project Contain Accessories/Add-ons',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Does_Project_Contain_Doors__c',
          label: 'Does Project Contain Doors',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'METALDoes_Project_Contain_Doors__c',
          label: 'Does Project Contain Doors?',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Does_Project_Contain_Windows__c',
          label: 'Does Project Contain Windows',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'METALDoes_Project_Contain_Windows__c',
          label: 'Does Project Contain Windows?',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Door_Notes__c',
          label: 'Door Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Door_Option_Notes__c',
          label: 'Door Option Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Door_Options__c',
          label: 'Door Options',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Door_Sill_Options__c',
          label: 'Door Sill Options',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Door_types__c',
          label: 'Door types',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Entry_Door__c',
          label: 'Entry Door',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'CloseDate',
          label: 'Estimated Contract Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Estimated_Delivery_Cost__c',
          label: 'Estimated Delivery Cost',
          type: 'Currency',
          precision: 15,
          scale: 3
        },
        {
          id: generateId(),
          apiName: 'Estimating_Current_Status__c',
          label: 'Estimating Current Status',
          type: 'LongTextArea',
          maxLength: 10000
        },
        {
          id: generateId(),
          apiName: 'Estimating_Starting_Date__c',
          label: 'Estimating Starting/Last worked on Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Estimating_Status__c',
          label: 'Estimating Status',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Estimator__c',
          label: 'Estimator',
          type: 'Lookup',
          relatedObject: 'User'
        },
        {
          id: generateId(),
          apiName: 'Estimators__c',
          label: 'Estimators',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'ETO_Bronze_thresholds_for_folding_doors__c',
          label: 'ETO Bronze thresholds for folding doors?',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'ExpectedRevenue',
          label: 'Expected Revenue',
          type: 'Currency',
          precision: 16,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Exterior_Trim_and_Casing__c',
          label: 'Exterior Trim and Casing',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Final_Adjustments__c',
          label: 'Final Adjustments',
          type: 'Number',
          precision: 18,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Final_Finish__c',
          label: 'Final Finish',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Final_Notes__c',
          label: 'Finial Type',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Finals__c',
          label: 'Finials',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Finish_Specifications__c',
          label: 'Finish Specifications',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Fixed_Options__c',
          label: 'Fixed Options',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Fixed_Unit_Notes__c',
          label: 'Fixed Unit Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Fixed_Units__c',
          label: 'Fixed Units',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Folding_Door__c',
          label: 'Folding Door',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'ForecastCategoryName',
          label: 'Forecast Category',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Glass_Notes__c',
          label: 'Glass Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Wood_Glass_Type__c',
          label: 'Glass Type',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Finish_Notes__c',
          label: 'Hardware Finish Notes',
          type: 'Text',
          maxLength: 55
        },
        {
          id: generateId(),
          apiName: 'Has_the_Job_been_Previously_Quoted__c',
          label: 'Has the Job been Previously Quoted?',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'High_Altitude__c',
          label: 'High Altitude',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Finish__c',
          label: 'Hinge Finish Specification',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Installation__c',
          label: 'Installation',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Inswing_Doors__c',
          label: 'Inswing Doors',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Inswing_Doors_Notes__c',
          label: 'Inswing Doors Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Wood_Inswing_Doors__c',
          label: 'Inswing Doors Threshold',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Inswing_Windows__c',
          label: 'Inswing Windows',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Inswing_Windows_Notes__c',
          label: 'Inswing Windows Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Is_this_a_Shared_Opportunity__c',
          label: 'Is this a Shared Opportunity',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Korn_Meeting_Notes__c',
          label: 'Korn Meeting Notes',
          type: 'RichTextArea',
          maxLength: 32768
        },
        {
          id: generateId(),
          apiName: 'Korn_Priority__c',
          label: 'Korn Priority',
          type: 'Number',
          precision: 18,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'LeadSource',
          label: 'Lead Source',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Lift_and_slide_doors__c',
          label: 'Lift and slide doors Striker Bolts',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Lift_and_Swing_Notes__c',
          label: 'Lift and Swing Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Link_to_Docs__c',
          label: 'Link to Docs',
          type: 'URL',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Loss_Reason__c',
          label: 'Loss Reason',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Loss_Reason_Notes__c',
          label: 'Loss Reason Notes',
          type: 'Text',
          maxLength: 250
        },
        {
          id: generateId(),
          apiName: 'Mesh_Type__c',
          label: 'Mesh Type',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Metal_Entry_Door__c',
          label: 'Metal Entry Door',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Metal_Finish__c',
          label: 'Metal Finish',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Metal_Fixed_Units__c',
          label: 'Metal Fixed Units',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Metal_Glass_Notes__c',
          label: 'Metal Glass Notes',
          type: 'Text',
          maxLength: 155
        },
        {
          id: generateId(),
          apiName: 'Metal_Screens__c',
          label: 'Metal Screens',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Metal_Supplier__c',
          label: 'Metal Supplier',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Air_Lux_Glass_Type__c',
          label: 'MHB & Air-Lux Glass Type',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'MHB_Glass_Stop__c',
          label: 'MHB Glass Stop',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'MHB_Handle_Types_Greatly_effects_Cost__c',
          label: 'MHB Handle Types(Greatly effects Cost)',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'MHB_Muntins__c',
          label: 'MHB Muntins',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Motorized_Unit_Notes__c',
          label: 'Motorized Unit Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Motorized_units__c',
          label: 'Motorized units?',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Motorized_Metal_Screen_Retractable_Unt__c',
          label: 'Motorized/Metal Screen/Retractable Unt?',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'New_Construction__c',
          label: 'New Construction',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'NextStep',
          label: 'Next Step',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'NOTES__c',
          label: 'NOTES',
          type: 'RichTextArea',
          maxLength: 60000
        },
        {
          id: generateId(),
          apiName: 'Notes_for_Korn__c',
          label: 'Notes for Korn',
          type: 'RichTextArea',
          maxLength: 32768
        },
        {
          id: generateId(),
          apiName: 'CurrencyIsoCode',
          label: 'Opportunity Currency',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Name',
          label: 'Opportunity Name',
          type: 'Text',
          maxLength: 120
        },
        {
          id: generateId(),
          apiName: 'Opportunity_Number__c',
          label: 'Opportunity Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'OPP-{0000}', startingNumber: 1 }
        },
        {
          id: generateId(),
          apiName: 'OwnerId',
          label: 'Opportunity Owner',
          type: 'Lookup',
          relatedObject: 'User'
        },
        {
          id: generateId(),
          apiName: 'Opportunity_Owner_TEXT__c',
          label: 'Opportunity Owner TEXT',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'RecordTypeId',
          label: 'Opportunity Record Type',
          type: 'RecordType'
        },
        {
          id: generateId(),
          apiName: 'IqScore',
          label: 'Opportunity Score',
          type: 'Number',
          precision: 9,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Optional_Product_Notes__c',
          label: 'Optional Product Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'OriginalOpportunity__c',
          label: 'Original Opportunity',
          type: 'Lookup',
          relatedObject: 'Opportunity'
        },
        {
          id: generateId(),
          apiName: 'Outswing_Door_Notes__c',
          label: 'Outswing Door Notes',
          type: 'Text',
          maxLength: 155
        },
        {
          id: generateId(),
          apiName: 'outswing__c',
          label: 'Outswing Doors',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Outswing_Door_Threshold__c',
          label: 'Outswing Doors Threshold',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Outswing_Windows__c',
          label: 'Outswing Windows',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Outswing_Windows_Notes__c',
          label: 'Outswing Windows Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'per_Sqaure_foot_cost__c',
          label: 'Per Square Foot cost',
          type: 'Currency',
          precision: 4,
          scale: 3
        },
        {
          id: generateId(),
          apiName: 'Plans_Dated__c',
          label: 'Plans Dated',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Pricebook2Id',
          label: 'Price Book',
          type: 'Lookup',
          relatedObject: 'PriceBook'
        },
        {
          id: generateId(),
          apiName: 'Job_Options__c',
          label: 'Pricing Out Options',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'CampaignId',
          label: 'Primary Campaign Source',
          type: 'Lookup',
          relatedObject: 'Campaign'
        },
        {
          id: generateId(),
          apiName: 'Priority__c',
          label: 'Priority/Next job',
          type: 'Text',
          maxLength: 70
        },
        {
          id: generateId(),
          apiName: 'IsPrivate',
          label: 'Private',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Probability',
          label: 'Probability (%)',
          type: 'Percent',
          precision: 3,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Product_Option_Locations__c',
          label: 'Product Option Locations',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Wood_Product_Options__c',
          label: 'Product Options',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Metal_Location_Specification__c',
          label: 'Product Specification',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Wood_Specifications__c',
          label: 'Product Specifications',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Project__c',
          label: 'Project',
          type: 'Lookup',
          relatedObject: 'Project'
        },
        {
          id: generateId(),
          apiName: 'Project_Addresses__c',
          label: 'Project Addresses',
          type: 'Address'
        },
        {
          id: generateId(),
          apiName: 'Project_Type__c',
          label: 'Project Type',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Projected_Contract_Date__c',
          label: 'Projected Contract Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'TotalOpportunityQuantity',
          label: 'Quantity',
          type: 'Number',
          precision: 16,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Quote_Budget__c',
          label: 'Quote Budget',
          type: 'Number',
          precision: 18,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Quote_Due__c',
          label: 'Quote Due',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Quote_Synced__c',
          label: 'Quote Synced',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Raw_Amount__c',
          label: 'Raw Amount',
          type: 'Currency',
          precision: 14,
          scale: 4
        },
        {
          id: generateId(),
          apiName: 'Job_Dimensions__c',
          label: 'Reference For unit Dimensions',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Renovation__c',
          label: 'Renovation',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Installation_notes__c',
          label: 'Required Installation Scope/Notes',
          type: 'Text',
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Retractable_Units_Notes__c',
          label: 'Retractable Units Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Retractable_Units__c',
          label: 'Retractable Units?',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date__c',
          label: 'Revision Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished__c',
          label: 'Revision Date Finished',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_2__c',
          label: 'Revision Date Finished (2)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_3__c',
          label: 'Revision Date Finished (3)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_4__c',
          label: 'Revision Date Finished (4)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_5__c',
          label: 'Revision Date Finished (5)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_6__c',
          label: 'Revision Date Finished (6)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_7__c',
          label: 'Revision Date Finished (7)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Finished_8__c',
          label: 'Revision Date Finished (8)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started__c',
          label: 'Revision Date Started',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_2__c',
          label: 'Revision Date Started (2)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_3__c',
          label: 'Revision Date Started (3)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_4__c',
          label: 'Revision Date Started (4)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_5__c',
          label: 'Revision Date Started (5)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_6__c',
          label: 'Revision Date Started (6)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_7__c',
          label: 'Revision Date Started (7)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Date_Started_8__c',
          label: 'Revision Date Started (8)',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_due_date__c',
          label: 'Revision due date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Revision_Notes__c',
          label: 'Revision Notes',
          type: 'RichTextArea',
          maxLength: 32768
        },
        {
          id: generateId(),
          apiName: 'ROI_Analysis_Completed__c',
          label: 'ROI Analysis Completed',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Roll_Screen_Location__c',
          label: 'Roll Screen Location',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Shades__c',
          label: 'Roll Shades',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Wood_Rollscreens__c',
          label: 'Rollscreens',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Sales_Rep_s__c',
          label: 'Sales Rep/s',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Salesman_Probability__c',
          label: 'Salesman Probability',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Salesman_to_Share__c',
          label: 'Salesman to Share',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Salesmen_Split__c',
          label: 'Salesmen Split',
          type: 'Text',
          maxLength: 20
        },
        {
          id: generateId(),
          apiName: 'Screen_location__c',
          label: 'Screen location',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Wood_Screens__c',
          label: 'Screens',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Searchable_Address__c',
          label: 'Searchable Address',
          type: 'Text',
          maxLength: 200
        },
        {
          id: generateId(),
          apiName: 'Searchable_Address_Formula__c',
          label: 'Searchable Address Formula',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'Searchable_Address_Updater__c',
          label: 'Searchable Address Updater',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Secondary_Account__c',
          label: 'Secondary Account on Opportunities',
          type: 'Lookup',
          relatedObject: 'Account'
        },
        {
          id: generateId(),
          apiName: 'Secondary_Account_Type__c',
          label: 'Secondary Account Type',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'Contact__c',
          label: 'Secondary Contact',
          type: 'Lookup',
          relatedObject: 'Contact'
        },
        {
          id: generateId(),
          apiName: 'Secondary_Contact_Info__c',
          label: 'Secondary Contact Info',
          type: 'Formula'
        },
        {
          id: generateId(),
          apiName: 'Security__c',
          label: 'Security',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Send_Reminder_Email__c',
          label: 'Send Reminder Email',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Shades_Location__c',
          label: 'Shades Location',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Sharepoint_URL__c',
          label: 'Sharepoint URL',
          type: 'URL',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Sill__c',
          label: 'Sill',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Sill_Notes__c',
          label: 'Sill Notes',
          type: 'Text',
          maxLength: 55
        },
        {
          id: generateId(),
          apiName: 'Single_and_Double_Hung_Windows__c',
          label: 'Single, Double, & Triple Hung Windows',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Single_Double_Hung_Notes__c',
          label: 'Single/Double Hung Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Site_Measurements__c',
          label: 'Site Measurements',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'Wood_Spacer_Bars__c',
          label: 'Spacer Bars',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'StageName',
          label: 'Stage',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'SyncedQuoteId',
          label: 'Synced Quote',
          type: 'Lookup',
          relatedObject: 'Quote'
        },
        {
          id: generateId(),
          apiName: 'Total_Discount_Price__c',
          label: 'Total Discount Price',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Total_Fields__c',
          label: 'Total Fields',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Total_Final_Sqft__c',
          label: 'Total Final/Sqft',
          type: 'Formula',
          dataType: 'Number'
        },
        {
          id: generateId(),
          apiName: 'Total_Full__c',
          label: 'Total Full',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Total_Net_Dollars__c',
          label: 'Total Net Dollars',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Total_Net_Euros__c',
          label: 'Total Net Euros',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Total_Qty__c',
          label: 'Total Qty',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Total_Sqft__c',
          label: 'Total Sqft',
          type: 'RollupSummary',
          relatedObject: 'Opportunity Product',
          aggregateFunction: 'SUM'
        },
        {
          id: generateId(),
          apiName: 'Type',
          label: 'Type',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'TotalValueLost__c',
          label: 'Value Lost',
          type: 'Formula',
          dataType: 'Currency'
        },
        {
          id: generateId(),
          apiName: 'TotalValueWon__c',
          label: 'Value Won',
          type: 'Formula',
          dataType: 'Currency'
        },
        {
          id: generateId(),
          apiName: 'Waterfront_Exposure__c',
          label: 'Waterfront Exposure',
          type: 'Checkbox'
        },
        {
          id: generateId(),
          apiName: 'When_is_Product_Required_Onsite__c',
          label: 'When is Product Required Onsite?',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Who_is_it_quoted_to_information__c',
          label: 'Who is it quoted to information',
          type: 'Formula',
          dataType: 'Text'
        },
        {
          id: generateId(),
          apiName: 'Who_is_the_Quote__c',
          label: 'Who is this Quoted to?',
          type: 'Lookup',
          relatedObject: 'Contact'
        },
        {
          id: generateId(),
          apiName: 'Wind_Speed_MPH__c',
          label: 'Wind Load Speed MPH',
          type: 'Number',
          precision: 18,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Wood_Hardware__c',
          label: 'Window Hardware',
          type: 'Picklist'
        },
        {
          id: generateId(),
          apiName: 'Window_Note__c',
          label: 'Window Note',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Window_Option_Notes__c',
          label: 'Window Option Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Window_Options__c',
          label: 'Window Options',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Window_Type__c',
          label: 'Window Type',
          type: 'MultiSelectPicklist'
        },
        {
          id: generateId(),
          apiName: 'Wood_Exterior_Trim_and_Casing__c',
          label: 'Wood Exterior Trim and Casing',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Wood_Notes__c',
          label: 'Wood Notes',
          type: 'TextArea',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Wood_Type__c',
          label: 'Wood Type',
          type: 'Picklist'
        }
      ];

    const buildLayoutFromLabels = (
      layoutName: string,
      layoutType: 'create' | 'edit',
      fields: FieldDef[],
      sectionDefs: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }>
    ) => {
      const fieldMap = new Map(fields.map((field) => [field.label, field.apiName]));
      const missing = new Set<string>();

      const sections = sectionDefs.map((section, sectionIndex) => {
        const sectionFields = section.fields
          .map((label, index) => {
            const apiName = fieldMap.get(label) || fields.find((f) => f.apiName === label)?.apiName;
            if (!apiName) {
              missing.add(label);
              return null;
            }
            return {
              apiName,
              column: index % section.columns,
              order: index
            };
          })
          .filter(Boolean) as Array<{ apiName: string; column: number; order: number }>;

        return {
          id: generateId(),
          label: section.label,
          columns: section.columns,
          order: sectionIndex,
          fields: sectionFields
        };
      });

      if (missing.size > 0) {
        console.warn('[Schema] Missing Property fields for Wood template:', Array.from(missing));
      }

      return {
        id: generateId(),
        name: layoutName,
        layoutType,
        tabs: [
          {
            id: generateId(),
            label: 'Details',
            order: 0,
            sections
          }
        ]
      };
    };

    const propertyWoodLayout = buildLayoutFromLabels(
      'Property - Wood Template',
      'create',
      propertyFields,
      PROPERTY_WOOD_LAYOUT_SECTIONS
    );

    const propertyRecordType = createDefaultRecordType('Property', propertyWoodLayout.id);

    objects.push({
      id: generateId(),
      apiName: 'Property',
      label: 'Property',
      pluralLabel: 'Properties',
      description: 'Physical locations and real estate properties',
      createdAt: now,
      updatedAt: now,
      fields: [...SYSTEM_FIELDS, ...propertyFields.map((field) => ({ ...field, custom: true }))],
      recordTypes: [propertyRecordType],
      pageLayouts: [propertyWoodLayout],
      validationRules: [],
      defaultRecordTypeId: propertyRecordType.id
    });

    // Home Page
    const homeLayoutId = generateId();
    const homeTabId = generateId();
    const homeSectionId = generateId();
    const homeRecordType = createDefaultRecordType('Home', homeLayoutId);
    objects.push({
      id: generateId(),
      apiName: 'Home',
      label: 'Home Page',
      pluralLabel: 'Home Page',
      description: 'Homepage layout and panels',
      createdAt: now,
      updatedAt: now,
      fields: [
        ...SYSTEM_FIELDS,
        {
          id: generateId(),
          apiName: 'Home__ReportsPanel',
          label: 'Reports Panel',
          type: 'Text',
          custom: true,
        },
        {
          id: generateId(),
          apiName: 'Home__DashboardsPanel',
          label: 'Dashboards Panel',
          type: 'Text',
          custom: true,
        },
      ],
      recordTypes: [homeRecordType],
      pageLayouts: [
        {
          id: homeLayoutId,
          name: 'Home Layout',
          layoutType: 'edit',
          tabs: [
            {
              id: homeTabId,
              label: 'Home',
              order: 0,
              sections: [
                {
                  id: homeSectionId,
                  label: 'Main',
                  columns: 2,
                  order: 0,
                  fields: [
                    { apiName: 'Home__ReportsPanel', column: 0, order: 0 },
                    { apiName: 'Home__DashboardsPanel', column: 1, order: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      validationRules: [],
      defaultRecordTypeId: homeRecordType.id,
    });

    // 2. Contact (with custom page layout)
    const contactFields = [
        // Contact Information Section
        {
          id: generateId(),
          apiName: 'Contact__salutation',
          label: 'Salutation',
          type: 'Picklist',
          picklistValues: ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.'],
          maxLength: 10,
          helpText: 'Designated salutation for the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__firstName',
          label: 'First Name',
          type: 'Text',
          required: true,
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
          apiName: 'Contact__account',
          label: 'Account',
          type: 'Text',
          maxLength: 255,
          helpText: 'Indicates the account for the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__contactType',
          label: 'Contact Type',
          type: 'Picklist',
          picklistValues: ['Architect', 'Associate', 'CEO', 'Client/Homeowner', 'Designer', 'Engineer', 'Property Manager', 'Project Manager', 'President'],
          helpText: 'Indicates the role of the contact at their company'
        },
        {
          id: generateId(),
          apiName: 'Contact__title',
          label: 'Title',
          type: 'Picklist',
          picklistValues: ['Senior Architect', 'Junior Architect', 'Executive Assistant', 'Senior Engineer', 'Junior Engineer', 'Lead Designer', 'Project Coordinator'],
          helpText: 'Indicates more specifically the job title of the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__reportsTo',
          label: 'Reports To',
          type: 'Text',
          maxLength: 255,
          helpText: 'Indicates relationship with another contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__status',
          label: 'Status',
          type: 'Picklist',
          required: true,
          picklistValues: ['Active', 'Inactive'],
          defaultValue: 'Active',
          helpText: 'Change Status to Inactive after 8 months of no activity'
        },
        {
          id: generateId(),
          apiName: 'Contact__primaryEmail',
          label: 'Primary Email',
          type: 'Email',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Contact__secondaryEmail',
          label: 'Secondary Email',
          type: 'Email',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Contact__primaryPhone',
          label: 'Primary Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__secondaryPhone',
          label: 'Secondary Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__fax',
          label: 'Fax',
          type: 'Phone',
          maxLength: 40
        },
        // Address Information Section
        {
          id: generateId(),
          apiName: 'Contact__primaryAddress',
          label: 'Primary Address',
          type: 'TextArea',
          maxLength: 500,
          helpText: 'Used for mailing'
        },
        {
          id: generateId(),
          apiName: 'Contact__secondaryAddress',
          label: 'Secondary Address',
          type: 'TextArea',
          maxLength: 500,
          helpText: 'Used as needed'
        },
        {
          id: generateId(),
          apiName: 'Contact__poBox',
          label: 'PO Box',
          type: 'RichTextArea',
          maxLength: 255,
          helpText: 'Used as needed'
        },
        // Associated Properties Section
        {
          id: generateId(),
          apiName: 'Contact__associatedProperties',
          label: 'Associated Properties',
          type: 'TextArea',
          maxLength: 2000,
          helpText: 'Indicates all property records that are connected to the contact'
        },
        // Notes Section
        {
          id: generateId(),
          apiName: 'Contact__notes',
          label: 'Contact Notes',
          type: 'RichTextArea',
          maxLength: 32000,
          helpText: 'Records any pertinent information regarding contact'
        },
        // System Information Section
        {
          id: generateId(),
          apiName: 'Contact__contactOwner',
          label: 'Contact Owner',
          type: 'Text',
          maxLength: 255,
          helpText: 'Indicates User who manages the contact'
        },
        // Additional Contact Fields
        {
          id: generateId(),
          apiName: 'Contact__active',
          label: 'Active',
          type: 'Checkbox',
          helpText: 'Indicates if the contact is active'
        },
        {
          id: generateId(),
          apiName: 'Contact__assistant',
          label: 'Assistant',
          type: 'Text',
          maxLength: 40,
          helpText: 'Name of the contact\'s assistant'
        },
        {
          id: generateId(),
          apiName: 'Contact__assistantPhone',
          label: 'Assistant Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__birthdate',
          label: 'Birthdate',
          type: 'Date',
          helpText: 'Contact\'s date of birth'
        },
        {
          id: generateId(),
          apiName: 'Contact__buyerAttributes',
          label: 'Buyer Attributes',
          type: 'MultiPicklist',
          picklistValues: ['End User', 'Influencer', 'Economic Buyer', 'Technical Buyer', 'Other'],
          helpText: 'Attributes that describe this buyer'
        },
        {
          id: generateId(),
          apiName: 'Contact__contactCurrency',
          label: 'Contact Currency',
          type: 'Picklist',
          picklistValues: ['USD', 'CAD', 'EUR', 'GBP', 'JPY', 'AUD'],
          helpText: 'Contact\'s preferred currency'
        },
        {
          id: generateId(),
          apiName: 'Contact__contactSource',
          label: 'Contact Source',
          type: 'Picklist',
          picklistValues: ['Web', 'Phone', 'Email', 'Referral', 'Trade Show', 'Other'],
          helpText: 'Indicates the origin of the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__creationSource',
          label: 'Creation Source',
          type: 'Picklist',
          picklistValues: ['API', 'Import', 'Web', 'Form', 'Manual'],
          helpText: 'Source of contact creation'
        },
        {
          id: generateId(),
          apiName: 'Contact__dataComKey',
          label: 'Data.com Key',
          type: 'Text',
          maxLength: 20,
          helpText: 'Unique identifier from Data.com'
        },
        {
          id: generateId(),
          apiName: 'Contact__department',
          label: 'Department',
          type: 'Text',
          maxLength: 80,
          helpText: 'Department name for the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__departmentGroup',
          label: 'Department Group',
          type: 'Picklist',
          picklistValues: ['Executive', 'Finance', 'Operations', 'Sales', 'Marketing', 'Technical', 'Other'],
          helpText: 'Broader grouping of the department'
        },
        {
          id: generateId(),
          apiName: 'Contact__description',
          label: 'Description',
          type: 'RichTextArea',
          maxLength: 32000,
          helpText: 'General description of the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__doNotCall',
          label: 'Do Not Call',
          type: 'Checkbox',
          helpText: 'Indicates contact prefers not to be called'
        },
        {
          id: generateId(),
          apiName: 'Contact__emailOptOut',
          label: 'Email Opt Out',
          type: 'Checkbox',
          helpText: 'Indicates contact has opted out of email communications'
        },
        {
          id: generateId(),
          apiName: 'Contact__faxOptOut',
          label: 'Fax Opt Out',
          type: 'Checkbox',
          helpText: 'Indicates contact has opted out of fax communications'
        },
        {
          id: generateId(),
          apiName: 'Contact__genderIdentity',
          label: 'Gender Identity',
          type: 'Picklist',
          picklistValues: ['Not Specified', 'Male', 'Female', 'Non-Binary', 'Prefer to Self Describe'],
          helpText: 'Contact\'s gender identity'
        },
        {
          id: generateId(),
          apiName: 'Contact__generalNotes',
          label: 'General Notes',
          type: 'RichTextArea',
          maxLength: 32768,
          helpText: 'General notes about the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__homePhone',
          label: 'Home Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__lastCURequestDate',
          label: 'Last Stay-in-Touch Request Date',
          type: 'DateTime',
          helpText: 'Date when last stay-in-touch request was made'
        },
        {
          id: generateId(),
          apiName: 'Contact__lastCUUpdateDate',
          label: 'Last Stay-in-Touch Save Date',
          type: 'DateTime',
          helpText: 'Date when stay-in-touch information was last updated'
        },
        {
          id: generateId(),
          apiName: 'Contact__leadSource',
          label: 'Lead Source',
          type: 'Picklist',
          picklistValues: ['Web', 'Phone', 'Email', 'Referral', 'Trade Show', 'Other'],
          helpText: 'Source of the contact if originated as a lead'
        },
        {
          id: generateId(),
          apiName: 'Contact__mobile',
          label: 'Mobile',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__otherPhone',
          label: 'Other Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Contact__pronouns',
          label: 'Pronouns',
          type: 'Picklist',
          picklistValues: ['He/Him', 'She/Her', 'They/Them', 'He/They', 'She/They', 'Other'],
          helpText: 'Contact\'s preferred pronouns'
        },
        {
          id: generateId(),
          apiName: 'Contact__productInstaller',
          label: 'Product Installer',
          type: 'Checkbox',
          helpText: 'Indicates if contact is a product installer'
        },
        {
          id: generateId(),
          apiName: 'Contact__seniorityLevel',
          label: 'Seniority Level',
          type: 'Picklist',
          picklistValues: ['Executive', 'Senior Manager', 'Manager', 'Senior Individual Contributor', 'Individual Contributor'],
          helpText: 'Indicates the seniority level of the contact'
        },
        {
          id: generateId(),
          apiName: 'Contact__serviceTechnician',
          label: 'Service Technician',
          type: 'Checkbox',
          helpText: 'Indicates if contact is a service technician'
        }
      ];

    const contactLayout = buildLayoutFromLabels(
      'Contact - Default Template',
      'edit',
      contactFields,
      CONTACT_LAYOUT_SECTIONS
    );

    const contactRecordType = createDefaultRecordType('Contact', contactLayout.id);
    
    // Create Contact object with custom layout
    objects.push({
      id: generateId(),
      apiName: 'Contact',
      label: 'Contact',
      pluralLabel: 'Contacts',
      description: 'People and their contact information',
      createdAt: now,
      updatedAt: now,
      fields: [...SYSTEM_FIELDS, ...contactFields.map(f => ({ ...f, custom: true }))],
      recordTypes: [contactRecordType],
      pageLayouts: [contactLayout],
      validationRules: [],
      defaultRecordTypeId: contactRecordType.id
    });

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
        },
        {
          id: generateId(),
          apiName: 'Account__parentAccount',
          label: 'Parent Account',
          type: 'Lookup',
          lookupObject: 'Account',
          relationshipName: 'Parent Accounts'
        },
        {
          id: generateId(),
          apiName: 'Account__description',
          label: 'Description',
          type: 'TextArea',
          maxLength: 2000
        },
        {
          id: generateId(),
          apiName: 'Account__shippingAddress',
          label: 'Shipping Address',
          type: 'Address'
        },
        {
          id: generateId(),
          apiName: 'Account__billingAddress',
          label: 'Billing Address',
          type: 'Address'
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
          apiName: 'Product__family',
          label: 'Product Family',
          type: 'Picklist',
          picklistValues: ['Core', 'Premium', 'Custom', 'Legacy']
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
          apiName: 'Product__currency',
          label: 'Product Currency',
          type: 'Text',
          maxLength: 10
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
          label: 'Product Description',
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
          picklistValues: ['Not Contacted', 'Contacted', 'Attempted to Contact', 'Contact in Future', 'Do not Contact'],
          defaultValue: 'Not Contacted'
        },
        {
          id: generateId(),
          apiName: 'Lead__leadSource',
          label: 'Lead Source',
          type: 'Picklist',
          picklistValues: ['Referral', 'Social Media', 'Tischler Website', 'Cold Call', 'Other']
        },
        {
          id: generateId(),
          apiName: 'Lead__leadType',
          label: 'Lead Type',
          type: 'Picklist',
          picklistValues: ['Architect', 'Client/Homeowner', 'Property Manager', 'Contractor', 'Designer', 'Associate']
        },
        {
          id: generateId(),
          apiName: 'Lead__leadOwner',
          label: 'Lead Owner',
          type: 'Lookup',
          lookupObject: 'User',
          relationshipName: 'Lead Owners'
        },
        {
          id: generateId(),
          apiName: 'Lead__competitors',
          label: 'Competitors',
          type: 'MultiSelectPicklist',
          picklistValues: ['Reilly Architectural', 'Peetz Windows and Doors, Inc', 'Hartman Doors and Windows', 'Trade Wood Industries', 'Other']
        },
        {
          id: generateId(),
          apiName: 'Lead__closeDate',
          label: 'Close Date',
          type: 'Date'
        },
        {
          id: generateId(),
          apiName: 'Lead__confidenceLevel',
          label: 'Confidence Level',
          type: 'Text',
          maxLength: 100
        },
        {
          id: generateId(),
          apiName: 'Lead__saleType',
          label: 'Type of Sale',
          type: 'Picklist',
          picklistValues: ['Product', 'Service', 'Solution']
        },
        {
          id: generateId(),
          apiName: 'Lead__singleSalesObjective',
          label: 'Single Sales Objective',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__contactName',
          label: 'Name',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__account',
          label: 'Account',
          type: 'Lookup',
          lookupObject: 'Account',
          relationshipName: 'Accounts'
        },
        {
          id: generateId(),
          apiName: 'Lead__primaryEmail',
          label: 'Primary Email',
          type: 'Email',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__secondaryEmail',
          label: 'Secondary Email',
          type: 'Email',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__primaryPhone',
          label: 'Primary Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Lead__secondaryPhone',
          label: 'Secondary Phone',
          type: 'Phone',
          maxLength: 40
        },
        {
          id: generateId(),
          apiName: 'Lead__property',
          label: 'Property',
          type: 'Lookup',
          lookupObject: 'Property',
          relationshipName: 'Properties'
        },
        {
          id: generateId(),
          apiName: 'Lead__propertyAddress',
          label: 'Property Address',
          type: 'TextArea',
          maxLength: 2000
        },
        {
          id: generateId(),
          apiName: 'Lead__role',
          label: 'Role',
          type: 'Picklist',
          picklistValues: ['Economic', 'Technical', 'User', 'Coach']
        },
        {
          id: generateId(),
          apiName: 'Lead__mode',
          label: 'Mode',
          type: 'Picklist',
          picklistValues: ['Growth', 'Trouble', 'Even Keel', 'Overconfident']
        },
        {
          id: generateId(),
          apiName: 'Lead__rating',
          label: 'Rating',
          type: 'Picklist',
          picklistValues: ['Hot', 'Warm', 'Cold']
        },
        {
          id: generateId(),
          apiName: 'Lead__degreesOfInfluence',
          label: 'Degrees of Influence',
          type: 'Picklist',
          picklistValues: ['Low', 'Medium', 'High']
        },
        {
          id: generateId(),
          apiName: 'Lead__buyingInfluence',
          label: 'Buying Influence',
          type: 'Text',
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Lead__baseCoverage',
          label: 'Base Coverage',
          type: 'RichTextArea'
        },
        {
          id: generateId(),
          apiName: 'Lead__summaryStrengths',
          label: 'Summary of Position: Strengths',
          type: 'RichTextArea'
        },
        {
          id: generateId(),
          apiName: 'Lead__summaryRedFlags',
          label: 'Summary of Position: Red Flags',
          type: 'RichTextArea'
        },
        {
          id: generateId(),
          apiName: 'Lead__actions',
          label: 'Actions',
          type: 'MultiSelectPicklist',
          picklistValues: ['Call', 'Email', 'Schedule Meeting', 'Send Quote', 'Follow Up']
        },
        {
          id: generateId(),
          apiName: 'Lead__leadNotes',
          label: 'Lead Notes',
          type: 'RichTextArea'
        },
        {
          id: generateId(),
          apiName: 'Lead__sharepointFiles',
          label: 'Sharepoint Files',
          type: 'TextArea',
          maxLength: 2000
        },
        {
          id: generateId(),
          apiName: 'Lead__leadNumber',
          label: 'Lead Number',
          type: 'AutoNumber',
          autoNumber: { displayFormat: 'L{00}', startingNumber: 1 }
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

    const baseSchema: OrgSchema = {
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

    return this.ensureDealTemplateLayout(
      this.ensureLeadTemplateLayout(
        this.ensureProductTemplateLayout(
          this.ensureAccountTemplateLayout(
            this.ensureContactTemplateLayout(
              this.ensurePropertyWoodLayout(
                this.ensureRelationshipFields(baseSchema)
              )
            )
          )
        )
      )
    );
  }

  async resetSchema(): Promise<OrgSchema> {
    // Clear cached schema from localStorage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(VERSIONS_KEY);
    
    // Create fresh schema with all new fields
    const freshSchema = this.createSampleData();
    
    // Save to localStorage
    await this.saveSchema(freshSchema);
    
    return freshSchema;
  }
}

// Export singleton instance
export const schemaService = new LocalStorageSchemaService();