// Schema API Service - Fetches schema from backend API and transforms to frontend format
import { apiClient } from './api-client';
import { OrgSchema, ObjectDef, FieldDef, PageLayout, PageTab, PageSection, PageField, RecordType, FieldType } from './schema';

// Transform API response to frontend ObjectDef format
function transformApiObjectToObjectDef(apiObject: any): ObjectDef {
  // Transform fields
  const fields: FieldDef[] = (apiObject.fields || []).map((f: any) => ({
    id: f.id,
    apiName: f.apiName,
    label: f.label,
    type: f.type as FieldType,
    custom: f.isCustom,
    required: f.required,
    unique: f.unique,
    readOnly: f.readOnly,
    precision: f.precision,
    scale: f.scale,
    maxLength: f.maxLength,
    minLength: f.minLength,
    min: f.min,
    max: f.max,
    picklistValues: f.picklistValues || undefined,
    defaultValue: f.defaultValue,
    helpText: f.helpText,
    lookupObject: f.relationship?.parentObject?.apiName,
    relationshipName: f.relationship?.relationshipName,
  }));

  // Transform page layouts
  const pageLayouts: PageLayout[] = (apiObject.pageLayouts || []).map((layout: any) => {
    const tabs: PageTab[] = (layout.tabs || []).map((tab: any) => {
      const sections: PageSection[] = (tab.sections || []).map((section: any) => ({
        id: section.id,
        label: section.label,
        columns: section.columns as 1 | 2 | 3,
        order: section.order,
        fields: (section.fields || []).map((f: any) => ({
          apiName: f.field?.apiName || f.fieldId,
          column: f.column,
          order: f.order,
        })),
      }));

      return {
        id: tab.id,
        label: tab.label,
        order: tab.order,
        sections,
      };
    });

    return {
      id: layout.id,
      name: layout.name,
      layoutType: layout.layoutType as 'create' | 'edit',
      tabs,
    };
  });

  return {
    id: apiObject.id,
    apiName: apiObject.apiName,
    label: apiObject.label,
    pluralLabel: apiObject.pluralLabel,
    description: apiObject.description,
    fields,
    pageLayouts,
    validationRules: [],
    recordTypes: [{
      id: 'default',
      name: 'Master',
      default: true,
    }],
    createdAt: apiObject.createdAt,
    updatedAt: apiObject.updatedAt,
  };
}

class SchemaApiService {
  private cachedSchema: OrgSchema | null = null;
  private cacheTimestamp: number = 0;
  private cacheMaxAge: number = 5 * 60 * 1000; // 5 minutes

  /**
   * Fetch full schema from API
   */
  async fetchSchema(forceRefresh: boolean = false): Promise<OrgSchema> {
    const now = Date.now();
    
    // Return cached schema if still valid
    if (!forceRefresh && this.cachedSchema && (now - this.cacheTimestamp) < this.cacheMaxAge) {
      return this.cachedSchema;
    }

    try {
      const apiObjects = await apiClient.getObjects();
      
      const objects: ObjectDef[] = apiObjects.map(transformApiObjectToObjectDef);

      const schema: OrgSchema = {
        version: 1,
        updatedAt: new Date().toISOString(),
        objects,
        permissionSets: [],
      };

      this.cachedSchema = schema;
      this.cacheTimestamp = now;

      return schema;
    } catch (error) {
      console.error('Failed to fetch schema from API:', error);
      
      // Return cached schema if available, even if stale
      if (this.cachedSchema) {
        return this.cachedSchema;
      }
      
      // Return empty schema as fallback
      return {
        version: 1,
        updatedAt: new Date().toISOString(),
        objects: [],
        permissionSets: [],
      };
    }
  }

  /**
   * Fetch a single object definition
   */
  async fetchObject(apiName: string): Promise<ObjectDef | null> {
    try {
      const apiObject = await apiClient.getObject(apiName);
      return transformApiObjectToObjectDef(apiObject);
    } catch (error) {
      console.error(`Failed to fetch object ${apiName}:`, error);
      return null;
    }
  }

  /**
   * Create a new object
   */
  async createObject(data: {
    apiName: string;
    label: string;
    pluralLabel: string;
    description?: string;
  }): Promise<ObjectDef | null> {
    try {
      const apiObject = await apiClient.createObject(data);
      this.invalidateCache();
      return transformApiObjectToObjectDef(apiObject);
    } catch (error) {
      console.error('Failed to create object:', error);
      throw error;
    }
  }

  /**
   * Update an object
   */
  async updateObject(apiName: string, data: Partial<{
    label: string;
    pluralLabel: string;
    description: string;
  }>): Promise<ObjectDef | null> {
    try {
      const apiObject = await apiClient.updateObject(apiName, data);
      this.invalidateCache();
      return transformApiObjectToObjectDef(apiObject);
    } catch (error) {
      console.error(`Failed to update object ${apiName}:`, error);
      throw error;
    }
  }

  /**
   * Delete an object
   */
  async deleteObject(apiName: string): Promise<boolean> {
    try {
      await apiClient.deleteObject(apiName);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error(`Failed to delete object ${apiName}:`, error);
      throw error;
    }
  }

  /**
   * Create a field
   */
  async createField(objectApiName: string, field: Partial<FieldDef>): Promise<FieldDef | null> {
    try {
      const apiField = await apiClient.createField(objectApiName, {
        apiName: field.apiName,
        label: field.label,
        type: field.type,
        required: field.required,
        unique: field.unique,
        readOnly: field.readOnly,
        maxLength: field.maxLength,
        minLength: field.minLength,
        min: field.min,
        max: field.max,
        precision: field.precision,
        scale: field.scale,
        picklistValues: field.picklistValues,
        defaultValue: field.defaultValue,
        helpText: field.helpText,
      });
      this.invalidateCache();
      return {
        id: apiField.id,
        apiName: apiField.apiName,
        label: apiField.label,
        type: apiField.type as FieldType,
        custom: apiField.isCustom,
        required: apiField.required,
        unique: apiField.unique,
        readOnly: apiField.readOnly,
        maxLength: apiField.maxLength,
        minLength: apiField.minLength,
        min: apiField.min,
        max: apiField.max,
        precision: apiField.precision,
        scale: apiField.scale,
        picklistValues: apiField.picklistValues,
        defaultValue: apiField.defaultValue,
        helpText: apiField.helpText,
      };
    } catch (error) {
      console.error(`Failed to create field for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Update a field
   */
  async updateField(objectApiName: string, fieldId: string, data: Partial<FieldDef>): Promise<FieldDef | null> {
    try {
      const apiField = await apiClient.updateField(objectApiName, fieldId, data);
      this.invalidateCache();
      return apiField;
    } catch (error) {
      console.error(`Failed to update field ${fieldId} for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a field
   */
  async deleteField(objectApiName: string, fieldId: string): Promise<boolean> {
    try {
      await apiClient.deleteField(objectApiName, fieldId);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error(`Failed to delete field ${fieldId} for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Create a page layout
   */
  async createLayout(objectApiName: string, layout: Partial<PageLayout>): Promise<PageLayout | null> {
    try {
      const apiLayout = await apiClient.createLayout(objectApiName, layout);
      this.invalidateCache();
      return apiLayout;
    } catch (error) {
      console.error(`Failed to create layout for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Update a page layout
   */
  async updateLayout(objectApiName: string, layoutId: string, data: Partial<PageLayout>): Promise<PageLayout | null> {
    try {
      const apiLayout = await apiClient.updateLayout(objectApiName, layoutId, data);
      this.invalidateCache();
      return apiLayout;
    } catch (error) {
      console.error(`Failed to update layout ${layoutId} for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a page layout
   */
  async deleteLayout(objectApiName: string, layoutId: string): Promise<boolean> {
    try {
      await apiClient.deleteLayout(objectApiName, layoutId);
      this.invalidateCache();
      return true;
    } catch (error) {
      console.error(`Failed to delete layout ${layoutId} for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate the cached schema
   */
  invalidateCache(): void {
    this.cachedSchema = null;
    this.cacheTimestamp = 0;
  }

  /**
   * Check if API is reachable
   */
  async isApiAvailable(): Promise<boolean> {
    try {
      await apiClient.health();
      return true;
    } catch {
      return false;
    }
  }
}

export const schemaApiService = new SchemaApiService();
export default schemaApiService;
