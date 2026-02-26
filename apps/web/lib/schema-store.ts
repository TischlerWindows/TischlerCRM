import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OrgSchema, ObjectDef, FieldDef, ValidationRule, RecordType, PageLayout, PermissionSet } from './schema';
import { schemaService } from './schema-service';

export interface SchemaStore {
  // Current schema state
  schema: OrgSchema | null;
  
  // UI state
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Selected objects and components
  selectedObjectApi: string | null;
  selectedFieldId: string | null;
  selectedLayoutId: string | null;
  
  // Actions
  loadSchema: () => Promise<void>;
  saveSchema: () => Promise<void>;
  createObject: (objectDef: Omit<ObjectDef, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateObject: (objectApi: string, updates: Partial<ObjectDef>) => Promise<void>;
  deleteObject: (objectApi: string) => Promise<void>;
  
  // Field operations
  addField: (objectApi: string, field: Omit<FieldDef, 'id'>) => string;
  updateField: (objectApi: string, fieldId: string, updates: Partial<FieldDef>) => void;
  deleteField: (objectApi: string, fieldId: string) => void;
  reorderFields: (objectApi: string, fieldIds: string[]) => void;
  
  // Record type operations
  addRecordType: (objectApi: string, recordType: Omit<RecordType, 'id'>) => string;
  updateRecordType: (objectApi: string, recordTypeId: string, updates: Partial<RecordType>) => void;
  deleteRecordType: (objectApi: string, recordTypeId: string) => void;
  
  // Page layout operations
  addPageLayout: (objectApi: string, layout: Omit<PageLayout, 'id'>) => string;
  updatePageLayout: (objectApi: string, layoutId: string, updates: Partial<PageLayout>) => void;
  deletePageLayout: (objectApi: string, layoutId: string) => void;
  
  // Validation rule operations
  addValidationRule: (objectApi: string, rule: Omit<ValidationRule, 'id'>) => string;
  updateValidationRule: (objectApi: string, ruleId: string, updates: Partial<ValidationRule>) => void;
  deleteValidationRule: (objectApi: string, ruleId: string) => void;
  
  // Permission operations
  updatePermissions: (permissionSet: PermissionSet) => void;
  
  // Schema versioning
  getVersionHistory: () => Promise<OrgSchema[]>;
  rollbackToVersion: (version: number) => Promise<void>;
  
  // Import/Export
  exportSchema: (objectApi?: string) => string;
  importSchema: (jsonData: string, merge?: boolean) => Promise<void>;
  
  // Schema reset
  resetSchema: () => Promise<void>;
  
  // UI state management
  setSelectedObject: (objectApi: string | null) => void;
  setSelectedField: (fieldId: string | null) => void;
  setSelectedLayout: (layoutId: string | null) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

const RELATIONSHIP_EXCLUSIONS = new Set(['Home']);

function hasRelationshipField(fields: FieldDef[], targetApi: string): boolean {
  return fields.some((field) => {
    const relatedObject = (field as any).relatedObject as string | undefined;
    return (
      (field.type === 'Lookup' || field.type === 'ExternalLookup') &&
      ((field.lookupObject && field.lookupObject === targetApi) || (relatedObject && relatedObject === targetApi))
    ) || field.apiName === `${targetApi}Id`;
  });
}

function createRelationshipField(target: ObjectDef): FieldDef {
  return {
    id: generateId(),
    apiName: `${target.apiName}Id`,
    label: target.label,
    type: 'Lookup',
    lookupObject: target.apiName,
    relationshipName: target.pluralLabel || target.label,
    custom: false,
    helpText: `Lookup to ${target.label}`
  };
}

function addLookupFieldsToLayouts(objectDef: ObjectDef): ObjectDef {
  if (!objectDef.pageLayouts || objectDef.pageLayouts.length === 0) return objectDef;

  const lookupFields = objectDef.fields.filter(
    (field) => field.type === 'Lookup' || field.type === 'ExternalLookup'
  );

  const pageLayouts = objectDef.pageLayouts.map((layout) => {
    if (!layout.tabs.length || !layout.tabs[0] || !layout.tabs[0].sections.length || !layout.tabs[0].sections[0]) {
      return layout;
    }

    const tab = layout.tabs[0];
    const section = tab.sections[0];
    const existingFieldApi = new Set(section.fields.map((f) => f.apiName));
    const missingLookups = lookupFields.filter((field) => !existingFieldApi.has(field.apiName));

    if (missingLookups.length === 0) return layout;

    const nextFields = section.fields.slice();
    const nextOrderStart = nextFields.length;

    missingLookups.forEach((field, index) => {
      nextFields.push({
        apiName: field.apiName,
        column: index % section.columns,
        order: nextOrderStart + index
      });
    });

    return {
      ...layout,
      tabs: [
        {
          ...tab,
          sections: [
            {
              ...section,
              fields: nextFields
            },
            ...tab.sections.slice(1)
          ]
        },
        ...layout.tabs.slice(1)
      ]
    };
  });

  return {
    ...objectDef,
    pageLayouts
  };
}

export const useSchemaStore = create<SchemaStore>()(
  persist(
    (set, get) => ({
      // Initial state
      schema: null,
      loading: false,
      saving: false,
      error: null,
      selectedObjectApi: null,
      selectedFieldId: null,
      selectedLayoutId: null,

      // Load schema from service
      loadSchema: async () => {
        set({ loading: true, error: null });
        try {
          const schema = await schemaService.loadSchema();
          set({ schema, loading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load schema',
            loading: false 
          });
        }
      },

      // Save current schema
      saveSchema: async () => {
        const { schema } = get();
        if (!schema) return;
        
        set({ saving: true, error: null });
        try {
          const updatedSchema = {
            ...schema,
            version: schema.version + 1,
            updatedAt: new Date().toISOString()
          };
          
          await schemaService.saveSchema(updatedSchema);
          set({ schema: updatedSchema, saving: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to save schema',
            saving: false 
          });
        }
      },

      // Create new object
      createObject: async (objectData) => {
        const { schema } = get();
        if (!schema) throw new Error('No schema loaded');

        const newObject: ObjectDef = {
          ...objectData,
          id: generateId(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const shouldRelateNewObject = !RELATIONSHIP_EXCLUSIONS.has(newObject.apiName);
        const relatedObjects = schema.objects.filter((obj) => !RELATIONSHIP_EXCLUSIONS.has(obj.apiName));

        const newObjectWithRelations: ObjectDef = shouldRelateNewObject
          ? {
              ...newObject,
              fields: relatedObjects.reduce((fields, target) => {
                if (target.apiName === newObject.apiName) return fields;
                if (hasRelationshipField(fields, target.apiName)) return fields;
                return [...fields, createRelationshipField(target)];
              }, newObject.fields || [])
            }
          : newObject;

        const newObjectWithLayouts = addLookupFieldsToLayouts(newObjectWithRelations);

        const updatedExisting = schema.objects.map((obj) => {
          if (RELATIONSHIP_EXCLUSIONS.has(obj.apiName) || !shouldRelateNewObject) {
            return obj;
          }
          if (hasRelationshipField(obj.fields, newObject.apiName)) {
            return obj;
          }
          const updatedObject = {
            ...obj,
            fields: [...obj.fields, createRelationshipField(newObject)],
            updatedAt: new Date().toISOString()
          };
          return addLookupFieldsToLayouts(updatedObject);
        });

        const updatedSchema = {
          ...schema,
          objects: [...updatedExisting, newObjectWithLayouts],
          version: schema.version + 1,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        
        // Persist to schema service storage
        await schemaService.saveSchema(updatedSchema);
        
        return newObject.id;
      },

      // Update existing object
      updateObject: async (objectApi, updates) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { ...obj, ...updates, updatedAt: new Date().toISOString() }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          version: schema.version + 1,
          updatedAt: new Date().toISOString()
        };
        
        set({ schema: updatedSchema });
        
        // Persist to schema service storage
        await schemaService.saveSchema(updatedSchema);
      },

      // Delete object
      deleteObject: async (objectApi) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.filter(obj => obj.apiName !== objectApi);
        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          version: schema.version + 1,
          updatedAt: new Date().toISOString()
        };
        
        set({ schema: updatedSchema });
        
        // Persist to schema service storage
        await schemaService.saveSchema(updatedSchema);
      },

      // Add field to object
      addField: (objectApi, fieldData) => {
        const { schema } = get();
        if (!schema) return '';

        const fieldId = generateId();
        const newField = { ...fieldData, id: fieldId };

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { 
                ...obj, 
                fields: [...obj.fields, newField],
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        
        // Persist to schema service
        schemaService.saveSchema(updatedSchema);

        return fieldId;
      },

      // Update field
      updateField: (objectApi, fieldId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                fields: obj.fields.map(field =>
                  (field.id === fieldId || field.apiName === fieldId) ? { ...field, ...updates } : field
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        
        // Persist to schema service
        schemaService.saveSchema(updatedSchema);
      },

      // Delete field
      deleteField: (objectApi, fieldIdOrApiName) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                fields: obj.fields.filter(field => 
                  field.id !== fieldIdOrApiName && field.apiName !== fieldIdOrApiName
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        
        // Explicitly save to localStorage to ensure persistence
        schemaService.saveSchema(updatedSchema);
      },

      // Reorder fields
      reorderFields: (objectApi, fieldIds) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj => {
          if (obj.apiName !== objectApi) return obj;

          const fieldMap = new Map(obj.fields.map(field => [field.id, field]));
          const reorderedFields = fieldIds
            .map(id => fieldMap.get(id))
            .filter(Boolean) as FieldDef[];

          return {
            ...obj,
            fields: reorderedFields,
            updatedAt: new Date().toISOString()
          };
        });

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
      },

      // Add record type
      addRecordType: (objectApi, recordTypeData) => {
        const { schema } = get();
        if (!schema) return '';

        const recordTypeId = generateId();
        const newRecordType = { ...recordTypeData, id: recordTypeId };

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { 
                ...obj, 
                recordTypes: [...obj.recordTypes, newRecordType],
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });

        return recordTypeId;
      },

      // Update record type
      updateRecordType: (objectApi, recordTypeId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                recordTypes: obj.recordTypes.map(rt =>
                  rt.id === recordTypeId ? { ...rt, ...updates } : rt
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Delete record type
      deleteRecordType: (objectApi, recordTypeId) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                recordTypes: obj.recordTypes.filter(rt => rt.id !== recordTypeId),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Add page layout
      addPageLayout: (objectApi, layoutData) => {
        const { schema } = get();
        if (!schema) return '';

        const layoutId = generateId();
        const newLayout = { ...layoutData, id: layoutId };

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { 
                ...obj, 
                pageLayouts: [...obj.pageLayouts, newLayout],
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);

        return layoutId;
      },

      // Update page layout
      updatePageLayout: (objectApi, layoutId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                pageLayouts: obj.pageLayouts.map(layout =>
                  layout.id === layoutId ? { ...layout, ...updates } : layout
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Delete page layout
      deletePageLayout: (objectApi, layoutId) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                pageLayouts: obj.pageLayouts.filter(layout => layout.id !== layoutId),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Add validation rule
      addValidationRule: (objectApi, ruleData) => {
        const { schema } = get();
        if (!schema) return '';

        const ruleId = generateId();
        const newRule = { ...ruleData, id: ruleId };

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { 
                ...obj, 
                validationRules: [...obj.validationRules, newRule],
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);

        return ruleId;
      },

      // Update validation rule
      updateValidationRule: (objectApi, ruleId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                validationRules: obj.validationRules.map(rule =>
                  rule.id === ruleId ? { ...rule, ...updates } : rule
                ),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Delete validation rule
      deleteValidationRule: (objectApi, ruleId) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                validationRules: obj.validationRules.filter(rule => rule.id !== ruleId),
                updatedAt: new Date().toISOString()
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Update permissions
      updatePermissions: (permissionSet) => {
        const { schema } = get();
        if (!schema) return;

        const updatedPermissionSets = schema.permissionSets.some(ps => ps.id === permissionSet.id)
          ? schema.permissionSets.map(ps => ps.id === permissionSet.id ? permissionSet : ps)
          : [...schema.permissionSets, permissionSet];

        const updatedSchema = {
          ...schema,
          permissionSets: updatedPermissionSets,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Get version history
      getVersionHistory: async () => {
        return await schemaService.getVersionHistory();
      },

      // Rollback to version
      rollbackToVersion: async (version) => {
        try {
          const schema = await schemaService.rollbackToVersion(version);
          set({ schema });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to rollback' });
        }
      },

      // Export schema
      exportSchema: (objectApi) => {
        const { schema } = get();
        if (!schema) return '{}';

        if (objectApi) {
          const object = schema.objects.find(obj => obj.apiName === objectApi);
          return JSON.stringify(object, null, 2);
        }

        return JSON.stringify(schema, null, 2);
      },

      // Import schema
      importSchema: async (jsonData, merge = false) => {
        try {
          const importedData = JSON.parse(jsonData);
          const { schema } = get();

          if (merge && schema) {
            // Merge with existing schema
            const mergedSchema = {
              ...schema,
              objects: [...schema.objects, ...importedData.objects || []],
              permissionSets: [...schema.permissionSets, ...importedData.permissionSets || []],
              version: schema.version + 1,
              updatedAt: new Date().toISOString()
            };
            set({ schema: mergedSchema });
          } else {
            // Replace schema
            set({ schema: importedData });
          }
        } catch (error) {
          set({ error: 'Invalid JSON format' });
        }
      },

      // Reset schema to defaults and clear cache
      resetSchema: async () => {
        set({ loading: true, error: null });
        try {
          const freshSchema = await schemaService.resetSchema();
          set({ schema: freshSchema, loading: false });
        } catch (error) {
          set({ 
            error: error instanceof Error ? error.message : 'Failed to reset schema',
            loading: false 
          });
        }
      },

      // UI state setters
      setSelectedObject: (objectApi) => set({ selectedObjectApi: objectApi }),
      setSelectedField: (fieldId) => set({ selectedFieldId: fieldId }),
      setSelectedLayout: (layoutId) => set({ selectedLayoutId: layoutId }),
      setError: (error) => set({ error }),
      clearError: () => set({ error: null })
    }),
    {
      name: 'schema-store',
      partialize: (state) => ({ 
        schema: state.schema,
        selectedObjectApi: state.selectedObjectApi 
      }),
    }
  )
);