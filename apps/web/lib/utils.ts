import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cache for lookup records to avoid repeated API calls
let lookupCache: Record<string, any[]> = {};
let lookupLoadingPromises: Record<string, Promise<any[]>> = {};
let lastCacheClear = Date.now();
const CACHE_TTL = 30000; // 30 seconds

async function getLookupRecords(objectType: string): Promise<any[]> {
  // Clear cache periodically
  if (Date.now() - lastCacheClear > CACHE_TTL) {
    lookupCache = {};
    lookupLoadingPromises = {};
    lastCacheClear = Date.now();
  }

  if (lookupCache[objectType]) {
    return lookupCache[objectType];
  }

  if (lookupLoadingPromises[objectType]) {
    return lookupLoadingPromises[objectType];
  }

  lookupLoadingPromises[objectType] = (objectType === 'User'
    ? apiClient.get<any[]>('/admin/users').then(users => {
        const arr = Array.isArray(users) ? users : [];
        lookupCache[objectType] = arr;
        delete lookupLoadingPromises[objectType];
        return arr;
      })
    : recordsService.getRecords(objectType).then(records => {
        const flattened = records.map(r => ({ id: r.id, ...r.data }));
        lookupCache[objectType] = flattened;
        delete lookupLoadingPromises[objectType];
        return flattened;
      })
  ).catch(() => {
    delete lookupLoadingPromises[objectType];
    return [];
  });

  return lookupLoadingPromises[objectType];
}

/**
 * Pre-load lookup records for an object type (call in useEffect)
 * Returns a promise that resolves when the cache is populated.
 */
export async function preloadLookupRecords(objectType: string): Promise<void> {
  await getLookupRecords(objectType);
}

/**
 * Get display name for a lookup field value (resolves ID to name)
 * Synchronous — reads from the in-memory cache. If cache is not yet populated,
 * kicks off background fetch and returns the raw value. Re-render after cache
 * populates will show the resolved name.
 * @param value The lookup field value (typically an ID)
 * @param objectType The target object type (e.g., 'Account', 'Contact')
 * @returns The display name or the original value if not found
 */
export function resolveLookupDisplayName(value: any, objectType: string): string {
  if (!value) return '-';
  
  // If the value doesn't look like an ID (numeric/timestamp), it might already be a name
  // IDs are typically numeric strings (timestamps) or UUIDs
  const stringValue = String(value);
  const looksLikeId = /^\d+$/.test(stringValue) || 
                      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stringValue);
  
  if (!looksLikeId) {
    // Value is likely already a display name, return it as-is
    return stringValue;
  }
  
  // Read from cache synchronously; kick off background fetch if not cached
  const records = lookupCache[objectType];
  if (!records) {
    // Start loading in background — next render will have the data
    getLookupRecords(objectType);
    return stringValue;
  }
  const record = records.find((r: any) => String(r.id) === stringValue);
  
  if (record) {
    // Return appropriate display field based on object type
    if (objectType === 'Contact') {
      const name = record.name;
      if (name && typeof name === 'object') {
        const parts = [name.salutation, name.firstName, name.lastName].filter(Boolean);
        if (parts.length > 0) return parts.join(' ');
      }
      if (record.firstName || record.lastName) {
        return `${record.firstName || ''} ${record.lastName || ''}`.trim();
      }
      return record.contactNumber || record.email || stringValue;
    }
    if (objectType === 'Account') {
      return record.accountName || record.Account__accountName || record.accountNumber || stringValue;
    }
    if (objectType === 'User') {
      return record.name || record.email || stringValue;
    }
    if (objectType === 'Property') {
      return record.propertyNumber || record.Property__propertyNumber || record.name || stringValue;
    }
    if (objectType === 'Lead') {
      return record.leadNumber || record.name || stringValue;
    }
    if (objectType === 'Deal') {
      return record.dealNumber || record.dealName || record.name || stringValue;
    }
    if (objectType === 'Product') {
      return record.productName || record.name || stringValue;
    }
    if (objectType === 'Quote') {
      return record.quoteNumber || record.quoteName || record.name || stringValue;
    }
    if (objectType === 'Project') {
      return record.projectNumber || record.projectName || record.name || stringValue;
    }
    if (objectType === 'Service') {
      return record.serviceNumber || record.name || stringValue;
    }
    if (objectType === 'Installation') {
      return record.installationNumber || record.installationName || record.name || stringValue;
    }
    // Generic fallback - look for any name or number field
    const keys = Object.keys(record);
    const anyNameField = keys.find(k => k.toLowerCase().includes('name') && record[k]);
    if (anyNameField) return String(record[anyNameField]);
    const anyNumberField = keys.find(k => k.toLowerCase().includes('number') && record[k]);
    if (anyNumberField) return String(record[anyNumberField]);
    
    return record.name || record.label || record.title || stringValue;
  }
  
  return stringValue;
}

/**
 * Check if a field name looks like a lookup field
 * @param fieldName The field name to check
 * @returns The target object type if it's a lookup, null otherwise
 */
export function inferLookupObjectType(fieldName: string): string | null {
  // Normalize the field name for comparison
  const normalized = fieldName.toLowerCase();
  
  // These fields typically store names directly, not IDs - skip them
  const skipFields = ['createdby', 'lastmodifiedby', 'modifiedby', 'assignedteam'];
  if (skipFields.includes(normalized)) {
    return null;
  }
  
  const lookupMappings: Record<string, string> = {
    // Account lookups
    'accountid': 'Account',
    'account': 'Account',
    'parentaccountid': 'Account',
    'parentaccount': 'Account',
    'relatedaccount': 'Account',
    'relatedaccountid': 'Account',
    
    // Contact lookups
    'contactid': 'Contact',
    'contact': 'Contact',
    'contacts': 'Contact',
    'primarycontactid': 'Contact',
    'primarycontact': 'Contact',
    'relatedcontact': 'Contact',
    'relatedcontactid': 'Contact',
    
    // Property lookups
    'propertyid': 'Property',
    'property': 'Property',
    'relatedproperty': 'Property',
    'relatedpropertyid': 'Property',
    
    // Lead lookups
    'leadid': 'Lead',
    'lead': 'Lead',
    'relatedlead': 'Lead',
    'relatedleadid': 'Lead',
    
    // Deal lookups
    'dealid': 'Deal',
    'deal': 'Deal',
    'relateddeal': 'Deal',
    'relateddealid': 'Deal',
    
    // User lookups (only for actual ID fields)
    'userid': 'User',
    'ownerid': 'User',
    'createdbyid': 'User',
    'lastmodifiedbyid': 'User',
    'assignedtoid': 'User',
    'assigneeid': 'User',
    
    // Product lookups
    'productid': 'Product',
    'product': 'Product',
    'relatedproduct': 'Product',
    'relatedproductid': 'Product',
    
    // Quote lookups
    'quoteid': 'Quote',
    'quote': 'Quote',
    'relatedquote': 'Quote',
    'relatedquoteid': 'Quote',
    
    // Project lookups
    'projectid': 'Project',
    'project': 'Project',
    'relatedproject': 'Project',
    'relatedprojectid': 'Project',
    
    // Installation lookups
    'installationid': 'Installation',
    'installation': 'Installation',
    
    // Service lookups
    'serviceid': 'Service',
    'service': 'Service'
  };
  
  return lookupMappings[normalized] || null;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(date);
}
export function formatFieldValue(value: any, fieldType?: string, lookupObject?: string): string {
  // Handle null or undefined
  if (value === null || value === undefined) {
    return '-';
  }

  // Handle Date and DateTime fields
  if (fieldType === 'Date' && typeof value === 'string') {
    const d = new Date(value + (value.includes('T') ? '' : 'T00:00:00'));
    if (!isNaN(d.getTime())) {
      const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(d.getUTCDate()).padStart(2, '0');
      const yyyy = d.getUTCFullYear();
      return `${mm}-${dd}-${yyyy}`;
    }
  }
  if (fieldType === 'DateTime' && typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
    }
  }

  // Handle objects (check before arrays since arrays are objects)
  if (typeof value === 'object' && !Array.isArray(value)) {
    // Handle Address objects
    if (fieldType === 'Address' || (value.street || value.city || value.state || value.postalCode || value.country)) {
      const addressParts = [
        value.street,
        value.city,
        value.state,
        value.postalCode,
        value.country
      ].filter(Boolean);
      return addressParts.length > 0 ? addressParts.join(', ') : '-';
    }
    
    // Handle Geolocation objects
    if (fieldType === 'Geolocation' || (value.latitude || value.longitude)) {
      if (value.latitude && value.longitude) {
        return `${value.latitude}, ${value.longitude}`;
      }
      return '-';
    }

    // Handle PicklistText objects (combined picklist + text value)
    if (fieldType === 'PicklistText' || (value.picklist !== undefined && value.text !== undefined)) {
      const parts = [value.picklist, value.text].filter(Boolean);
      return parts.length > 0 ? parts.join(' — ') : '-';
    }

    // Handle PicklistLookup objects (combined picklist + lookup value)
    if (fieldType === 'PicklistLookup' || (value.picklist !== undefined && value.lookup !== undefined)) {
      const picklistPart = value.picklist || '';
      let lookupPart = '';
      if (value.lookup) {
        if (lookupObject) {
          lookupPart = resolveLookupDisplayName(value.lookup, lookupObject);
        } else {
          // Scan all cached object types to resolve the UUID
          for (const objType of Object.keys(lookupCache)) {
            const records = lookupCache[objType];
            if (records && records.find((r: any) => String(r.id) === String(value.lookup))) {
              lookupPart = resolveLookupDisplayName(value.lookup, objType);
              break;
            }
          }
          if (!lookupPart) lookupPart = String(value.lookup);
        }
      }
      const parts = [picklistPart, lookupPart].filter(Boolean);
      return parts.length > 0 ? parts.join(' — ') : '-';
    }

    // Handle CompositeText objects (like Contact Name with salutation, firstName, lastName)
    // Check for various name key patterns
    const nameKeys = Object.keys(value);
    const hasNameFields = nameKeys.some(k => 
      k.includes('salutation') || k.includes('firstName') || k.includes('lastName') ||
      k.includes('Salutation') || k.includes('FirstName') || k.includes('LastName')
    );
    
    if (fieldType === 'CompositeText' || fieldType === 'Name' || hasNameFields) {
      // Try to find name parts regardless of prefix
      const salutation = value.salutation || value.Contact__name_salutation || 
        nameKeys.find(k => k.toLowerCase().includes('salutation')) && value[nameKeys.find(k => k.toLowerCase().includes('salutation'))!];
      const firstName = value.firstName || value.Contact__name_firstName ||
        nameKeys.find(k => k.toLowerCase().includes('firstname')) && value[nameKeys.find(k => k.toLowerCase().includes('firstname'))!];
      const lastName = value.lastName || value.Contact__name_lastName ||
        nameKeys.find(k => k.toLowerCase().includes('lastname')) && value[nameKeys.find(k => k.toLowerCase().includes('lastname'))!];
      
      const nameParts = [salutation, firstName, lastName].filter(Boolean);
      return nameParts.length > 0 ? nameParts.join(' ') : '-';
    }
    
    // For other objects, convert to JSON string
    return JSON.stringify(value);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ') || '-';
  }

  // Handle primitives
  return String(value);
}