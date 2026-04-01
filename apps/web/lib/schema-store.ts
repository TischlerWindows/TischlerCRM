import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { OrgSchema, ObjectDef, FieldDef, ValidationRule, WorkflowRule, RecordType, PageLayout, FlowDefinition, CustomLayoutTemplate } from './schema';
import { schemaService } from './schema-service';
import { apiClient } from './api-client';
import { recordsService } from './records-service';

export interface LayoutActivationConflict {
  layoutId: string;
  layoutName: string;
  sharedRoleIds: string[];
}

export interface SetLayoutActiveResult {
  updated: boolean;
  conflicts: LayoutActivationConflict[];
}

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
  setLayoutActive: (
    objectApi: string,
    layoutId: string,
    active: boolean,
    options?: { force?: boolean }
  ) => Promise<SetLayoutActiveResult>;
  setLayoutDefault: (objectApi: string, layoutId: string) => Promise<void>;
  saveCustomTemplate: (template: CustomLayoutTemplate) => Promise<void>;
  
  // Validation rule operations
  addValidationRule: (objectApi: string, rule: Omit<ValidationRule, 'id'>) => string;
  updateValidationRule: (objectApi: string, ruleId: string, updates: Partial<ValidationRule>) => void;
  deleteValidationRule: (objectApi: string, ruleId: string) => void;
  
  // Workflow rule operations
  addWorkflowRule: (objectApi: string, rule: Omit<WorkflowRule, 'id'>) => string;
  updateWorkflowRule: (objectApi: string, ruleId: string, updates: Partial<WorkflowRule>) => void;
  deleteWorkflowRule: (objectApi: string, ruleId: string) => void;

  // Flow operations
  addFlow: (flow: Omit<FlowDefinition, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateFlow: (flowId: string, updates: Partial<FlowDefinition>) => void;
  deleteFlow: (flowId: string) => void;
  getFlow: (flowId: string) => FlowDefinition | undefined;

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
  // No longer inject lookup fields into layouts automatically.
  // Layouts should only contain fields the user explicitly placed via the Page Editor.
  return objectDef;
}

// Read cached schema synchronously so the very first render has it (no flash)
function getCachedSchema(): OrgSchema | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('crm-schema-cache');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.state?.schema ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

export const useSchemaStore = create<SchemaStore>()(
  persist(
    (set, get) => ({
      // Initial state — use cached schema so labels are correct on first paint
      schema: getCachedSchema(),
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

        // Simply add the new object — no auto-generated relationship fields.
        // Users can manually create Lookup fields via the field editor.
        const updatedSchema = {
          ...schema,
          objects: [...schema.objects, newObject],
          version: schema.version + 1,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        
        // Persist to schema service storage
        await schemaService.saveSchema(updatedSchema);
        
        // Also create the object in the backend database so records can be stored via API
        try {
          await apiClient.createObject({
            apiName: newObject.apiName,
            label: objectData.label || newObject.apiName,
            pluralLabel: objectData.pluralLabel || objectData.label || newObject.apiName,
            description: objectData.description,
          });

          // Sync fields to the database so the records API can validate them
          const fieldsToSync = (newObject.fields || []).filter((f) => {
            const isSystem = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(f.apiName);
            const isLookup = f.type === 'Lookup' || f.type === 'ExternalLookup';
            return !isSystem && !isLookup;
          });
          for (const field of fieldsToSync) {
            try {
              await apiClient.createField(newObject.apiName, {
                apiName: field.apiName,
                label: field.label,
                type: field.type || 'Text',
                required: field.required || false,
                unique: field.unique || false,
                readOnly: field.readOnly || false,
                picklistValues: field.picklistValues,
                defaultValue: field.defaultValue,
              });
            } catch {
              // Field may already exist
            }
          }
        } catch (err) {
          // Object may already exist in DB (e.g., seeded objects) — that's OK
          console.warn(`[Schema] Could not create object "${newObject.apiName}" in database (may already exist):`, err);
        }
        
        return newObject.id;
      },

      // Update existing object
      updateObject: async (objectApi, updates) => {
        const { schema } = get();
        if (!schema) return;

        const previousSchema = schema;
        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi 
            ? { ...obj, ...updates, updatedAt: new Date().toISOString() }
            : obj
        );

        const optimisticSchema = {
          ...schema,
          objects: updatedObjects,
          version: schema.version + 1,
          updatedAt: new Date().toISOString()
        };
        
        // Optimistic update — rollback on failure
        set({ schema: optimisticSchema });
        
        try {
          await schemaService.saveSchema(optimisticSchema);
        } catch (error) {
          // Roll back only when no newer write has replaced this optimistic state.
          set((state) => (state.schema === optimisticSchema ? { schema: previousSchema } : state));
          throw error;
        }
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

        // Also sync field to backend database (fire-and-forget)
        const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(fieldData.apiName);
        if (!isSystemField) {
          apiClient.createField(objectApi, {
            apiName: fieldData.apiName,
            label: fieldData.label,
            type: fieldData.type || 'Text',
            required: fieldData.required || false,
            unique: fieldData.unique || false,
            readOnly: fieldData.readOnly || false,
            description: fieldData.helpText,
            maxLength: fieldData.maxLength,
            minLength: fieldData.minLength,
            picklistValues: fieldData.picklistValues,
            defaultValue: fieldData.defaultValue,
          }).catch((err: any) => {
            console.warn(`[Schema] Could not sync field "${fieldData.apiName}" to database:`, err);
          });
        }

        return fieldId;
      },

      // Update field
      updateField: (objectApi, fieldId, updates) => {
        const { schema } = get();
        if (!schema) return;

        // Detect apiName change so we can cascade to layouts & records
        const targetObj = schema.objects.find(o => o.apiName === objectApi);
        // Match by apiName first (preferred), fall back to id only if no
        // apiName match found.  Using OR could accidentally match unrelated
        // fields when an id collides with another field's apiName.
        const oldField = targetObj?.fields.find(f => f.apiName === fieldId)
                      || targetObj?.fields.find(f => f.id === fieldId);
        const oldApiName = oldField?.apiName;
        const newApiName = updates.apiName;
        const apiNameChanged = oldApiName && newApiName && oldApiName !== newApiName;

        const updatedObjects = schema.objects.map(obj => {
          if (obj.apiName !== objectApi) return obj;

          // Update ONLY the single matching field definition.
          // Match by apiName first; fall back to id only if needed.
          let matched = false;
          const updatedFields = obj.fields.map(field => {
            if (matched) return field; // already found the one field
            if (field.apiName === fieldId || (!matched && field.id === fieldId)) {
              matched = true;
              return { ...field, ...updates };
            }
            return field;
          });

          // Cascade apiName change + field property changes to page layouts
          const updatedLayouts = (obj.pageLayouts || []).map(layout => ({
            ...layout,
            tabs: layout.tabs.map(tab => ({
              ...tab,
              regions: (tab.regions || []).map(region => ({
                ...region,
                panels: (region.panels || []).map(panel => ({
                  ...panel,
                  fields: (panel.fields || []).map(pf => {
                    // Match by old apiName (rename) or current apiName (property update)
                    const matchesOld = apiNameChanged && pf.fieldApiName === oldApiName;
                    const matchesCurrent = pf.fieldApiName === (newApiName || fieldId);
                    if (!matchesOld && !matchesCurrent) return pf;

                    // Rebuild with the updated field def so embedded data stays fresh
                    const freshField = updatedFields.find(f => f.apiName === (newApiName || fieldId));
                    if (!freshField) {
                      // At minimum, update the fieldApiName reference
                      return apiNameChanged ? { ...pf, fieldApiName: newApiName! } : pf;
                    }
                    return {
                      ...pf,
                      fieldApiName: freshField.apiName,
                    } as any;
                  }),
                })),
              })),
            })),
          }));

          return {
            ...obj,
            fields: updatedFields,
            pageLayouts: updatedLayouts,
            updatedAt: new Date().toISOString(),
          };
        });

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: new Date().toISOString()
        };

        set({ schema: updatedSchema });
        
        // Persist to schema service
        schemaService.saveSchema(updatedSchema);

        // Cascade apiName rename to existing records
        if (apiNameChanged) {
          (async () => {
            try {
              const records = await recordsService.getRecords(objectApi);
              for (const rec of records) {
                const data = rec.data as Record<string, any> | undefined;
                if (data && (oldApiName! in data)) {
                  const newData = { ...data };
                  newData[newApiName!] = newData[oldApiName!];
                  delete newData[oldApiName!];
                  await recordsService.updateRecord(objectApi, rec.id, { data: newData });
                }
              }
            } catch (err) {
              console.error('[Schema] Failed to cascade field rename to records:', err);
            }
          })();
        }
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
        
        // Persist to schema service (API)
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

      setLayoutActive: async (objectApi, layoutId, active, options) => {
        const { updateObject } = get();
        const schema = get().schema;
        if (!schema) {
          return { updated: false, conflicts: [] };
        }

        const objectDef = schema.objects.find(obj => obj.apiName === objectApi);
        if (!objectDef) {
          return { updated: false, conflicts: [] };
        }

        const target = objectDef.pageLayouts.find(layout => layout.id === layoutId);
        if (!target) {
          return { updated: false, conflicts: [] };
        }

        if (active === false) {
          const latestSchema = get().schema;
          if (!latestSchema) {
            return { updated: false, conflicts: [] };
          }

          const latestObjectDef = latestSchema.objects.find(obj => obj.apiName === objectApi);
          if (!latestObjectDef) {
            return { updated: false, conflicts: [] };
          }

          const latestTarget = latestObjectDef.pageLayouts.find(layout => layout.id === layoutId);
          if (!latestTarget) {
            return { updated: false, conflicts: [] };
          }

          const pageLayouts = latestObjectDef.pageLayouts.map(layout =>
            layout.id === layoutId ? { ...layout, active: false } : layout
          );
          await updateObject(objectApi, { pageLayouts });
          return { updated: true, conflicts: [] };
        }

        const latestSchema = get().schema;
        if (!latestSchema) {
          return { updated: false, conflicts: [] };
        }

        const latestObjectDef = latestSchema.objects.find(obj => obj.apiName === objectApi);
        if (!latestObjectDef) {
          return { updated: false, conflicts: [] };
        }

        const latestTarget = latestObjectDef.pageLayouts.find(layout => layout.id === layoutId);
        if (!latestTarget) {
          return { updated: false, conflicts: [] };
        }

        const targetRoleIds = latestTarget.roles ?? [];
        const conflicts: LayoutActivationConflict[] = latestObjectDef.pageLayouts
          .filter(layout => layout.id !== layoutId && layout.active === true)
          .map((layout) => {
            const overlap = targetRoleIds.filter((roleId) => (layout.roles ?? []).includes(roleId));
            return {
              layoutId: layout.id,
              layoutName: layout.name,
              sharedRoleIds: Array.from(new Set(overlap))
            };
          })
          .filter(conflict => conflict.sharedRoleIds.length > 0);

        if (conflicts.length > 0 && options?.force !== true) {
          return { updated: false, conflicts };
        }

        const conflictingIds = new Set(conflicts.map(conflict => conflict.layoutId));
        const pageLayouts = latestObjectDef.pageLayouts.map(layout => {
          if (layout.id === layoutId) {
            return { ...layout, active: true };
          }
          if (conflictingIds.has(layout.id)) {
            return { ...layout, active: false };
          }
          return layout;
        });

        await updateObject(objectApi, { pageLayouts });
        return { updated: true, conflicts: [] };
      },

      setLayoutDefault: async (objectApi, layoutId) => {
        const { updateObject } = get();
        const schema = get().schema;
        if (!schema) return;

        const objectDef = schema.objects.find(obj => obj.apiName === objectApi);
        if (!objectDef) return;

        const latestSchema = get().schema;
        if (!latestSchema) return;

        const latestObjectDef = latestSchema.objects.find(obj => obj.apiName === objectApi);
        if (!latestObjectDef) return;

        const target = latestObjectDef.pageLayouts.find(layout => layout.id === layoutId);
        if (!target) return;

        const updatedLayouts = latestObjectDef.pageLayouts.map(layout => ({
          ...layout,
          isDefault: layout.id === layoutId
        }));

        await updateObject(objectApi, { pageLayouts: updatedLayouts });
      },

      saveCustomTemplate: async (template) => {
        const { schema } = get();
        if (!schema) return;

        const previousSchema = schema;
        const currentTemplates = schema.customLayoutTemplates ?? [];
        const existingIndex = currentTemplates.findIndex(existing => existing.id === template.id);
        const nextTemplates = [...currentTemplates];
        if (existingIndex >= 0) {
          nextTemplates[existingIndex] = template;
        } else {
          nextTemplates.push(template);
        }

        const optimisticSchema = {
          ...schema,
          customLayoutTemplates: nextTemplates,
          version: schema.version + 1,
          updatedAt: new Date().toISOString()
        };

        set({ schema: optimisticSchema });

        try {
          await schemaService.saveSchema(optimisticSchema);
        } catch (error) {
          set((state) => (state.schema === optimisticSchema ? { schema: previousSchema } : state));
          throw error;
        }
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

      // Add workflow rule
      addWorkflowRule: (objectApi, ruleData) => {
        const { schema } = get();
        if (!schema) return '';

        const ruleId = generateId();
        const now = new Date().toISOString();
        const newRule = { ...ruleData, id: ruleId, createdAt: now, updatedAt: now };

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi
            ? {
                ...obj,
                workflowRules: [...(obj.workflowRules || []), newRule],
                updatedAt: now
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: now
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
        return ruleId;
      },

      // Update workflow rule
      updateWorkflowRule: (objectApi, ruleId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const now = new Date().toISOString();
        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi
            ? {
                ...obj,
                workflowRules: (obj.workflowRules || []).map(rule =>
                  rule.id === ruleId ? { ...rule, ...updates, updatedAt: now } : rule
                ),
                updatedAt: now
              }
            : obj
        );

        const updatedSchema = {
          ...schema,
          objects: updatedObjects,
          updatedAt: now
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Delete workflow rule
      deleteWorkflowRule: (objectApi, ruleId) => {
        const { schema } = get();
        if (!schema) return;

        const updatedObjects = schema.objects.map(obj =>
          obj.apiName === objectApi
            ? {
                ...obj,
                workflowRules: (obj.workflowRules || []).filter(rule => rule.id !== ruleId),
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

      // Add flow
      addFlow: (flowData) => {
        const { schema } = get();
        if (!schema) return '';

        const flowId = generateId();
        const now = new Date().toISOString();
        const newFlow: FlowDefinition = {
          ...flowData,
          id: flowId,
          createdAt: now,
          updatedAt: now,
        };

        const updatedSchema = {
          ...schema,
          flows: [...(schema.flows || []), newFlow],
          updatedAt: now,
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
        return flowId;
      },

      // Update flow
      updateFlow: (flowId, updates) => {
        const { schema } = get();
        if (!schema) return;

        const now = new Date().toISOString();
        const updatedSchema = {
          ...schema,
          flows: (schema.flows || []).map(f =>
            f.id === flowId ? { ...f, ...updates, updatedAt: now } : f
          ),
          updatedAt: now,
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Delete flow
      deleteFlow: (flowId) => {
        const { schema } = get();
        if (!schema) return;

        const updatedSchema = {
          ...schema,
          flows: (schema.flows || []).filter(f => f.id !== flowId),
          updatedAt: new Date().toISOString(),
        };

        set({ schema: updatedSchema });
        schemaService.saveSchema(updatedSchema);
      },

      // Get flow
      getFlow: (flowId) => {
        const { schema } = get();
        return schema?.flows?.find(f => f.id === flowId);
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
      name: 'crm-schema-cache',
      partialize: (state) => ({ schema: state.schema }),
    }
  )
);