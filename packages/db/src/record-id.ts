import { randomBytes } from 'crypto';

const RECORD_ID_PREFIXES: Record<string, string> = {
  // Domain objects (001–011)
  Property: '001',
  Contact: '002',
  Account: '003',
  Product: '004',
  Lead: '005',
  Opportunity: '006',
  Project: '007',
  Service: '008',
  Quote: '009',
  Installation: '010',
  User: '011',

  // System / infrastructure models (012–030)
  Profile: '012',
  Department: '013',
  AuditLog: '014',
  LoginEvent: '015',
  CustomObject: '016',
  CustomField: '017',
  Relationship: '018',
  PageLayout: '019',
  LayoutTab: '020',
  LayoutSection: '021',
  LayoutField: '022',
  Record: '023',
  Report: '024',
  ReportFolder: '025',
  Dashboard: '026',
  DashboardWidget: '027',
  Setting: '028',
  UserPreference: '029',
  Integration: '030',
  UserIntegration: '031',
  WorkOrder: '032',
  TeamMember: '033',
  Task: '034',
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
 * Every Prisma model has a fixed prefix. Custom objects created at runtime
 * receive a dynamically assigned prefix via registerRecordIdPrefix().
 */
export function generateRecordId(modelName: string): string {
  const prefix = RECORD_ID_PREFIXES[modelName];
  if (!prefix) {
    throw new Error(
      `No record ID prefix registered for "${modelName}". ` +
      `Register it with registerRecordIdPrefix() first.`
    );
  }
  return prefix + generateBase62Suffix(SUFFIX_LENGTH);
}

/** Alias for generateRecordId — shorter name for use in prisma.*.create() calls. */
export const generateId = generateRecordId;

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
 * chars starting with a 3-digit prefix).
 */
export function isRecordId(value: string): boolean {
  return /^[0-9]{3}[A-Za-z0-9]{12}$/.test(value);
}
