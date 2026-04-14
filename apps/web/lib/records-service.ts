// Records service for fetching and managing records via API
import { apiClient } from './api-client';

export interface RecordData {
  id: string;
  objectId: string;
  pageLayoutId?: string;
  data: Record<string, any>;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  modifiedBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateRecordInput {
  data: Record<string, any>;
  pageLayoutId?: string;
}

export interface UpdateRecordInput {
  data: Record<string, any>;
}

class RecordsService {
  /**
   * Get all records for an object
   */
  async getRecords(objectApiName: string, options?: { limit?: number; offset?: number }): Promise<RecordData[]> {
    try {
      const records = await apiClient.getRecords(objectApiName, options);
      return records;
    } catch (error) {
      console.error(`Failed to fetch records for ${objectApiName}:`, error);
      // Return empty array on error, let the UI handle it
      return [];
    }
  }

  /**
   * Get a single record by ID
   */
  async getRecord(objectApiName: string, recordId: string): Promise<RecordData | null> {
    try {
      const record = await apiClient.getRecord(objectApiName, recordId);
      return record;
    } catch (error) {
      console.error(`Failed to fetch record ${recordId} for ${objectApiName}:`, error);
      return null;
    }
  }

  /**
   * Create a new record
   */
  async createRecord(objectApiName: string, input: CreateRecordInput): Promise<RecordData | null> {
    try {
      const record = await apiClient.createRecord(objectApiName, input.data, input.pageLayoutId);
      return record;
    } catch (error) {
      console.error(`Failed to create record for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Update an existing record
   */
  async updateRecord(objectApiName: string, recordId: string, input: UpdateRecordInput): Promise<RecordData | null> {
    try {
      const record = await apiClient.updateRecord(objectApiName, recordId, input.data);
      return record;
    } catch (error) {
      console.error(`Failed to update record ${recordId} for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a record
   */
  async deleteRecord(objectApiName: string, recordId: string): Promise<boolean> {
    try {
      await apiClient.deleteRecord(objectApiName, recordId);
      return true;
    } catch (error) {
      console.error(`Failed to delete record ${recordId} for ${objectApiName}:`, error);
      throw error;
    }
  }

  /**
   * Remove per-record page layout overrides so records revert to the object's
   * current record-type / default layout.  Only records pinned to
   * `fromPageLayoutId` are affected.
   */
  async migrateRecordLayouts(
    objectApiName: string,
    fromPageLayoutId: string,
  ): Promise<{ updatedCount: number }> {
    try {
      return await apiClient.migrateRecordLayouts(objectApiName, fromPageLayoutId);
    } catch (error) {
      console.error(
        `Failed to migrate record layouts for ${objectApiName} from ${fromPageLayoutId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Helper to flatten record data for display
   * The API returns data in a nested format: { id, data: {...}, createdBy, ... }
   * This flattens it for easier use in tables
   */
  flattenRecord(record: RecordData): Record<string, any> {
    // Strip object prefixes from data keys (e.g., "Property__address" → "address")
    // so list pages can access values via simple unprefixed column ids.
    //
    // When both a prefixed key (e.g. "Lead__status") and an unprefixed key
    // ("status") exist in the data, the PREFIXED value wins because it is the
    // more specific / authoritative value (and likely the most recent edit).
    const stripped: Record<string, any> = {};
    const prefixedCleanKeys = new Set<string>(); // track clean keys that came from a prefixed source
    if (record.data && typeof record.data === 'object') {
      for (const [key, value] of Object.entries(record.data)) {
        // Keep original prefixed key so edit forms can match by apiName
        stripped[key] = value;
        const cleanKey = key.replace(/^[A-Za-z]+__/, '');
        const hadPrefix = cleanKey !== key;
        if (hadPrefix) {
          // Prefixed keys always overwrite the stripped alias
          stripped[cleanKey] = value;
          prefixedCleanKeys.add(cleanKey);
        } else if (!prefixedCleanKeys.has(cleanKey)) {
          // Unprefixed key only sets the alias when no prefixed source claimed it
          stripped[cleanKey] = value;
        }
      }
    }

    // Prefer the DB FK column, then fall back to _pageLayoutId stored in data blob
    const resolvedPageLayoutId = record.pageLayoutId
      || (record.data as Record<string, any>)?._pageLayoutId
      || stripped._pageLayoutId;

    return {
      ...stripped,
      // DB-level fields MUST override anything from the data blob
      id: record.id,
      // Convenience keys for list/table columns
      createdBy: record.createdBy?.name || record.createdBy?.email || 'Unknown',
      modifiedBy: record.modifiedBy?.name || record.modifiedBy?.email || 'Unknown',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      pageLayoutId: resolvedPageLayoutId,
      // System-field aliases so layout fields (CreatedDate, CreatedById, etc.)
      // resolve to the correct DB-level values in forms and detail views.
      Id: record.id,
      CreatedDate: record.createdAt,
      LastModifiedDate: record.updatedAt,
      CreatedById: record.createdBy?.id ?? '',
      LastModifiedById: record.modifiedBy?.id ?? '',
    };
  }

  /**
   * Flatten multiple records
   */
  flattenRecords(records: RecordData[]): Record<string, any>[] {
    return records.map(r => this.flattenRecord(r));
  }
}

export const recordsService = new RecordsService();
export default recordsService;
