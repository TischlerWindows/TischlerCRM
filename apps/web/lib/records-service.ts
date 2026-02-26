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
   * Helper to flatten record data for display
   * The API returns data in a nested format: { id, data: {...}, createdBy, ... }
   * This flattens it for easier use in tables
   */
  flattenRecord(record: RecordData): Record<string, any> {
    return {
      id: record.id,
      ...record.data,
      createdBy: record.createdBy?.name || record.createdBy?.email || 'Unknown',
      modifiedBy: record.modifiedBy?.name || record.modifiedBy?.email || 'Unknown',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      pageLayoutId: record.pageLayoutId,
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
