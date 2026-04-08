import { OrgSchema, ObjectDef, FieldDef, generateId, createDefaultPageLayout, createDefaultRecordType, SYSTEM_FIELDS, cloneSystemFields, normalizeFieldType, PageLayout, LayoutSection, PanelField } from './schema';
import { apiClient } from './api-client';

const STORAGE_KEY = 'tces-object-manager-schema';
const VERSIONS_KEY = 'tces-object-manager-versions';

const PROPERTY_WOOD_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Address',
    columns: 2,
    fields: [
      'Address',
      'Property Number'
    ]
  },
  {
    label: 'Contact Information',
    columns: 2,
    fields: [
      'Contacts',
      'Accounts'
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

const CONTACT_LAYOUT_SECTIONS: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }> = [
  {
    label: 'Contact Information',
    columns: 2,
    fields: [
      'Name',
      'Salutation',
      'First Name',
      'Middle Name',
      'Last Name',
      'Account',
      'Contact Type',
      'Title',
      'Reports To',
      'Status',
      'Primary Email',
      'Secondary Email',
      'Primary Phone',
      'Secondary Phone',
      'Fax'
    ]
  },
  {
    label: 'Address Information',
    columns: 2,
    fields: [
      'Primary Address',
      'Secondary Address',
      'PO Box'
    ]
  },
  {
    label: 'Associated Properties',
    columns: 1,
    fields: [
      'Associated Properties'
    ]
  },
  {
    label: 'Notes',
    columns: 1,
    fields: [
      'Contact Notes'
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
  async loadSchema(): Promise<OrgSchema> {
    // Try to load from API first
    try {
      const result = await apiClient.getSetting(STORAGE_KEY);
      if (result && result.value) {
        const schema = result.value as OrgSchema;

        // Normalise field types so DB variants (lowercase, aliases like
        // "MultiSelectPicklist") map to canonical FieldType values used by
        // the DynamicForm switch statement.
        // IMPORTANT: create new field objects to avoid mutating shared references.
        for (const obj of schema.objects) {
          obj.fields = obj.fields.map(field => {
            const normalized = normalizeFieldType(field.type);
            return normalized !== field.type ? { ...field, type: normalized } : field;
          });
        }
        
        // Run the same migrations/fixes as before
        const contactObj = (schema as any).objects?.find((o: any) => o.apiName === 'Contact');
        if (contactObj) {
          const nameFieldIndex = contactObj.fields?.findIndex((f: any) => f.apiName === 'Contact__name');
          if (nameFieldIndex === -1) {
            const nameField = {
              id: Math.random().toString(36).substr(2, 9),
              apiName: 'Contact__name',
              label: 'Name',
              type: 'CompositeText',
              maxLength: 255,
              helpText: 'Full name of the contact',
              custom: true,
              subFields: [
                { apiName: 'Contact__name_salutation', label: 'Salutation', type: 'Picklist' },
                { apiName: 'Contact__name_firstName', label: 'First Name', type: 'Text' },
                { apiName: 'Contact__name_lastName', label: 'Last Name', type: 'Text' }
              ]
            };
            const systemFieldCount = contactObj.fields.filter((f: any) => SYSTEM_FIELDS.some(sf => sf.apiName === f.apiName)).length;
            contactObj.fields.splice(systemFieldCount, 0, nameField);
            await this.saveSchema(schema);
            return schema;
          } else if (nameFieldIndex >= 0 && contactObj.fields[nameFieldIndex].type !== 'CompositeText') {
            contactObj.fields[nameFieldIndex] = {
              ...contactObj.fields[nameFieldIndex],
              type: 'CompositeText',
              readOnly: false,
              helpText: 'Full name of the contact',
              subFields: [
                { apiName: 'Contact__name_salutation', label: 'Salutation', type: 'Picklist' },
                { apiName: 'Contact__name_firstName', label: 'First Name', type: 'Text' },
                { apiName: 'Contact__name_lastName', label: 'Last Name', type: 'Text' }
              ]
            };
            await this.saveSchema(schema);
            return schema;
          }
        }
        
        let migratedSchema = this.ensureCustomFieldsMarked(schema);
        migratedSchema = this.ensureHomeObject(migratedSchema);
        migratedSchema = this.ensureRelationshipFields(migratedSchema);
        migratedSchema = this.ensurePropertyWoodLayout(migratedSchema);
        migratedSchema = this.ensureContactTemplateLayout(migratedSchema);
        migratedSchema = this.ensureAccountTemplateLayout(migratedSchema);
        migratedSchema = this.ensureProductTemplateLayout(migratedSchema);
        migratedSchema = this.ensureLeadTemplateLayout(migratedSchema);
        migratedSchema = this.ensureOpportunityTemplateLayout(migratedSchema);

        // Universal: ensure every object has at least one layout with populated fields
        migratedSchema = this.ensureAllObjectsHavePopulatedLayout(migratedSchema);

        // Ensure system field definitions are up-to-date (type, readOnly, etc.)
        migratedSchema = this.migrateSystemFieldTypes(migratedSchema);

        // Self-contained layouts: embed full FieldDef into every PageField
        // so DynamicForm never needs to cross-reference object.fields.
        migratedSchema = this.enrichLayoutFieldDefs(migratedSchema);

        // Ensure all default objects exist — if the schema was saved when some
        // objects were missing (e.g. partial save), merge them back in
        const defaultSchema = this.createSampleData();
        const existingApiNames = new Set(migratedSchema.objects.map(o => o.apiName));
        let addedMissingObjects = false;
        for (const defaultObj of defaultSchema.objects) {
          if (!existingApiNames.has(defaultObj.apiName)) {
            migratedSchema.objects.push(defaultObj);
            addedMissingObjects = true;
          }
        }

        if (migratedSchema !== schema || addedMissingObjects) {
          await this.saveSchema(migratedSchema);
        }
        
        return migratedSchema;
      }
    } catch (err) {
      console.warn('[Schema] Could not load from API, trying localStorage migration:', err);
    }

    // Migration: try reading from localStorage and push to API
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const schema = JSON.parse(stored);
          // Try to save to API (best-effort)
          try {
            await this.saveSchema(schema);
            // Only clear localStorage after successful API save
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(VERSIONS_KEY);
            localStorage.removeItem('schema-store');
            localStorage.removeItem('propertyLayoutAssociations');
          } catch (saveErr) {
            console.warn('[Schema] Could not save to API yet, using localStorage schema:', saveErr);
          }
          return schema;
        } catch (error) {
          console.error('Failed to parse localStorage schema:', error);
        }
      }
    }
    
    // No schema anywhere — create default and save to API
    const defaultSchema = this.createSampleData();
    try {
      await this.saveSchema(defaultSchema);
    } catch (saveErr) {
      console.warn('[Schema] Could not save default schema to API:', saveErr);
    }
    return defaultSchema;
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
        ...cloneSystemFields(),
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
              regions: [
                {
                  id: sectionId,
                  label: 'Main',
                  gridColumn: 1, gridColumnSpan: 1, gridRow: 1, gridRowSpan: 1,
                  style: {},
                  widgets: [],
                  panels: [
                    {
                      id: sectionId + '_panel',
                      label: 'Main',
                      order: 0,
                      columns: 2 as 1 | 2 | 3 | 4,
                      style: {},
                      fields: [
                        { fieldApiName: 'Home__ReportsPanel', colSpan: 1, order: 0, labelStyle: {}, valueStyle: {}, behavior: 'none' as const },
                        { fieldApiName: 'Home__DashboardsPanel', colSpan: 1, order: 1, labelStyle: {}, valueStyle: {}, behavior: 'none' as const },
                      ],
                    },
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
          if (tabIndex !== 0 || !tab.regions?.length || !tab.regions[0]?.panels?.length || !tab.regions[0].panels[0]) return tab;
          const region = tab.regions[0]!;
          const panel = region.panels[0]!;
          const existingFieldApi = new Set(panel.fields.map((f) => f.fieldApiName));
          const relationshipFields = fields.filter((field) =>
            (field.type === 'Lookup' || field.type === 'ExternalLookup') &&
            !existingFieldApi.has(field.apiName)
          );

          if (relationshipFields.length === 0) return tab;

          const nextFields = panel.fields.slice();
          const nextOrderStart = nextFields.length;

          relationshipFields.forEach((field, index) => {
            nextFields.push({
              fieldApiName: field.apiName,
              colSpan: 1,
              order: nextOrderStart + index,
              labelStyle: {},
              valueStyle: {},
              behavior: 'none' as const,
            });
          });

          return {
            ...tab,
            regions: [
              {
                ...region,
                panels: [
                  {
                    ...panel,
                    fields: nextFields,
                  },
                  ...region.panels.slice(1),
                ],
              },
              ...tab.regions.slice(1),
            ],
          };
        });

        return {
          ...layout,
          tabs
        };
      });

      return { ...source, fields, pageLayouts: updatedLayouts as PageLayout[], updatedAt: new Date().toISOString() };
    });

    if (!updated) {
      return schema;
    }

    return {
      ...schema,
      objects: objects as ObjectDef[],
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Universal fallback: for every object (except Home), if it has no page layout
   * with populated fields, auto-generate a layout from the object's custom fields.
   * This ensures every object is usable in the dynamic form without needing a
   * specific ensure*TemplateLayout method.
   */
  private ensureAllObjectsHavePopulatedLayout(schema: OrgSchema): OrgSchema {
    const excludedObjects = new Set(['Home']);
    let changed = false;

    const objects = schema.objects.map((obj) => {
      if (excludedObjects.has(obj.apiName)) return obj;

      const systemFieldApiNames = new Set(SYSTEM_FIELDS.map((f) => f.apiName));

      // Check if ANY layout has ANY fields at all (including relationship lookups).
      // A user who explicitly saves a layout in the Page Editor — even one containing
      // only relationship lookups — has made a deliberate choice that we must respect.
      const hasAnyPopulatedLayout = (obj.pageLayouts || []).some((layout) =>
        layout.tabs?.some((tab) =>
          tab.regions?.some((region) =>
            region.panels?.some((panel) =>
              (panel.fields?.length || 0) > 0
            )
          )
        )
      );

      if (hasAnyPopulatedLayout) return obj;

      // Also skip if the default record type already points to an existing layout
      // (the user may have saved a layout via the Page Editor that set this assignment).
      const defaultRt = obj.defaultRecordTypeId
        ? obj.recordTypes?.find((rt) => rt.id === obj.defaultRecordTypeId)
        : obj.recordTypes?.[0];
      if (defaultRt?.pageLayoutId) {
        const assignedLayout = (obj.pageLayouts || []).find((l) => l.id === defaultRt.pageLayoutId);
        if (assignedLayout) return obj;
      }

      // No populated layout — auto-generate one from the object's fields
      const customFields = obj.fields.filter(
        (f) => !systemFieldApiNames.has(f.apiName) && f.apiName.startsWith(`${obj.apiName}__`) &&
               f.type !== 'AutoNumber' && f.type !== 'Formula' && f.type !== 'RollupSummary'
      );

      const readOnlyFields = obj.fields.filter(
        (f) => !systemFieldApiNames.has(f.apiName) && f.apiName.startsWith(`${obj.apiName}__`) &&
               (f.type === 'AutoNumber' || f.type === 'Formula' || f.type === 'RollupSummary')
      );

      // Include relationship lookups too (fields without prefix, like ContactId)
      const relationshipFields = obj.fields.filter(
        (f) => !systemFieldApiNames.has(f.apiName) && !f.apiName.startsWith(`${obj.apiName}__`) &&
               (f.type === 'Lookup' || f.type === 'ExternalLookup')
      );

      const allLayoutFields = [...customFields, ...readOnlyFields, ...relationshipFields];

      if (allLayoutFields.length === 0) return obj;

      const layoutId = generateId();
      const regionId = generateId();
      const panelId = generateId();
      const layout = {
        id: layoutId,
        name: `${obj.apiName} - Default Template`,
        layoutType: 'edit' as const,
        tabs: [
          {
            id: generateId(),
            label: 'Details',
            order: 0,
            regions: [
              {
                id: regionId,
                label: `${obj.label} Information`,
                gridColumn: 1,
                gridColumnSpan: 1,
                gridRow: 1,
                gridRowSpan: 1,
                style: {},
                widgets: [],
                panels: [
                  {
                    id: panelId,
                    label: `${obj.label} Information`,
                    order: 0,
                    columns: 2 as 1 | 2 | 3 | 4,
                    style: {},
                    fields: allLayoutFields.map((f, index) => ({
                      fieldApiName: f.apiName,
                      colSpan: 1,
                      order: index,
                      labelStyle: {},
                      valueStyle: {},
                      behavior: 'none' as const,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      // Only update record type assignment if it doesn't already point to an existing layout
      const updatedRecordTypes = obj.recordTypes.map((rt, index) => {
        const isDefault = obj.defaultRecordTypeId
          ? rt.id === obj.defaultRecordTypeId
          : index === 0;
        if (!isDefault) return rt;
        // If the record type already points to an existing layout, leave it alone
        const alreadyAssigned = rt.pageLayoutId && (obj.pageLayouts || []).some((l) => l.id === rt.pageLayoutId);
        if (alreadyAssigned) return rt;
        return { ...rt, pageLayoutId: layoutId };
      });

      // Keep any existing layouts that have any fields; replace only empty ones
      const existingWithFields = (obj.pageLayouts || []).filter((l) =>
        l.tabs?.some((t) => t.regions?.some((r) =>
          r.panels?.some((p) => (p.fields?.length || 0) > 0)
        ))
      );

      changed = true;
      return {
        ...obj,
        pageLayouts: [...existingWithFields, layout],
        recordTypes: updatedRecordTypes,
        updatedAt: new Date().toISOString()
      };
    });

    if (!changed) return schema;

    return {
      ...schema,
      objects,
      updatedAt: new Date().toISOString()
    };
  }

  /**
   * Enrich every PageField inside every layout with the full FieldDef
   * properties from the parent object.  After this step, each PageField
   * carries its own label, type, required flag, picklist values, etc.
   * so DynamicForm can render without cross-referencing object.fields.
   *
   * Runs on every schema load (fast, in-memory only — not persisted)
   * so field definition changes propagate automatically.
   */
  private enrichLayoutFieldDefs(schema: OrgSchema): OrgSchema {
    for (const obj of schema.objects) {
      const fieldMap = new Map(obj.fields.map(f => [f.apiName, f]));
      for (const layout of obj.pageLayouts || []) {
        for (const tab of layout.tabs || []) {
          for (const region of tab.regions || []) {
            for (const panel of region.panels || []) {
              panel.fields = (panel.fields || []).map(pf => {
                const fieldDef = fieldMap.get(pf.fieldApiName);
                if (!fieldDef) return pf; // field not found — leave as-is
                // Enrich the PanelField with full FieldDef props so DynamicForm
                // can render without cross-referencing object.fields.
                const { apiName, ...rest } = fieldDef;
                return {
                  ...rest,
                  ...pf,
                  type: normalizeFieldType(fieldDef.type),
                  lookupObject: fieldDef.lookupObject,
                  relationshipName: fieldDef.relationshipName,
                } as any;
              });
            }
          }
        }
      }
    }
    return schema;
  }

  /**
   * Migrate system field definitions so persisted schemas match the
   * canonical types defined in SYSTEM_FIELDS (e.g. CreatedById → LookupUser).
   */
  private migrateSystemFieldTypes(schema: OrgSchema): OrgSchema {
    const canonical = new Map(SYSTEM_FIELDS.map(f => [f.apiName, f]));
    let changed = false;

    for (const obj of schema.objects) {
      for (let i = 0; i < obj.fields.length; i++) {
        const sf = canonical.get(obj.fields[i].apiName);
        if (!sf) continue;
        const cur = obj.fields[i];
        if (cur.type !== sf.type || cur.readOnly !== sf.readOnly) {
          obj.fields[i] = { ...cur, type: sf.type, readOnly: sf.readOnly };
          changed = true;
        }
      }
    }

    return changed ? { ...schema, updatedAt: new Date().toISOString() } : schema;
  }

  private ensurePropertyWoodLayout(schema: OrgSchema): OrgSchema {
    // No-op: Hard-coded template layouts are no longer auto-injected.
    // The universal ensureAllObjectsHavePopulatedLayout method will
    // generate a layout if the object has none. Users may delete
    // templates via the Page Editor without them reappearing.
    return schema;
  }

  private ensureContactTemplateLayout(schema: OrgSchema): OrgSchema {
    // No-op: Contact layouts are now handled by the universal
    // ensureAllObjectsHavePopulatedLayout method. Previously this
    // method removed the "Contact - Default Template" but that
    // conflicts with universal auto-generation.
    return schema;
  }

  private ensureAccountTemplateLayout(schema: OrgSchema): OrgSchema {
    const account = schema.objects.find((obj) => obj.apiName === 'Account');
    if (!account) return schema;

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

    // Only ensure required fields exist on the object.
    // Hard-coded template layouts are no longer auto-injected;
    // ensureAllObjectsHavePopulatedLayout will generate a layout if needed.
    if (requiredFields.length > 0) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Account'
            ? { ...obj, fields: mergedFields, updatedAt: new Date().toISOString() }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }
    return schema;
  }

  private ensureProductTemplateLayout(schema: OrgSchema): OrgSchema {
    const product = schema.objects.find((obj) => obj.apiName === 'Product');
    if (!product) return schema;

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

    // Only ensure required fields exist on the object.
    // Hard-coded template layouts are no longer auto-injected;
    // ensureAllObjectsHavePopulatedLayout will generate a layout if needed.
    if (requiredFields.length > 0) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Product'
            ? { ...obj, fields: mergedFields, updatedAt: new Date().toISOString() }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }
    return schema;
  }

  private ensureLeadTemplateLayout(schema: OrgSchema): OrgSchema {
    const lead = schema.objects.find((obj) => obj.apiName === 'Lead');
    if (!lead) return schema;

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
      type: 'MultiPicklist',
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
      required: true,
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
      type: 'MultiPicklist',
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
      autoNumber: { displayFormat: 'LEAD{0000}', startingNumber: 1 }
    });

    const mergedFields = requiredFields.length > 0
      ? [...lead.fields, ...requiredFields]
      : lead.fields;

    // Only ensure required fields exist on the object.
    // Hard-coded template layouts are no longer auto-injected;
    // ensureAllObjectsHavePopulatedLayout will generate a layout if needed.
    if (requiredFields.length > 0) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Lead'
            ? { ...obj, fields: mergedFields, updatedAt: new Date().toISOString() }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }
    return schema;
  }

  private ensureOpportunityTemplateLayout(schema: OrgSchema): OrgSchema {
    const opp = schema.objects.find((obj) => obj.apiName === 'Opportunity');
    if (!opp) return schema;

    const requiredFields: FieldDef[] = [];
    const ensureField = (field: FieldDef) => {
      const exists = opp.fields.some((f) => f.apiName === field.apiName || f.label === field.label);
      if (!exists) requiredFields.push(field);
    };

    ensureField({
      id: generateId(),
      apiName: 'Opportunity__opportunityName',
      label: 'Opportunity Name',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__architectFirm',
      label: 'Architect Firm',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Architect Firms'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__architect',
      label: 'Architect',
      type: 'Lookup',
      lookupObject: 'Contact',
      relationshipName: 'Architects'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__contractorCompany',
      label: 'Contractor Company',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Contractor Companies'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__contractor',
      label: 'Contractor',
      type: 'Lookup',
      lookupObject: 'Contact',
      relationshipName: 'Contractors'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__quoteAccount',
      label: 'Quote Account',
      type: 'Lookup',
      lookupObject: 'Account',
      relationshipName: 'Quote Accounts'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__quoteContact',
      label: 'Quote Contact',
      type: 'Lookup',
      lookupObject: 'Contact',
      relationshipName: 'Quote Contacts'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__quoteEmail',
      label: 'Quote Email',
      type: 'Email',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__quotePhone',
      label: 'Quote Phone',
      type: 'Phone',
      maxLength: 40
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__secondaryQuotePhone',
      label: 'Secondary Quote Phone',
      type: 'Phone',
      maxLength: 40
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__opportunityOwner',
      label: 'Opportunity Owner',
      type: 'Lookup',
      lookupObject: 'User',
      relationshipName: 'Opportunity Owners'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__opportunityNumber',
      label: 'Opportunity Number',
      type: 'AutoNumber',
      autoNumber: { displayFormat: 'OPP{0000}', startingNumber: 1 }
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__property',
      label: 'Property',
      type: 'Lookup',
      lookupObject: 'Property',
      relationshipName: 'Properties'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__propertyAddress',
      label: 'Property Address',
      type: 'TextArea',
      maxLength: 2000
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__estimatedContractDate',
      label: 'Estimated Contract Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__productRequiredOnsite',
      label: 'Product Required Onsite',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__quoteDue',
      label: 'Quote Due',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__stage',
      label: 'Stage',
      type: 'Picklist',
      picklistValues: ['Incomplete', 'Queued', 'Estimating', 'Quoted/Active', 'Requote/Active', 'Closed Won', 'Closed Lost']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__competitors',
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
      apiName: 'Opportunity__probability',
      label: 'Probability',
      type: 'Picklist',
      picklistValues: ['25%', '50%', '75%', '90%']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__amount',
      label: 'Amount',
      type: 'Currency',
      precision: 16,
      scale: 2
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__quoteBudget',
      label: 'Quote Budget',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__plansDated',
      label: 'Plans Dated',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__sharedOpportunity',
      label: 'Shared Opportunity',
      type: 'Picklist',
      picklistValues: ['No', 'Yes']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__sharedOpportunityUsers',
      label: 'Shared Opportunity Users',
      type: 'MultiSelectPicklist',
      picklistValues: ['Andy', 'Chris', 'Jim', 'Tim', 'Brian']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__opportunityNotes',
      label: 'Opportunity Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__kornPriority',
      label: 'Korn Priority',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__estimators',
      label: 'Estimators',
      type: 'MultiSelectPicklist',
      picklistValues: ['Elaine', 'Nancy', 'Krystyna', 'Marianna', 'Estefania', 'Julian']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__estimatingStatus',
      label: 'Status',
      type: 'Picklist',
      picklistValues: ['Initial Review', 'Internal Info Request', 'External Info Request', 'In Progress', 'Final Review', 'Completed', 'Paused']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__priorityNextJob',
      label: 'Priority/Next Job',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__estimatingNotes',
      label: 'Estimating Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__siteMeasurements',
      label: 'Site Measurements',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__highAltitude',
      label: 'High Altitude',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__newConstruction',
      label: 'New Construction',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__renovation',
      label: 'Renovation',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__waterfrontExposure',
      label: 'Waterfront Exposure',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__productSpecifications',
      label: 'Product Specifications',
      type: 'Picklist',
      picklistValues: ['Premium', 'Coastal', 'Dade (HVHZ)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__deliveryRequirements',
      label: 'Delivery Requirements',
      type: 'Picklist',
      picklistValues: [
        'YES the job site CAN accept 40’ container and tractor trailer',
        'NO the job site can NOT accept 40’ container and tractor trailer'
      ]
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__deliveryNotes',
      label: 'Delivery Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__referenceUnitDimensions',
      label: 'Reference for Unit Dimensions',
      type: 'Picklist',
      picklistValues: ['Sash', 'Frame', 'Clear Opening', 'Rough Opening', 'Masonry Opening']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__windLoadSpeed',
      label: 'Wind Load Speed MPH',
      type: 'Text',
      maxLength: 50
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__windSpeedReference',
      label: 'Wind Speed Reference',
      type: 'URL',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__woodType',
      label: 'Wood Type',
      type: 'Picklist',
      picklistValues: ['Sipo', 'Split Sipo/Specify in Notes', 'Other/Specify in Notes']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__finishSpecifications',
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
      apiName: 'Opportunity__woodNotes',
      label: 'Wood Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__finalFinish',
      label: 'Final Finish',
      type: 'Checkbox'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__glassType',
      label: 'Glass Type',
      type: 'Picklist',
      picklistValues: ['Type 1', 'Type 2', 'Type 3', 'Type 4']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__alternativeGlass',
      label: 'Alternative Glass',
      type: 'Picklist',
      picklistValues: ['Type 1', 'Type 2', 'Type 3', 'Type 4']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__glassNotes',
      label: 'Glass Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__spacerBars',
      label: 'Spacer Bars',
      type: 'Picklist',
      picklistValues: ['Standard White', 'Silver', 'Brown', 'Black', 'Premium C31', 'C32', 'C33', 'C34', 'Warm Edge']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__windowHardware',
      label: 'Window Hardware',
      type: 'Picklist',
      picklistValues: ['White Zinc/Titan Silver', 'Corrosion Resistant Metal Alloy (E-Look)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__hardwareFinishNotes',
      label: 'Hardware Finish Notes',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__hingeFinishSpecification',
      label: 'Hinge Finish Specification',
      type: 'Picklist',
      picklistValues: ['Base (Brushed Stainless Steel)', 'Premium Custom Finish (Specify in Notes)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__finials',
      label: 'Finials',
      type: 'Picklist',
      picklistValues: ['Yes', 'No']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__finialType',
      label: 'Finial Type',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__security',
      label: 'Security',
      type: 'MultiSelectPicklist',
      picklistValues: ['Magnetic Contact', 'Integrated Contact', 'Alarm Spider Contact', 'Secondary or Pool Contact']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__windowType',
      label: 'Window Type',
      type: 'MultiSelectPicklist',
      picklistValues: ['Inswing', 'Inswing TT', 'Push Outswing', 'Crank Outswing', 'Offset Simulated Double Hung', 'Simulated Double Hung', 'Awning']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__fixedOptions',
      label: 'Fixed Options',
      type: 'MultiSelectPicklist',
      picklistValues: ['Direct Glaze', 'Fixed with Sash']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__windowTypeNotes',
      label: 'Window Type Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__singleDoubleTripleHung',
      label: 'Single, Double & Triple Hung Windows',
      type: 'MultiSelectPicklist',
      picklistValues: ['Single Hung', 'Double Hung', 'Triple Hung', 'Concealed Balance', 'Weight and Chain', 'Cross Cable Balance System', 'Vent Locks']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__singleDoubleHungNotes',
      label: 'Single/Double Hung Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__sill',
      label: 'Sill',
      type: 'Picklist',
      picklistValues: ['No Sill', 'Standard Sill', 'Custom Sill (Specify Dimensions in Notes)']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__sillNotes',
      label: 'Sill Notes',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__doorOptions',
      label: 'Door Options',
      type: 'MultiSelectPicklist',
      picklistValues: ['Inswing', 'Outswing', 'Outswing Folding', 'Inswing Folding', 'Sliding']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__inswingDoorThreshold',
      label: 'Inswing Door Threshold',
      type: 'MultiSelectPicklist',
      picklistValues: ['Classic Bronze Threshold #6C', 'Premium Bronze Threshold #6', 'ADA Threshold']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__outswingDoorThreshold',
      label: 'Outswing Door Threshold',
      type: 'MultiSelectPicklist',
      picklistValues: ['Bronze Threshold #7 Flush', 'Bronze Threshold #8 Stepdown', 'ADA Threshold']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__liftSlideStrikerBolts',
      label: 'Lift and Slide Doors Striker Bolts',
      type: 'MultiSelectPicklist',
      picklistValues: ['White Zinc Hooks and Striker Bolts', 'SS Locking Hooks and Striker Bolts']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__doorOptionNotes',
      label: 'Door Option Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__entryDoor',
      label: 'Entry Door',
      type: 'Picklist',
      picklistValues: ['Include in base cost', 'Include as an option', 'Omit']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__rollScreens',
      label: 'Roll Screens',
      type: 'MultiSelectPicklist',
      picklistValues: ['Low Wind (Brush) Manual', 'Low Wind (Brush) Motorized', 'Zip Motorized', 'Manual Horizontal', 'Centor']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__rollScreenLocation',
      label: 'Roll Screen Location',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__screens',
      label: 'Screens',
      type: 'MultiSelectPicklist',
      picklistValues: ['Aluminum Window Screens', 'Wood-covered Aluminum Window Screens', 'Wood Framed Window Screens', 'Wood Framed Door Screens']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__screenLocation',
      label: 'Screen Location',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__meshType',
      label: 'Mesh Type',
      type: 'Picklist',
      picklistValues: ['Fiberglass', 'Clearview', 'Bronze', 'Dog']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__rollShades',
      label: 'Roll Shades',
      type: 'MultiSelectPicklist',
      picklistValues: ['Sun Shade', 'Blackout Shade']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__shadesLocation',
      label: 'Shades Location',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__addOnProducts',
      label: 'Add-on Products',
      type: 'MultiSelectPicklist',
      picklistValues: ['Motorized Operation', '180-Degree Hinges', 'Genius Locks', 'Bent Units', 'Butt Glazing', 'Curtain Wall', 'Retractable', 'Door Closer']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__addOnLocations',
      label: 'Add-on Locations',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__woodExteriorTrimAndCasing',
      label: 'Wood Exterior Trim and Casing',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__installation',
      label: 'Installation',
      type: 'MultiSelectPicklist',
      picklistValues: ['MHB', 'Korn', 'Arcadia']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__requiredInstallationScope',
      label: 'Required Installation Scope/Notes',
      type: 'Text',
      maxLength: 255
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__revisionStartDate',
      label: 'Start Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__revisionFinishDate',
      label: 'Finish Date',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__revision',
      label: 'Revision',
      type: 'Date'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__generalNotes',
      label: 'General Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__kornNotes',
      label: 'Korn Notes',
      type: 'RichTextArea'
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__lossReason',
      label: 'Loss Reason',
      type: 'MultiSelectPicklist',
      picklistValues: ['Lost Budget', 'Internal Lead Time', 'External Lead Time', 'Lost to Competitor', 'Unresponsive']
    });
    ensureField({
      id: generateId(),
      apiName: 'Opportunity__lossNotes',
      label: 'Loss Notes',
      type: 'Text',
      maxLength: 255
    });

    const mergedFields = requiredFields.length > 0
      ? [...opp.fields, ...requiredFields]
      : opp.fields;

    // Only ensure required fields exist on the object.
    // Hard-coded template layouts are no longer auto-injected;
    // ensureAllObjectsHavePopulatedLayout will generate a layout if needed.
    if (requiredFields.length > 0) {
      return {
        ...schema,
        objects: schema.objects.map((obj) =>
          obj.apiName === 'Opportunity'
            ? { ...obj, fields: mergedFields, updatedAt: new Date().toISOString() }
            : obj
        ),
        updatedAt: new Date().toISOString()
      };
    }
    return schema;
  }

  async saveSchema(schema: OrgSchema): Promise<void> {
    // Save to API (primary storage) — this MUST succeed
    await apiClient.setSetting(STORAGE_KEY, schema);
    
    // Save to version history on API — best effort, don't block main save
    try {
      await this.saveToVersionHistory(schema);
    } catch (versionError) {
      console.warn('Version history save failed (non-fatal):', versionError);
    }
  }

  async getVersionHistory(): Promise<OrgSchema[]> {
    try {
      const result = await apiClient.getSetting(VERSIONS_KEY);
      if (result && result.value) {
        return result.value as OrgSchema[];
      }
    } catch (error) {
      // 404 means no versions yet
      if (!(error instanceof Error && error.message.includes('404'))) {
        console.error('Failed to load version history:', error);
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
              // Support both legacy (sections) and new (regions) formats
              ...(tab.sections ? {
                sections: tab.sections.map((section: any) => ({
                  ...section,
                  id: generateId()
                }))
              } : {}),
              ...(tab.regions ? {
                regions: tab.regions.map((region: any) => ({
                  ...region,
                  id: generateId(),
                  panels: region.panels?.map((panel: any) => ({
                    ...panel,
                    id: generateId()
                  })) || []
                }))
              } : {}),
            })) || []
          })) || [],
          validationRules: obj.validationRules?.map((rule: any) => ({
            ...rule,
            id: generateId()
          })) || []
        })),
      };

      return importedSchema;
    } catch (error) {
      throw new Error('Failed to parse JSON: ' + (error instanceof Error ? error.message : 'Invalid format'));
    }
  }

  private async saveToVersionHistory(schema: OrgSchema): Promise<void> {
    const versions = await this.getVersionHistory();
    
    // Keep only last 5 versions to avoid huge payloads
    const updatedVersions = [schema, ...versions.slice(0, 4)];
    
    await apiClient.setSetting(VERSIONS_KEY, updatedVersions);
  }

  createSampleData(): OrgSchema {
    const objects: ObjectDef[] = [];
    const now = new Date().toISOString();

    // Helper to create basic object structure
    const createBasicObject = (apiName: string, label: string, pluralLabel: string, description: string, fields: any[]) => {
      // Mark all custom fields with custom: true
      const customFields = fields.map(field => ({ ...field, custom: true }));

      // Build a layout that includes all fields (not just an empty one)
      const layoutId = generateId();
      const layout: PageLayout = {
        id: layoutId,
        name: `${apiName} Layout`,
        layoutType: 'edit' as const,
        tabs: [
          {
            id: generateId(),
            label: 'Details',
            order: 0,
            regions: [
              {
                id: generateId(),
                label: `${label} Information`,
                gridColumn: 1,
                gridColumnSpan: 1,
                gridRow: 1,
                gridRowSpan: 1,
                style: {},
                widgets: [],
                panels: [
                  {
                    id: generateId(),
                    label: `${label} Information`,
                    order: 0,
                    columns: 2 as 1 | 2 | 3 | 4,
                    style: {},
                    fields: customFields.map((f, index) => ({
                      fieldApiName: f.apiName,
                      colSpan: 1,
                      order: index,
                      labelStyle: {},
                      valueStyle: {},
                      behavior: 'none' as const,
                    })),
                  },
                ],
              },
            ],
          },
        ],
      };

      const recordType = createDefaultRecordType(apiName, layoutId);
      
      return {
        id: generateId(),
        apiName,
        label,
        pluralLabel,
        description,
        createdAt: now,
        updatedAt: now,
        fields: [...cloneSystemFields(), ...customFields],
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
          type: 'Address',
          required: true,
          helpText: 'May start as a general location during the Leads pipeline before it is converted to the Opportunities pipeline. Includes Street, City, State, Country, and Zip Code.'
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
        }
      ];

    const buildLayoutFromLabels = (
      layoutName: string,
      layoutType: 'create' | 'edit',
      fields: FieldDef[],
      sectionDefs: Array<{ label: string; columns: 1 | 2 | 3; fields: string[] }>
    ): PageLayout => {
      const fieldMap = new Map(fields.map((field) => [field.label, field.apiName]));
      const missing = new Set<string>();

      const regions: LayoutSection[] = sectionDefs.map((section, sectionIndex) => {
        const panelFields: PanelField[] = section.fields
          .map((label, index) => {
            const apiName = fieldMap.get(label) || fields.find((f) => f.apiName === label)?.apiName;
            if (!apiName) {
              missing.add(label);
              return null;
            }
            return {
              fieldApiName: apiName,
              colSpan: 1,
              order: index,
              labelStyle: {},
              valueStyle: {},
              behavior: 'none' as const,
            };
          })
          .filter(Boolean) as PanelField[];

        const panelId = generateId();
        return {
          id: generateId(),
          label: section.label,
          gridColumn: 1,
          gridColumnSpan: 1,
          gridRow: sectionIndex + 1,
          gridRowSpan: 1,
          style: {},
          widgets: [],
          panels: [
            {
              id: panelId,
              label: section.label,
              order: 0,
              columns: section.columns as 1 | 2 | 3 | 4,
              style: {},
              fields: panelFields,
            },
          ],
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
            regions,
          },
        ],
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
      fields: [...cloneSystemFields(), ...propertyFields.map((field) => ({ ...field, custom: true }))],
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
        ...cloneSystemFields(),
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
              regions: [
                {
                  id: homeSectionId,
                  label: 'Main',
                  gridColumn: 1, gridColumnSpan: 1, gridRow: 1, gridRowSpan: 1,
                  style: {},
                  widgets: [],
                  panels: [
                    {
                      id: homeSectionId + '_panel',
                      label: 'Main',
                      order: 0,
                      columns: 2 as 1 | 2 | 3 | 4,
                      style: {},
                      fields: [
                        { fieldApiName: 'Home__ReportsPanel', colSpan: 1, order: 0, labelStyle: {}, valueStyle: {}, behavior: 'none' as const },
                        { fieldApiName: 'Home__DashboardsPanel', colSpan: 1, order: 1, labelStyle: {}, valueStyle: {}, behavior: 'none' as const },
                      ],
                    },
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
          apiName: 'Contact__name',
          label: 'Name',
          type: 'CompositeText',
          maxLength: 255,
          helpText: 'Full name of the contact',
          subFields: [
            { apiName: 'Contact__name_salutation', label: 'Salutation', type: 'Picklist' },
            { apiName: 'Contact__name_firstName', label: 'First Name', type: 'Text' },
            { apiName: 'Contact__name_lastName', label: 'Last Name', type: 'Text' }
          ]
        },
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
          apiName: 'Contact__middleName',
          label: 'Middle Name',
          type: 'Text',
          maxLength: 100,
          helpText: 'Middle name of the contact'
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

    // Create Contact object using createBasicObject so it gets a populated layout
    objects.push(createBasicObject(
      'Contact',
      'Contact',
      'Contacts',
      'People and their contact information',
      contactFields
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
          required: true,
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
          autoNumber: { displayFormat: 'LEAD{0000}', startingNumber: 1 }
        }
      ]
    ));

    // 6. Opportunity
    objects.push(createBasicObject(
      'Opportunity',
      'Opportunity',
      'Opportunities',
      'Sales opportunities',
      [
        {
          id: generateId(),
          apiName: 'Opportunity__opportunityName',
          label: 'Opportunity Name',
          type: 'Text',
          required: true,
          maxLength: 255
        },
        {
          id: generateId(),
          apiName: 'Opportunity__amount',
          label: 'Amount',
          type: 'Currency',
          precision: 18,
          scale: 2
        },
        {
          id: generateId(),
          apiName: 'Opportunity__closeDate',
          label: 'Expected Close Date',
          type: 'Date',
          required: true
        },
        {
          id: generateId(),
          apiName: 'Opportunity__stage',
          label: 'Stage',
          type: 'Picklist',
          required: true,
          picklistValues: ['Prospecting', 'Qualification', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'],
          defaultValue: 'Prospecting'
        },
        {
          id: generateId(),
          apiName: 'Opportunity__probability',
          label: 'Probability (%)',
          type: 'Percent',
          precision: 3,
          scale: 0
        },
        {
          id: generateId(),
          apiName: 'Opportunity__description',
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

    // 11. Work Order (mirrored from Salesforce – 78 fields)
    objects.push(createBasicObject(
      'WorkOrder',
      'Work Order',
      'Work Orders',
      'Scheduled work orders for service and maintenance',
      [
        // ── Auto-number & Name ──
        { id: generateId(), apiName: 'WorkOrder__workOrderNumber', label: 'Work Order Number', type: 'AutoNumber', autoNumber: { displayFormat: 'WO{0000}', startingNumber: 1 } },
        { id: generateId(), apiName: 'WorkOrder__name', label: 'Work Order', type: 'Text', maxLength: 80 },
        { id: generateId(), apiName: 'WorkOrder__title', label: 'Title', type: 'TextArea', maxLength: 255 },
        // ── Type / Status ──
        { id: generateId(), apiName: 'WorkOrder__workOrderType', label: 'Work Order Type', type: 'Picklist', picklistValues: ['Installation', 'Repair', 'Maintenance', 'Inspection', 'Warranty', 'Punch List', 'Other'], defaultValue: 'Repair' },
        { id: generateId(), apiName: 'WorkOrder__workStatus', label: 'Work Status', type: 'Picklist', required: true, picklistValues: ['New', 'Scheduled', 'In Progress', 'On Hold', 'Completed', 'Cancelled'], defaultValue: 'New' },
        { id: generateId(), apiName: 'WorkOrder__leadTech', label: 'Lead Tech', type: 'Picklist', picklistValues: [] },
        { id: generateId(), apiName: 'WorkOrder__punchListStatus', label: 'Punch List', type: 'Picklist', picklistValues: ['Not Started', 'In Progress', 'Completed'] },
        // ── Scheduling ──
        { id: generateId(), apiName: 'WorkOrder__scheduledStartDate', label: 'Scheduled Start Date', type: 'DateTime' },
        { id: generateId(), apiName: 'WorkOrder__scheduledEndDate', label: 'Scheduled End Date', type: 'DateTime' },
        { id: generateId(), apiName: 'WorkOrder__originalInstallationDate', label: 'Original Installation Date', type: 'Date' },
        { id: generateId(), apiName: 'WorkOrder__confirmedAppointment', label: 'Confirmed Appointment', type: 'Checkbox' },
        // ── Contacts & Lookups ──
        { id: generateId(), apiName: 'WorkOrder__primaryContact', label: 'Primary Contact', type: 'Lookup', lookupObject: 'Contact' },
        { id: generateId(), apiName: 'WorkOrder__additionalContactA', label: 'Additional Contact A', type: 'Lookup', lookupObject: 'Contact' },
        { id: generateId(), apiName: 'WorkOrder__additionalContactB', label: 'Additional Contact B', type: 'Lookup', lookupObject: 'Contact' },
        { id: generateId(), apiName: 'WorkOrder__project', label: 'Job/Project', type: 'Lookup', lookupObject: 'Project' },
        { id: generateId(), apiName: 'WorkOrder__property', label: 'Property', type: 'Lookup', lookupObject: 'Property' },
        // ── Location ──
        { id: generateId(), apiName: 'WorkOrder__location', label: 'Location', type: 'Address' },
        { id: generateId(), apiName: 'WorkOrder__location2', label: 'Location 2', type: 'Address' },
        // ── Workforce / Technicians ──
        { id: generateId(), apiName: 'WorkOrder__assignedTischlerServiceTechs', label: 'Assigned Tischler Service Techs', type: 'MultiSelectPicklist', picklistValues: [] },
        { id: generateId(), apiName: 'WorkOrder__installationDoneBy', label: 'Installation Done By', type: 'MultiSelectPicklist', picklistValues: ['Tischler', 'Subcontractor', 'Factory', 'Other'] },
        { id: generateId(), apiName: 'WorkOrder__assignedTechnicianNames', label: 'Assigned Technician Names', type: 'Text', maxLength: 255 },
        { id: generateId(), apiName: 'WorkOrder__additionalOutsideServiceTechs', label: 'Additional Outside Service Techs', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__notifiedTechs', label: 'Notified Techs', type: 'Text', maxLength: 255 },
        { id: generateId(), apiName: 'WorkOrder__notifyTheTechs', label: 'Notify The Techs', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__hours1', label: 'Hours', type: 'Number', precision: 18, scale: 0 },
        { id: generateId(), apiName: 'WorkOrder__hours2', label: 'Hours 2', type: 'Number', precision: 18, scale: 0 },
        { id: generateId(), apiName: 'WorkOrder__men', label: 'Men', type: 'Number', precision: 18, scale: 0 },
        // ── Financial ──
        { id: generateId(), apiName: 'WorkOrder__estimateCost', label: 'Estimate Cost', type: 'Currency', precision: 16, scale: 2 },
        { id: generateId(), apiName: 'WorkOrder__hotelCosts', label: 'Hotel Costs', type: 'Number', precision: 16, scale: 2 },
        { id: generateId(), apiName: 'WorkOrder__perDiem', label: 'Per Diem', type: 'Number', precision: 16, scale: 2 },
        { id: generateId(), apiName: 'WorkOrder__invoiceNumber', label: 'Invoice Number', type: 'Text', maxLength: 255 },
        // ── Billing ──
        { id: generateId(), apiName: 'WorkOrder__billed', label: 'Billed', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__billedDate', label: 'Billed Date', type: 'Date' },
        { id: generateId(), apiName: 'WorkOrder__paid', label: 'Paid', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__paidDate', label: 'Paid Date', type: 'Date' },
        { id: generateId(), apiName: 'WorkOrder__toBeBilledBasedOnEstimate', label: 'To be billed based on estimate', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__toBeBilledOnTimeOfMaterial', label: 'To be billed on time of material', type: 'Checkbox' },
        // ── Materials ──
        { id: generateId(), apiName: 'WorkOrder__materialInWarehouse', label: 'Material in WH', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__materialToOrder', label: 'Material TO ORDER', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__materialsAndToolsNeeded', label: 'Materials & Tools Needed', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__specialEquipmentNeeded', label: 'Special Equipment Needed/Comments', type: 'TextArea', maxLength: 255 },
        // ── Work Description & Notes ──
        { id: generateId(), apiName: 'WorkOrder__descriptionOfWork', label: 'Description of work', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__workDescription', label: 'Work Description', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__workPerformed', label: 'Work Performed', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__workPerformedAdditionalNotes', label: 'Work Performed/Additional Service Notes', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__workOrderNotes', label: 'Work Order Notes', type: 'LongTextArea', maxLength: 32768 },
        // ── Punch List ──
        { id: generateId(), apiName: 'WorkOrder__punchListDetail', label: 'Punch List Detail', type: 'LongTextArea', maxLength: 32768 },
        { id: generateId(), apiName: 'WorkOrder__punchListCreated', label: 'Punch List Created?', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__punchListPrinted', label: 'Punch List Printed', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__punchListProcessed', label: 'Punch List Processed', type: 'Checkbox' },
        // ── Signature ──
        { id: generateId(), apiName: 'WorkOrder__customerSignature', label: 'Customer Signature', type: 'Text', maxLength: 100 },
        { id: generateId(), apiName: 'WorkOrder__signatureDate', label: 'Signature Date', type: 'Date' },
        // ── Category Checkboxes ──
        { id: generateId(), apiName: 'WorkOrder__customer', label: 'Customer', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__factoryBcfInstall', label: 'Factory BCF/Install', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__marketing', label: 'Marketing', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__product', label: 'Product', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__service', label: 'Service', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__tischlerWarranty', label: 'Tischler Und Sohn Warranty', type: 'Checkbox' },
        { id: generateId(), apiName: 'WorkOrder__reminderEmailSent', label: 'Reminder Email Sent', type: 'Checkbox' },
        // ── Misc ──
        { id: generateId(), apiName: 'WorkOrder__combinedField', label: 'Combined Field', type: 'Text', maxLength: 255 },
        { id: generateId(), apiName: 'WorkOrder__unit', label: 'Unit', type: 'TextArea', maxLength: 255 },
        { id: generateId(), apiName: 'WorkOrder__emailLink', label: 'Email Link', type: 'Text', maxLength: 255 },
        // ── Formula / Rollup (expressions TBD — placeholders) ──
        { id: generateId(), apiName: 'WorkOrder__serviceNumber', label: 'Service Number', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__calendarDisplay', label: 'Calendar Display', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__projectLocation', label: 'Project Location', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__originalProjectNumber', label: 'Original Project #', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__primaryContactInfo', label: 'Primary Contact Information', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__primaryContactInfoServiceTech', label: 'Primary Contact Information (Tech)', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__additionalContactAInfo', label: 'Additional Contact A Information', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__additionalContactBInfo', label: 'Additional Contact B Information', type: 'Formula', formulaReturnType: 'Text', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__totalHours', label: 'Total hrs', type: 'Formula', formulaReturnType: 'Number', formulaExpr: '' },
        { id: generateId(), apiName: 'WorkOrder__totalHoursForAllPunchLists', label: 'Total Hours For all Punch Lists', type: 'Number', precision: 18, scale: 2 },
      ]
    ));

    const baseSchema: OrgSchema = {
      version: 1,
      objects,
      updatedAt: now
    };

    return this.ensureOpportunityTemplateLayout(
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
    // Clear cached schema from API
    try {
      await apiClient.deleteSetting(STORAGE_KEY);
      await apiClient.deleteSetting(VERSIONS_KEY);
    } catch {
      // Settings may not exist yet
    }
    
    // Also clear any remaining localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(VERSIONS_KEY);
      localStorage.removeItem('schema-store');
      localStorage.removeItem('propertyLayoutAssociations');
    }
    
    // Create fresh schema with all new fields
    const freshSchema = this.createSampleData();
    
    // Save to API
    await this.saveSchema(freshSchema);
    
    return freshSchema;
  }
}

// Export singleton instance
export const schemaService = new LocalStorageSchemaService();