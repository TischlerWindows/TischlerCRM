import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { evaluateFormula, extractCrossObjectRefs, ExpressionContext } from '@/lib/expressions';
import { FieldDef, ObjectDef } from '@/lib/schema';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Cache for lookup records to avoid repeated API calls
let lookupCache: Record<string, any[]> = {};
let lookupLoadingPromises: Record<string, Promise<any[]>> = {};
let lastCacheClear = Date.now();
const CACHE_TTL = 30000; // 30 seconds

/** Return the full cached record for a given object type + ID, or null if not cached. */
export function getLookupCachedRecord(objectType: string, id: string): any | null {
  const records = lookupCache[objectType];
  if (!records) return null;
  return records.find((r: any) => String(r.id) === String(id)) ?? null;
}

/** Seed the global lookup cache directly (e.g. from data already fetched by the page). */
export function seedLookupCache(objectType: string, records: any[]): void {
  lookupCache[objectType] = records;
}

/**
 * Upsert a single record into the global lookup cache. Used after inline-create
 * so resolveLookupDisplayName finds the new record on the very next render
 * instead of returning the raw id while the background fetch completes.
 */
export function upsertLookupCacheRecord(objectType: string, record: any): void {
  if (!record || !record.id) return;
  const existing = lookupCache[objectType] ?? [];
  const idx = existing.findIndex((r: any) => String(r.id) === String(record.id));
  if (idx >= 0) {
    const next = existing.slice();
    next[idx] = { ...existing[idx], ...record };
    lookupCache[objectType] = next;
  } else {
    lookupCache[objectType] = [...existing, record];
  }
}

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
 * Extract a display string from a CompositeText value (an object with
 * name-like sub-fields such as salutation, firstName, lastName — possibly
 * prefixed with the object/field API name).
 */
function resolveCompositeTextValue(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const keys = Object.keys(obj);
  const findVal = (pattern: string) => {
    const k = keys.find(k => k.toLowerCase().includes(pattern));
    return k ? obj[k] : undefined;
  };
  const salutation = obj.salutation || findVal('salutation');
  const firstName = obj.firstName || findVal('firstname');
  const lastName = obj.lastName || findVal('lastname');
  const parts = [salutation, firstName, lastName].filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  // Fallback: join all string values
  const allStringVals = Object.values(obj).filter(v => typeof v === 'string' && v) as string[];
  return allStringVals.length > 0 ? allStringVals.join(' ') : null;
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
  
  // If the value doesn't look like an ID, it might already be a name
  // IDs are typically numeric strings, UUIDs, or alphanumeric hashes
  const stringValue = String(value);
  const looksLikeId = /^\d+$/.test(stringValue) || 
                      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stringValue) ||
                      /^[0-9a-zA-Z]{10,}$/.test(stringValue);
  
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
      // Check both unprefixed and prefixed name fields
      const nameObj = record.name || record.Contact__name;
      if (nameObj && typeof nameObj === 'object') {
        const resolved = resolveCompositeTextValue(nameObj);
        if (resolved) return resolved;
      }
      const fn = record.firstName || record.Contact__firstName;
      const ln = record.lastName || record.Contact__lastName;
      if (fn || ln) {
        return `${fn || ''} ${ln || ''}`.trim();
      }
      return record.contactNumber || record.Contact__contactNumber || record.email || record.Contact__email || stringValue;
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
      const leadNum = record.leadNumber || record.Lead__leadNumber;
      const contactName = record.contactName || record.Lead__contactName;
      const leadFn = record.firstName || record.Lead__firstName || '';
      const leadLn = record.lastName || record.Lead__lastName || '';
      const rawLn = leadLn && leadLn !== 'N/A' ? leadLn : '';
      const leadName = contactName || `${leadFn} ${rawLn}`.trim();
      if (leadNum && leadName) return `${leadNum} - ${leadName}`;
      return leadNum || leadName || record.name || stringValue;
    }
    if (objectType === 'Opportunity') {
      const oppNum = record.opportunityNumber || record.Opportunity__opportunityNumber;
      const oppName = record.opportunityName || record.Opportunity__opportunityName;
      if (oppNum && oppName) return `${oppNum} - ${oppName}`;
      return oppNum || oppName || record.name || stringValue;
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
    if (anyNameField) {
      const nameVal = record[anyNameField];
      if (typeof nameVal === 'object' && nameVal !== null) {
        const resolved = resolveCompositeTextValue(nameVal);
        if (resolved) return resolved;
      }
      return String(nameVal);
    }
    const anyNumberField = keys.find(k => k.toLowerCase().includes('number') && record[k]);
    if (anyNumberField) return String(record[anyNumberField]);
    
    const fallbackName = record.name || record.label || record.title;
    if (fallbackName && typeof fallbackName === 'object') {
      const resolved = resolveCompositeTextValue(fallbackName);
      if (resolved) return resolved;
    }
    return fallbackName ? String(fallbackName) : stringValue;
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
    
    // Opportunity lookups
    'opportunityid': 'Opportunity',
    'opportunity': 'Opportunity',
    'relatedopportunity': 'Opportunity',
    'relatedopportunityid': 'Opportunity',
    'dealid': 'Opportunity',
    'deal': 'Opportunity',
    'relateddeal': 'Opportunity',
    'relateddealid': 'Opportunity',
    
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
export function formatFieldValue(rawValue: any, fieldType?: string, lookupObject?: string): string {
  // Auto-parse JSON strings that look like objects/arrays
  let value = rawValue;
  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      value = JSON.parse(value);
    } catch {
      // Not valid JSON, treat as plain string
    }
  }

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
        // If resolveLookupDisplayName returned '-', treat as unresolved
        if (lookupPart === '-') lookupPart = String(value.lookup);
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

  // Multi-select values stored as semicolon-separated strings → display with commas
  if (typeof value === 'string' && value.includes(';') &&
      (fieldType === 'MultiPicklist' || fieldType === 'MultiSelectPicklist')) {
    return value.split(';').map(s => s.trim()).filter(Boolean).join(', ') || '-';
  }

  // Currency — US dollar format (e.g. $1,234.56)
  if (fieldType === 'Currency') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!isNaN(n)) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(n);
    }
  }

  // Percent — append % sign
  if (fieldType === 'Percent') {
    const n = typeof value === 'number' ? value : Number(value);
    if (!isNaN(n)) return `${n}%`;
  }

  // Checkbox — human-readable Yes/No (matches renderValue)
  if (fieldType === 'Checkbox') {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (value === 'true') return 'Yes';
    if (value === 'false') return 'No';
  }

  // Handle primitives
  return String(value);
}

/**
 * Evaluate a formula field value for a record, including cross-object references.
 * Uses the in-memory lookupCache for related record resolution (synchronous).
 *
 * Cross-object syntax: LookupFieldApiName.TargetFieldApiName
 * Example: primaryContact.phone → fetches the Contact record referenced by
 * the "primaryContact" lookup field on this record, returns its "phone" value.
 *
 * @param formulaExpr The formula expression string
 * @param record The flattened record data
 * @param objectDef The object definition (to look up field types and lookupObject)
 * @returns The evaluated value, or null if evaluation fails
 */
export function evaluateFormulaForRecord(
  formulaExpr: string,
  record: Record<string, any>,
  objectDef?: ObjectDef | null
): any {
  if (!formulaExpr || !record) return null;

  // Build context from all record fields (both prefixed and bare keys)
  const context: ExpressionContext = {};
  for (const [key, val] of Object.entries(record)) {
    context[key] = val as any;
    const bare = key.replace(/^[A-Za-z]+__/, '');
    if (bare !== key) context[bare] = val as any;
  }

  // Resolve cross-object references from the lookup cache
  if (objectDef) {
    const crossRefs = extractCrossObjectRefs(formulaExpr);
    for (const ref of crossRefs) {
      // Find the lookup field definition
      const lookupFieldDef = objectDef.fields.find(f => {
        const bare = f.apiName.replace(/^[A-Za-z]+__/, '');
        return f.apiName === ref.lookupField || bare === ref.lookupField;
      });
      if (!lookupFieldDef) continue;

      const lookupTypes = ['Lookup', 'ExternalLookup', 'LookupUser', 'PicklistLookup'];
      if (!lookupTypes.includes(lookupFieldDef.type)) continue;

      const lookupObject = lookupFieldDef.lookupObject || (lookupFieldDef.type === 'LookupUser' ? 'User' : undefined);
      if (!lookupObject) continue;

      // Get the lookup value (UUID) from the record
      let lookupValue = record[lookupFieldDef.apiName] ?? record[lookupFieldDef.apiName.replace(/^[A-Za-z]+__/, '')];
      if (lookupFieldDef.type === 'PicklistLookup' && typeof lookupValue === 'object' && lookupValue !== null) {
        lookupValue = lookupValue.lookup;
      }
      if (!lookupValue) continue;

      // Look up the related record from the lookup cache
      const cachedRecords = lookupCache[lookupObject];
      if (!cachedRecords) {
        // Trigger background load so next render will have the data
        getLookupRecords(lookupObject);
        continue;
      }

      const relatedRecord = cachedRecords.find((r: any) => String(r.id) === String(lookupValue));
      if (!relatedRecord) continue;

      // Resolve the target field from the related record
      const targetField = ref.targetField;
      let resolvedValue = relatedRecord[targetField];
      if (resolvedValue === undefined) {
        // Try bare key
        const bare = targetField.replace(/^[A-Za-z]+__/, '');
        resolvedValue = relatedRecord[bare];
        if (resolvedValue === undefined) {
          // Try matching with any prefix
          for (const k of Object.keys(relatedRecord)) {
            const kBare = k.replace(/^[A-Za-z]+__/, '');
            if (kBare === bare || kBare === targetField) {
              resolvedValue = relatedRecord[k];
              break;
            }
          }
        }
      }

      const contextKey = `${ref.lookupField}.${ref.targetField}`;
      context[contextKey] = resolvedValue as any;
    }
  }

  return evaluateFormula(formulaExpr, context);
}