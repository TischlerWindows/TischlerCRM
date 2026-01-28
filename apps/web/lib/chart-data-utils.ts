/**
 * Chart Data Utilities
 * Handles data aggregation and transformation for dashboard charts
 */

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: any;
}

export interface AggregationConfig {
  xAxisField: string;
  yAxisField: string;
  objectType: string;
  aggregationType?: 'sum' | 'count' | 'avg' | 'max' | 'min';
}

/**
 * Strip field prefix from schema field names
 * e.g., "Property__status" → "status"
 */
export function stripFieldPrefix(fieldName: string): string {
  const parts = fieldName.split('__');
  if (parts.length > 1) {
    return parts[parts.length - 1] || fieldName;
  }
  return fieldName;
}

/**
 * Get the plural form of an object type for localStorage key
 * e.g., "Property" → "properties"
 */
export function getPluralObjectKey(objectType: string): string {
  const pluralMap: Record<string, string> = {
    property: 'properties',
    contact: 'contacts',
    account: 'accounts',
    lead: 'leads',
    deal: 'deals',
    product: 'products',
    project: 'projects',
    quote: 'quotes',
    installation: 'installations',
    service: 'services',
  };

  const key = objectType.toLowerCase();
  return pluralMap[key] || key + 's';
}

/**
 * Determine if a field contains numeric data
 */
function isNumericField(value: any): boolean {
  if (typeof value === 'number') return true;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return !isNaN(num) && value.trim() !== '';
  }
  return false;
}

/**
 * Convert value to number if possible
 */
function toNumber(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Format a value for display
 */
function formatDisplayValue(value: any): string {
  if (value === null || value === undefined || value === '') {
    return 'Unspecified';
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value).substring(0, 50); // Limit display length
}

/**
 * Aggregate chart data based on configuration
 * Groups records by X-axis field and aggregates Y-axis values
 */
export function aggregateChartData(config: AggregationConfig): ChartDataPoint[] {
  // Get records from localStorage
  const storageKey = getPluralObjectKey(config.objectType);
  const recordsJson = localStorage.getItem(storageKey);
  
  if (!recordsJson) {
    console.warn(`No records found for ${storageKey}`);
    return [];
  }

  let records: any[];
  try {
    records = JSON.parse(recordsJson);
  } catch (e) {
    console.error(`Failed to parse ${storageKey}:`, e);
    return [];
  }

  if (!Array.isArray(records) || records.length === 0) {
    return [];
  }

  // Strip prefixes from field names for lookups
  const xField = stripFieldPrefix(config.xAxisField);
  const yField = stripFieldPrefix(config.yAxisField);
  const aggregationType = config.aggregationType || determineAggregationType(records, yField);

  // Group records by X-axis value
  const grouped: Record<string, any[]> = {};

  for (const record of records) {
    // Try both prefixed and unprefixed field names
    let xValue = record[config.xAxisField] || record[xField];
    
    if (xValue === null || xValue === undefined || xValue === '') {
      xValue = 'Unspecified';
    } else {
      xValue = formatDisplayValue(xValue);
    }

    if (!grouped[xValue]) {
      grouped[xValue] = [];
    }
    const group = grouped[xValue];
    if (group) {
      group.push(record);
    }
  }

  // Aggregate Y-axis values for each group
  const result: ChartDataPoint[] = [];

  for (const [xValue, groupRecords] of Object.entries(grouped)) {
    let aggregatedValue = 0;

    switch (aggregationType) {
      case 'sum':
        aggregatedValue = groupRecords.reduce((sum, record) => {
          const val = record[config.yAxisField] || record[yField];
          return sum + toNumber(val);
        }, 0);
        break;

      case 'count':
        aggregatedValue = groupRecords.length;
        break;

      case 'avg':
        const total = groupRecords.reduce((sum, record) => {
          const val = record[config.yAxisField] || record[yField];
          return sum + toNumber(val);
        }, 0);
        aggregatedValue = groupRecords.length > 0 ? total / groupRecords.length : 0;
        break;

      case 'max':
        aggregatedValue = Math.max(
          ...groupRecords.map(record => {
            const val = record[config.yAxisField] || record[yField];
            return toNumber(val);
          })
        );
        break;

      case 'min':
        aggregatedValue = Math.min(
          ...groupRecords.map(record => {
            const val = record[config.yAxisField] || record[yField];
            return toNumber(val);
          })
        );
        break;

      default:
        aggregatedValue = groupRecords.length;
    }

    result.push({
      label: xValue,
      value: Math.round(aggregatedValue * 100) / 100, // Round to 2 decimals
    });
  }

  // Sort by label for consistent display
  return result.sort((a, b) => String(a.label).localeCompare(String(b.label)));
}

/**
 * Determine the best aggregation type based on data
 */
function determineAggregationType(records: any[], fieldName: string): 'sum' | 'count' | 'avg' {
  if (records.length === 0) return 'count';

  // Check if the field has numeric values
  const sampleValues = records
    .slice(0, 10)
    .map(r => r[fieldName])
    .filter(v => v !== null && v !== undefined);

  if (sampleValues.some(v => isNumericField(v))) {
    return 'sum';
  }

  return 'count';
}

/**
 * Get available fields for a given object type
 */
export function getAvailableFields(objectType: string): string[] {
  const fieldsMap: Record<string, string[]> = {
    properties: [
      'Property__address',
      'Property__status',
      'Property__propertyType',
      'Property__price',
      'Property__squareFeet',
      'Property__bedrooms',
      'Property__bathrooms',
      'Property__yearBuilt',
      'Property__city',
      'Property__state',
      'Property__zipCode',
      'Property__owner',
      'Property__lastModifiedAt',
    ],
    contacts: [
      'Contact__firstName',
      'Contact__lastName',
      'Contact__email',
      'Contact__phone',
      'Contact__company',
      'Contact__title',
      'Contact__status',
      'Contact__lastActivity',
    ],
    accounts: [
      'Account__name',
      'Account__industry',
      'Account__revenue',
      'Account__employees',
      'Account__status',
      'Account__type',
      'Account__rating',
    ],
    leads: [
      'Lead__name',
      'Lead__company',
      'Lead__status',
      'Lead__source',
      'Lead__estimatedValue',
      'Lead__rating',
    ],
    deals: [
      'Deal__name',
      'Deal__amount',
      'Deal__stage',
      'Deal__probability',
      'Deal__closeDate',
      'Deal__owner',
    ],
    products: [
      'Product__name',
      'Product__category',
      'Product__unitPrice',
      'Product__stockQuantity',
      'Product__status',
    ],
    projects: [
      'Project__name',
      'Project__status',
      'Project__budget',
      'Project__startDate',
      'Project__endDate',
      'Project__progress',
    ],
    quotes: [
      'Quote__number',
      'Quote__totalAmount',
      'Quote__status',
      'Quote__validUntil',
      'Quote__customer',
    ],
    installations: [
      'Installation__site',
      'Installation__scheduledDate',
      'Installation__status',
      'Installation__teamSize',
      'Installation__completionDate',
    ],
    services: [
      'Service__property',
      'Service__serviceType',
      'Service__scheduledDate',
      'Service__status',
      'Service__technician',
    ],
  };

  return fieldsMap[objectType.toLowerCase()] || [];
}
