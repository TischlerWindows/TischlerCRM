import { randomBytes } from 'crypto';

const RECORD_ID_PREFIXES: Record<string, string> = {
  Property: '001',
  Contact: '002',
  Account: '003',
  Product: '004',
  Lead: '005',
  Deal: '006',
  Project: '007',
  Service: '008',
  Quote: '009',
  Installation: '010',
  User: '011',
};

const BASE62_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const SUFFIX_LENGTH = 12;

function generateBase62Suffix(length: number): string {
  const bytes = randomBytes(length);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE62_CHARS[bytes[i]! % 62];
  }
  return result;
}

/**
 * Generate a standardized record ID.
 *
 * Format: 3-char numeric prefix + 12-char base62 suffix = 15 characters.
 *
 * Core objects have fixed prefixes (001–011). Custom objects receive a
 * dynamically assigned prefix starting at 012.
 */
export function generateRecordId(objectApiName: string): string {
  const prefix = RECORD_ID_PREFIXES[objectApiName];
  if (!prefix) {
    throw new Error(
      `No record ID prefix registered for object "${objectApiName}". ` +
      `Register it with registerRecordIdPrefix() first.`
    );
  }
  return prefix + generateBase62Suffix(SUFFIX_LENGTH);
}

/**
 * Register a prefix for a custom (user-created) object at runtime.
 * Returns the assigned prefix.
 */
export function registerRecordIdPrefix(objectApiName: string): string {
  if (RECORD_ID_PREFIXES[objectApiName]) {
    return RECORD_ID_PREFIXES[objectApiName]!;
  }
  const nextNum = Math.max(
    ...Object.values(RECORD_ID_PREFIXES).map((p) => parseInt(p, 10)),
    11,
  ) + 1;
  const prefix = String(nextNum).padStart(3, '0');
  RECORD_ID_PREFIXES[objectApiName] = prefix;
  return prefix;
}

/**
 * Look up the prefix for a given object name (or undefined if not registered).
 */
export function getRecordIdPrefix(objectApiName: string): string | undefined {
  return RECORD_ID_PREFIXES[objectApiName];
}

/**
 * Detect whether a string looks like a standardized record ID (15 alphanumeric
 * chars starting with a 3-digit prefix) vs a UUID.
 */
export function isRecordId(value: string): boolean {
  return /^[0-9]{3}[A-Za-z0-9]{12}$/.test(value);
}

/**
 * Detect whether a string is a UUID v4 (has dashes).
 */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
