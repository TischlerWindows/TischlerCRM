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
  updateObject: (objectApi: string, updates: Partial<ObjectDef>) => void;
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

        const updatedSchema = {
          ...schema,
          objects: [...schema.objects, newObject]
        };

        set({ schema: updatedSchema });
        return newObject.id;
      },

      // Update existing object
      updateObject: (objectApi, updates) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { ...obj, ...updates, updatedAt: new Date().toISOString() }
            : obj
        );

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
      },

      // Delete object
      deleteObject: async (objectApi) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.filter(obj => obj.apiName !== objectApi);
        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });

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
                  field.id === fieldId ? { ...field, ...updates } : field
                ),
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
      },

      // Delete field
      deleteField: (objectApi, fieldId) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? {
                ...obj,
                fields: obj.fields.filter(field => field.id !== fieldId),
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });

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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });

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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
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

        set({
          schema: {
            ...schema,
            objects: updatedObjects
          }
        });
      },

      // Update permissions
      updatePermissions: (permissionSet) => {
        const { schema } = get();
        if (!schema) return;

        const updatedPermissionSets = schema.permissionSets.some(ps => ps.id === permissionSet.id)
          ? schema.permissionSets.map(ps => ps.id === permissionSet.id ? permissionSet : ps)
          : [...schema.permissionSets, permissionSet];

        set({
          schema: {
            ...schema,
            permissionSets: updatedPermissionSets
          }
        });
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