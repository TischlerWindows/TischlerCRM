import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id';
import { extractAddressFromRecord, generatePropertyNumber, getPropertyPrefix } from '@crm/types';
import { logAudit, extractIp } from '../audit.js';
import { tryRenameDropboxFolder, tryEnsureLinkedFolder, tryEnsurePropertyRootFolder } from './dropbox.js';
import { runWorkflows } from '../workflow-engine.js';
import { runTriggers } from '../lib/triggers/trigger-engine.js';
import { z } from 'zod';

// ── Permission helper ──────────────────────────────────────────────
const PROJECT_CHILD_OBJECTS = new Set(['AutoCad', 'CadIndexItem', 'InstallProgressItem']);
const YEAR_SCOPED_NUMBER_PREFIXES: Record<string, string> = {
  opportunityNumber: 'OPP',
};

function getYearScopedNumberSequence(
  records: Array<{ data: unknown; createdAt: Date }>,
  fieldApiName: string,
  year: number,
): number {
  const yearPrefix = String(year % 100).padStart(2, '0');
  const legacyPrefix = YEAR_SCOPED_NUMBER_PREFIXES[fieldApiName];
  let maxSequence = 0;

  for (const record of records) {
    if (record.createdAt.getUTCFullYear() !== year || !record.data || typeof record.data !== 'object') continue;
    const value = Object.entries(record.data as Record<string, unknown>)
      .find(([key]) => key.replace(/^[A-Za-z]+__/, '') === fieldApiName)?.[1];
    if (typeof value !== 'string') continue;

    const withoutRequote = value.trim().replace(/\s*-\s*Requote\s*\d+$/i, '');
    const withoutLegacyPrefix = withoutRequote.replace(new RegExp(`^${legacyPrefix}[-\\s]?`, 'i'), '');
    if (!/^\d+$/.test(withoutLegacyPrefix)) continue;

    const sequence = Number(withoutLegacyPrefix.slice(-3));
    if (sequence > maxSequence) maxSequence = sequence;
  }

  return maxSequence;
}

function formatYearScopedNumber(year: number, sequence: number): string {
  return `${String(year % 100).padStart(2, '0')}${String(sequence).padStart(3, '0')}`;
}

async function getRelatedLookupFieldApiName(
  childObjectId: string,
  parentObjectApiName: string,
): Promise<string | undefined> {
  const parentObject = await prisma.customObject.findFirst({
    where: { apiName: { equals: parentObjectApiName, mode: 'insensitive' } },
  });
  if (!parentObject) return undefined;
  const relationship = await prisma.relationship.findFirst({
    where: { childObjectId, parentObjectId: parentObject.id },
    include: { field: { select: { apiName: true } } },
  });
  return relationship?.field.apiName;
}

async function getOpportunityLookupFieldApiName(childObjectId: string): Promise<string | undefined> {
  return getRelatedLookupFieldApiName(childObjectId, 'Opportunity');
}

function getOpportunityLookupRecordId(
  data: Record<string, unknown>,
  objectApiName: string,
  fieldApiName: string | undefined,
  relatedObjectApiName = 'Opportunity',
): string | undefined {
  if (fieldApiName) {
    const bareName = fieldApiName.replace(/^[A-Za-z]+__/, '');
    const value = data[fieldApiName] ?? data[bareName] ?? data[`${objectApiName}__${bareName}`];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value === 'object') {
      const reference = value as Record<string, unknown>;
      const id = reference.lookup ?? reference.id ?? reference.value;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  }

  const fallback = Object.entries(data).find(([key, value]) => {
    const bareName = key.replace(/^[A-Za-z]+__/, '').toLowerCase();
    return bareName.includes(relatedObjectApiName.toLowerCase())
      && !bareName.includes('number')
      && !bareName.includes('name')
      && (typeof value === 'string' || (value !== null && typeof value === 'object'));
  })?.[1];
  if (typeof fallback === 'string' && fallback.trim()) return fallback.trim();
  if (fallback && typeof fallback === 'object') {
    const reference = fallback as Record<string, unknown>;
    const id = reference.lookup ?? reference.id ?? reference.value;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return undefined;
}

function getOpportunityNumber(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key.replace(/^[A-Za-z]+__/, '').toLowerCase() === 'opportunitynumber'
      && typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

async function getOpportunityNumbersById(opportunityIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(opportunityIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const opportunityObject = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Opportunity', mode: 'insensitive' } },
  });
  if (!opportunityObject) return new Map();
  const records = await prisma.record.findMany({
    where: { objectId: opportunityObject.id, id: { in: uniqueIds }, deletedAt: null },
    select: { id: true, data: true },
  });
  return new Map(records.flatMap((record) => {
    const number = getOpportunityNumber(record.data);
    return number ? [[record.id, number] as [string, string]] : [];
  }));
}

function getPropertyNumber(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key.replace(/^[A-Za-z]+__/, '').toLowerCase() === 'propertynumber'
      && typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function normalizeSalesforceIdForComparison(value: string): string {
  const id = value.trim();
  if (!/^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/.test(id)) return id.toLowerCase();
  if (id.length === 18) return id.toUpperCase();

  const checksumChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
  let checksum = '';
  for (let block = 0; block < 3; block++) {
    let uppercaseMask = 0;
    for (let position = 0; position < 5; position++) {
      const character = id[block * 5 + position]!;
      if (character >= 'A' && character <= 'Z') uppercaseMask |= 1 << position;
    }
    checksum += checksumChars[uppercaseMask];
  }
  return `${id}${checksum}`.toUpperCase();
}

function getSalesforceIdLookupCandidates(value: string): string[] {
  const id = value.trim();
  if (/^[A-Za-z0-9]{15}$/.test(id)) {
    return [id, normalizeSalesforceIdForComparison(id)];
  }
  if (/^[A-Za-z0-9]{18}$/.test(id)) return [id, id.slice(0, 15)];
  return [id];
}

function getImportedSalesforceId(
  data: Record<string, unknown>,
  sfIdField?: string,
): string | undefined {
  const idHeader = Object.keys(data).find(
    (key) => key.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'id',
  );
  const candidates = [
    sfIdField ? data[sfIdField] : undefined,
    data.Id,
    data.id,
    data.__sfId,
    idHeader ? data[idHeader] : undefined,
  ];
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const value = String(candidate).trim();
    if (value) return value;
  }
  return undefined;
}

function sanitizeImportedValue(value: unknown): unknown {
  if (typeof value === 'string') return value.replace(/\u0000/g, '');
  if (Array.isArray(value)) return value.map(sanitizeImportedValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key.replace(/\u0000/g, ''),
        sanitizeImportedValue(nestedValue),
      ]),
    );
  }
  return value;
}

async function getPropertyNumbersById(propertyIds: string[]): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(propertyIds.filter(Boolean))];
  if (uniqueIds.length === 0) return new Map();
  const propertyObject = await prisma.customObject.findFirst({
    where: { apiName: { equals: 'Property', mode: 'insensitive' } },
  });
  if (!propertyObject) return new Map();
  const records = await prisma.record.findMany({
    where: { objectId: propertyObject.id, id: { in: uniqueIds }, deletedAt: null },
    select: { id: true, data: true },
  });
  return new Map(records.flatMap((record) => {
    const number = getPropertyNumber(record.data);
    return number ? [[record.id, number] as [string, string]] : [];
  }));
}

function getStandaloneProjectNumber(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (key.replace(/^[A-Za-z]+__/, '').toLowerCase() !== 'projectnumber' || typeof value !== 'string') continue;
    const match = value.trim().match(/^NT-?\d+$/i);
    if (match) return value.trim().replace('-', '').toUpperCase();
  }
  return undefined;
}

function getMaxStandaloneProjectSequence(records: Array<{ data: unknown }>): number {
  let maxSequence = 0;
  for (const record of records) {
    const number = getStandaloneProjectNumber(record.data);
    const sequence = number?.match(/^NT(\d+)$/i)?.[1];
    if (sequence) maxSequence = Math.max(maxSequence, Number(sequence));
  }
  return maxSequence;
}

function formatStandaloneProjectNumber(sequence: number): string {
  return `NT${String(sequence).padStart(4, '0')}`;
}

async function addProjectNumberFormula<T extends { id: string; data: unknown }>(
  records: T[],
  objectApiName: string,
  objectId: string,
): Promise<T[]> {
  if (objectApiName.toLowerCase() !== 'project' || records.length === 0) return records;
  const lookupFieldApiName = await getOpportunityLookupFieldApiName(objectId);
  const projectRecords = await prisma.record.findMany({
    where: { objectId, deletedAt: null },
    select: { id: true, data: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const linkedOpportunityIds = new Map<string, string>();
  for (const project of projectRecords) {
    const data = project.data && typeof project.data === 'object'
      ? project.data as Record<string, unknown>
      : {};
    const opportunityId = getOpportunityLookupRecordId(data, objectApiName, lookupFieldApiName);
    if (opportunityId) linkedOpportunityIds.set(project.id, opportunityId);
  }
  const opportunityNumbers = await getOpportunityNumbersById([...linkedOpportunityIds.values()]);
  let nextStandaloneSequence = getMaxStandaloneProjectSequence(projectRecords);
  const standaloneNumbers = new Map<string, string>();

  for (const project of projectRecords) {
    const data = project.data && typeof project.data === 'object'
      ? project.data as Record<string, unknown>
      : {};
    const opportunityId = linkedOpportunityIds.get(project.id);
    const linkedOpportunityNumber = opportunityId ? opportunityNumbers.get(opportunityId) : undefined;

    const existingNumber = getStandaloneProjectNumber(data);
    if (existingNumber) {
      standaloneNumbers.set(project.id, existingNumber);
    } else if (!linkedOpportunityNumber) {
      nextStandaloneSequence += 1;
      const projectNumber = formatStandaloneProjectNumber(nextStandaloneSequence);
      await prisma.record.update({
        where: { id: project.id },
        data: {
          data: { ...data, projectNumber, [`${objectApiName}__projectNumber`]: projectNumber },
        },
      });
      standaloneNumbers.set(project.id, projectNumber);
    }
  }

  return records.map((record, index) => {
    const data = record.data && typeof record.data === 'object'
      ? record.data as Record<string, unknown>
      : {};
    const opportunityId = linkedOpportunityIds.get(record.id);
    const projectNumber = (opportunityId ? opportunityNumbers.get(opportunityId) : undefined)
      ?? standaloneNumbers.get(record.id)
      ?? getStandaloneProjectNumber(data)
      ?? '';
    const { projectNumber: _legacyNumber, Project__projectNumber: _legacyPrefixedNumber, ...otherData } = data;
    return {
      ...record,
      data: { ...otherData, projectNumber, Project__projectNumber: projectNumber },
    } as T;
  });
}

function getPropertyNumbers(records: Array<{ data: unknown }>): string[] {
  const numbers: string[] = [];
  for (const record of records) {
    if (!record.data || typeof record.data !== 'object') continue;
    for (const [key, value] of Object.entries(record.data as Record<string, unknown>)) {
      if (key.replace(/^[A-Za-z]+__/, '').toLowerCase() === 'propertynumber' && typeof value === 'string') {
        numbers.push(value.trim());
      }
    }
  }
  return numbers;
}

async function getLinkedOpportunityNumber(
  data: Record<string, unknown>,
  objectId: string,
  objectApiName: string,
): Promise<string | undefined> {
  const fieldApiName = await getOpportunityLookupFieldApiName(objectId)
  const opportunityId = getOpportunityLookupRecordId(data, objectApiName, fieldApiName)
  if (!opportunityId) return undefined
  const numbers = await getOpportunityNumbersById([opportunityId])
  return numbers.get(opportunityId)
}

async function checkObjectPermission(
  userId: string,
  userRole: string,
  objectApiName: string,
  action: 'read' | 'create' | 'edit' | 'delete'
): Promise<boolean> {
  // ADMIN users always have full access
  if (userRole === 'ADMIN') return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
    },
  });
  if (!user) return false;

  // If user has no profile — no permissions configured yet, allow access
  if (!user.profile) return true;

  // Check profile object permissions
  // Profile permissions are stored with lowercase-plural storage keys
  // (e.g. 'properties', 'contacts', 'companies') but objectApiName is
  // the canonical CamelCase singular (e.g. 'Property', 'Contact', 'Account').
  // Map from canonical API name → storage key before looking up.
  const API_TO_STORAGE: Record<string, string> = {
    Property:     'properties',
    Contact:      'contacts',
    Account:      'companies',
    Product:      'products',
    Lead:         'leads',
    Opportunity:  'opportunities',
    Project:      'projects',
    Service:      'service',
    Quote:        'quotes',
    Installation: 'installations',
    WorkOrder:    'workorders',
  };
  const profilePerms = (user.profile?.permissions as any) || {};
  // Project widget rows are required child records and are not separately
  // configurable in profile permissions.
  const permissionObject = PROJECT_CHILD_OBJECTS.has(objectApiName) ? 'Project' : objectApiName;
  const storageKey = API_TO_STORAGE[permissionObject] ?? permissionObject.toLowerCase();
  const objPerms = profilePerms?.objects?.[storageKey] ?? profilePerms?.objects?.[objectApiName];
  if (objPerms?.[action]) return true;

  return false;
}

function canManageClockInRecord(
  record: { data: unknown },
  apiName: string,
  userId: string,
  userRole: string,
): boolean {
  if (userRole === 'ADMIN' || apiName.toLowerCase() !== 'clockin') return true;
  const data = record.data && typeof record.data === 'object'
    ? record.data as Record<string, unknown>
    : {};
  const owner = data.clockedInByUserId ?? data[`${apiName}__clockedInByUserId`];
  return typeof owner === 'string' && owner === userId;
}

function normalizeLookupApiName(value: string): string {
  return value.replace(/^[A-Za-z]+__/, '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
}

function getLookupDataValue(data: Record<string, unknown>, apiName: string): unknown {
  const bareName = apiName.replace(/^[A-Za-z]+__/, '');
  const direct = data[apiName] ?? data[bareName];
  if (direct !== undefined && direct !== null) return direct;
  const normalizedName = normalizeLookupApiName(apiName);
  const entry = Object.entries(data).find(([key, value]) =>
    value !== undefined && value !== null && normalizeLookupApiName(key) === normalizedName,
  );
  return entry?.[1];
}

function getLookupRecordId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    const lookup = value as Record<string, unknown>;
    return String(lookup.id ?? lookup.lookup ?? lookup.value ?? '').trim();
  }
  return '';
}

function stringifyLookupName(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const parts = value as Record<string, unknown>;
  const read = (pattern: RegExp) => {
    const entry = Object.entries(parts).find(([key, item]) => pattern.test(key) && typeof item === 'string' && item.trim());
    return typeof entry?.[1] === 'string' ? entry[1].trim() : '';
  };
  const compositeName = [read(/salutation/i), read(/first.?name/i), read(/last.?name/i)].filter(Boolean).join(' ');
  if (compositeName) return compositeName;
  return Object.values(parts).filter((item): item is string => typeof item === 'string' && !!item.trim()).join(' ');
}

function getLookupDisplayName(
  objectApiName: string,
  objectLabel: string,
  data: Record<string, unknown>,
  fields: Array<{ apiName: string; label: string }>,
): string {
  const lowerName = objectApiName.charAt(0).toLowerCase() + objectApiName.slice(1);
  const nameCandidates = objectApiName === 'Property'
    ? ['Property__address_search', 'address_search', 'Property__address', 'address']
    : [`${objectApiName}__${lowerName}Name`, `${lowerName}Name`, `${objectApiName}__name`, 'name', 'subject'];
  let name = '';
  for (const candidate of nameCandidates) {
    name = stringifyLookupName(getLookupDataValue(data, candidate));
    if (name) break;
  }
  if (!name) {
    const schemaNameField = fields.find(({ apiName }) => /(?:^|__)name$/i.test(apiName) || /(?:^|__)\w+name$/i.test(apiName));
    if (schemaNameField) name = stringifyLookupName(getLookupDataValue(data, schemaNameField.apiName));
  }

  const numberCandidates = [`${objectApiName}__${lowerName}Number`, `${lowerName}Number`, `${objectApiName}Number`];
  let number = '';
  for (const candidate of numberCandidates) {
    number = stringifyLookupName(getLookupDataValue(data, candidate));
    if (number) break;
  }
  if (number && name && number !== name) return `${number} (${name})`;
  return name || number || `Unnamed ${objectLabel}`;
}

async function buildLookupLabels(
  sourceObjectApiName: string,
  sourceData: unknown,
  userId: string,
  userRole: string,
): Promise<Record<string, { label: string; objectApiName: string; canRead: boolean; connectionType?: string }>> {
  if (!sourceData || typeof sourceData !== 'object' || Array.isArray(sourceData)) return {};
  const schemaRow = await prisma.setting.findUnique({ where: { key: 'tces-object-manager-schema' } });
  const schema = schemaRow?.value as { objects?: Array<{ apiName: string; label: string; fields?: Array<Record<string, unknown>> }> } | undefined;
  const sourceObject = schema?.objects?.find((object) => object.apiName.toLowerCase() === sourceObjectApiName.toLowerCase());
  if (!sourceObject) return {};

  const data = sourceData as Record<string, unknown>;
  const lookupFields = (sourceObject.fields ?? []).filter((field) =>
    ['Lookup', 'Connection', 'ConnectionContact', 'ConnectionAccount', 'ExternalLookup', 'PicklistLookup'].includes(String(field.type)),
  );
  const descriptors: Array<{
    apiName: string;
    targetApiName: string;
    recordId: string;
    embeddedLabel?: string;
    connectionTypeField?: string;
  }> = [];
  for (const field of lookupFields) {
    const type = String(field.type);
    const targetApiName = type === 'ConnectionContact'
      ? 'Contact'
      : type === 'ConnectionAccount'
        ? 'Account'
        : String(field.lookupObject ?? '');
    if (!targetApiName) continue;
    const rawValue = getLookupDataValue(data, String(field.apiName));
    const nestedValue = rawValue && typeof rawValue === 'object' ? rawValue as Record<string, unknown> : undefined;
    const recordId = getLookupRecordId(rawValue);
    if (!recordId) continue;
    const embeddedLabel = typeof nestedValue?.name === 'string'
      ? nestedValue.name
      : typeof nestedValue?.label === 'string'
        ? nestedValue.label
        : undefined;
    descriptors.push({
      apiName: String(field.apiName),
      targetApiName,
      recordId,
      embeddedLabel,
      ...(type === 'ConnectionContact' ? { connectionTypeField: 'contactType' } : {}),
      ...(type === 'ConnectionAccount' ? { connectionTypeField: 'accountType' } : {}),
    });
  }

  const targetApiNames = Array.from(new Set(descriptors.map((descriptor) => descriptor.targetApiName)));
  const targets = await Promise.all(targetApiNames.map(async (targetApiName) => {
    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: targetApiName, mode: 'insensitive' } },
      include: { fields: { where: { isActive: true }, select: { apiName: true, label: true } } },
    });
    return [targetApiName, object] as const;
  }));
  const targetObjectMap = new Map(targets.filter((entry) => entry[1]).map(([apiName, object]) => [apiName, object!]));
  const recordsByTarget = new Map<string, Map<string, Record<string, unknown>>>();

  await Promise.all(targetApiNames.map(async (targetApiName) => {
    const targetObject = targetObjectMap.get(targetApiName);
    if (!targetObject) return;
    const ids = Array.from(new Set(descriptors
      .filter((descriptor) => descriptor.targetApiName === targetApiName)
      .map((descriptor) => descriptor.recordId)));
    const records = await prisma.record.findMany({
      where: { objectId: targetObject.id, id: { in: ids }, deletedAt: null },
      select: { id: true, data: true },
    });
    recordsByTarget.set(targetApiName, new Map(records.map((record) => [
      record.id,
      record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : {},
    ])));
  }));

  const permissions = await Promise.all(targetApiNames.map(async (targetApiName) => [
    targetApiName,
    await checkObjectPermission(userId, userRole, targetApiName, 'read'),
  ] as const));
  const canReadByTarget = new Map(permissions);
  const labels: Record<string, { label: string; objectApiName: string; canRead: boolean; connectionType?: string }> = {};
  for (const descriptor of descriptors) {
    const targetObject = targetObjectMap.get(descriptor.targetApiName);
    const targetData = recordsByTarget.get(descriptor.targetApiName)?.get(descriptor.recordId);
    if (!descriptor.embeddedLabel && (!targetObject || !targetData)) continue;
    labels[descriptor.apiName] = {
      label: descriptor.embeddedLabel || (targetObject && targetData
        ? getLookupDisplayName(descriptor.targetApiName, targetObject.label, targetData, targetObject.fields)
        : `Unnamed ${targetObject?.label ?? descriptor.targetApiName}`),
      objectApiName: descriptor.targetApiName,
      canRead: canReadByTarget.get(descriptor.targetApiName) ?? false,
      ...(descriptor.connectionTypeField && targetData ? {
        connectionType: stringifyLookupName(getLookupDataValue(targetData, descriptor.connectionTypeField)),
      } : {}),
    };
  }
  return labels;
}

export async function recordRoutes(app: FastifyInstance) {
  // ── Global search across all search-enabled objects ──────────────────

  // Record data keys may omit the "ObjectName__" prefix, so try both
  function resolveDataValue(data: Record<string, any>, fieldApi: string): unknown {
    if (fieldApi in data) return data[fieldApi];
    // Strip "ObjectName__" prefix → short key
    const short = fieldApi.replace(/^[^_]+__/, '');
    if (short in data) return data[short];
    return undefined;
  }

  // Flatten a value to searchable strings (handles composite objects like Address)
  function flattenValue(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'object') {
      return Object.values(val as Record<string, unknown>)
        .filter(v => v != null && typeof v !== 'object')
        .map(v => String(v))
        .join(' ');
    }
    return String(val);
  }

  // Keys to exclude from composite display values (e.g. address lat/lng)
  const HIDDEN_COMPOSITE_KEYS = new Set(['lat', 'lng', 'latitude', 'longitude']);

  // Build a display-friendly string from a data value
  function displayValue(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'object') {
      return Object.entries(val as Record<string, unknown>)
        .filter(([k, v]) => v != null && v !== '' && !HIDDEN_COMPOSITE_KEYS.has(k.toLowerCase()))
        .map(([, v]) => String(v))
        .join(', ');
    }
    return String(val);
  }

  app.get('/search', async (req, reply) => {
    const { q } = req.query as { q?: string };
    if (!q || !q.trim()) return reply.send({ results: [] });

    const userId = req.user!.sub;
    const userRole = req.user!.role;

    // Load the OrgSchema from the settings table
    const schemaSetting = await prisma.setting.findUnique({ where: { key: 'tces-object-manager-schema' } });
    if (!schemaSetting) return reply.send({ results: [] });

    const orgSchema = schemaSetting.value as any;
    const objects: any[] = orgSchema?.objects ?? [];
    const searchTerm = q.trim().toLowerCase();

    // Collect search-enabled objects (if searchableFields is empty, search all text values)
    const enabledObjects = objects.filter((o: any) => o.searchConfig?.enabled);
    if (enabledObjects.length === 0) return reply.send({ results: [] });

    // Search each enabled object in parallel
    const resultPromises = enabledObjects.map(async (objDef: any) => {
      const allowed = await checkObjectPermission(userId, userRole, objDef.apiName, 'read');
      if (!allowed) return [];

      const customObj = await prisma.customObject.findFirst({
        where: { apiName: { equals: objDef.apiName, mode: 'insensitive' } },
      });
      if (!customObj) return [];

      const records = await prisma.record.findMany({
        where: { objectId: customObj.id, deletedAt: null },
        take: 50,
      });

      const config = objDef.searchConfig;
      const searchFields: string[] = config.searchableFields ?? [];
      const apiName: string = objDef.apiName;

      // ── Smart field resolution for title / subtitle ──────────────
      // Auto-detect number, name, and address fields from object field definitions
      const fields: any[] = objDef.fields ?? [];
      const fieldApis = fields.map((f: any) => f.apiName as string);

      // Find the object number field (e.g. Property__propertyNumber or propertyNumber)
      const numberField = fieldApis.find((f: string) =>
        f.toLowerCase().endsWith('number') &&
        (f.toLowerCase().includes(apiName.toLowerCase()) || f.toLowerCase().startsWith(apiName.toLowerCase()))
      ) || '';

      // For Property: use address as subtitle; for others: use the name field
      const isProperty = apiName === 'Property';
      let nameField = '';
      let addressField = '';

      if (isProperty) {
        // Prefer LocationSearch field (address_search) over legacy Address field.
        addressField =
          fieldApis.find((f: string) => f.toLowerCase().endsWith('__address_search') || f.toLowerCase() === 'address_search') ||
          fieldApis.find((f: string) => (f.toLowerCase().endsWith('__address') || f.toLowerCase() === 'address') && !f.toLowerCase().includes('_search')) ||
          '';
      } else {
        // Find a name field: opportunityName, projectName, accountName, contactName, subject, name, etc.
        nameField = fieldApis.find((f: string) => {
          const lower = f.toLowerCase();
          return (lower.endsWith('name') || lower.endsWith('subject')) &&
            !lower.includes('number') &&
            (lower.includes(apiName.toLowerCase()) || lower === 'name' || lower === 'subject');
        }) || '';
      }

      // Fall back to explicit searchConfig fields if set
      const titleField: string = config.titleField || numberField || searchFields[0] || '';
      const subtitleFields: string[] = config.subtitleFields?.length
        ? config.subtitleFields
        : (isProperty ? [addressField].filter(Boolean) : [nameField].filter(Boolean));

      const matched: any[] = [];
      for (const record of records) {
        const data = record.data as Record<string, any>;
        let hitFields: string[] = [];

        if (searchFields.length > 0) {
          // Search only the configured fields
          for (const fieldApi of searchFields) {
            const raw = resolveDataValue(data, fieldApi);
            const text = flattenValue(raw);
            if (text && text.toLowerCase().includes(searchTerm)) {
              hitFields.push(fieldApi);
            }
          }
        } else {
          // No specific fields configured — search all values
          for (const [key, raw] of Object.entries(data)) {
            const text = flattenValue(raw);
            if (text && text.toLowerCase().includes(searchTerm)) {
              hitFields.push(key);
            }
          }
        }

        if (hitFields.length > 0) {
          // Build display title: prefer "NUMBER (Name)" format
          const numVal = numberField ? displayValue(resolveDataValue(data, numberField)) : '';
          const titleVal = displayValue(resolveDataValue(data, titleField));
          let title = '';

          if (numVal && titleField !== numberField && titleVal && titleVal !== numVal) {
            // Both number and a separate title field — combine them
            title = `${numVal} (${titleVal})`;
          } else if (numVal) {
            title = numVal;
          } else if (titleVal) {
            title = titleVal;
          } else {
            title = record.id;
          }

          matched.push({
            id: record.id,
            objectApiName: objDef.apiName,
            objectLabel: objDef.label,
            objectPluralLabel: objDef.pluralLabel || objDef.label,
            title,
            subtitle: subtitleFields
              .map(f => displayValue(resolveDataValue(data, f)))
              .filter(Boolean)
              .join(' · ') || '',
            matchedFields: hitFields,
          });
        }
        if (matched.length >= 10) break;
      }
      return matched;
    });

    const groups = await Promise.all(resultPromises);
    const results = groups.flat().slice(0, 25);

    return reply.send({ results });
  });

  // Search records (registered before /:recordId to avoid being swallowed by the param route)
  app.get('/objects/:apiName/records/search', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { q } = req.query as { q?: string };

    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'read');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to view this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    if (!q) {
      return reply.send([]);
    }

    const records = await prisma.record.findMany({
      where: {
        objectId: object.id,
        deletedAt: null,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      take: 20,
    });

    const searchTerm = q.toLowerCase();
    const filtered = records.filter((record) => {
      const data = record.data as Record<string, any>;
      return Object.values(data).some((value) =>
        String(value).toLowerCase().includes(searchTerm)
      );
    });

    reply.send(filtered);
  });

  // Get all records for an object
  app.get('/objects/:apiName/records', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const rawQuery = req.query as {
      limit?: string;
      offset?: string;
      orderBy?: string;
      orderDir?: string;
      filter?: Record<string, string>;
    };
    const limit = Math.min(Math.max(Number(rawQuery.limit) || 50, 1), 200);
    const offset = Math.max(Number(rawQuery.offset) || 0, 0);

    // bracket-notation filter params: filter[fieldApiName]=value
    const filters: Array<[string, string]> = rawQuery.filter
      ? Object.entries(rawQuery.filter).filter(([, v]) => v !== undefined && v !== '')
      : [];

    const orderByField = rawQuery.orderBy ?? null;
    const orderDir: 'asc' | 'desc' = rawQuery.orderDir === 'asc' ? 'asc' : 'desc';

    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'read');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to view this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    // Build JSON path filter conditions for the data column (PostgreSQL).
    // Records may store a field under either its prefixed apiName
    // (`Contact__account`) or its short, unprefixed form (`account`) — see
    // the normalization in the POST handler. Match either variant so the
    // filter is symmetric with the read-side `resolveDataValue` helper.
    const jsonFilters = filters.map(([field, value]) => {
      const stripped = field.replace(/^[A-Za-z]+__/, '');
      const variants = stripped !== field ? [field, stripped] : [field];
      return {
        OR: variants.map((k) => ({ data: { path: [k], equals: value } })),
      };
    });

    // When a custom orderBy is requested, fetch a larger batch for JS sorting
    const needsJsSort = orderByField !== null;
    const fetchLimit = needsJsSort ? Math.min(limit * 10, 500) : limit;

    const records = await prisma.record.findMany({
      where: {
        objectId: object.id,
        deletedAt: null,
        ...(jsonFilters.length > 0 ? { AND: jsonFilters } : {}),
      },
      include: {
        pageLayout: {
          select: {
            id: true,
            name: true,
            layoutType: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: fetchLimit,
      skip: needsJsSort ? 0 : offset,
    });

    // Application-level sort when a data-field orderBy is provided
    let result: typeof records = records;
    if (needsJsSort) {
      result = [...records].sort((a, b) => {
        const aVal = String((a.data as Record<string, unknown>)?.[orderByField] ?? '');
        const bVal = String((b.data as Record<string, unknown>)?.[orderByField] ?? '');
        return orderDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }).slice(offset, offset + limit);
    }

    reply.send(await addProjectNumberFormula(result, apiName, object.id));
  });

  app.get('/objects/:apiName/records/count', async (req, reply) => {
    reply.header('Cache-Control', 'no-store, max-age=0');
    const { apiName } = req.params as { apiName: string };
    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'read');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to view this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!object) return reply.code(404).send({ error: 'Object not found' });

    const count = await prisma.record.count({ where: { objectId: object.id, deletedAt: null } });
    reply.send({ count });
  });

  // Get single record — accepts either a standardized recordId or a UUID
  app.get('/objects/:apiName/records/:recordId', async (req, reply) => {
    const { apiName, recordId: idParam } = req.params as { apiName: string; recordId: string };

    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'read');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to view this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const record = await prisma.record.findFirst({
      where: { id: idParam, objectId: object.id, deletedAt: null },
      include: {
        pageLayout: {
          select: {
            id: true,
            name: true,
            layoutType: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!record) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    let lookupLabels: Awaited<ReturnType<typeof buildLookupLabels>> = {};
    try {
      lookupLabels = await buildLookupLabels(apiName, record.data, userId, userRole);
    } catch (err) {
      req.log.warn({ err, apiName, recordId: record.id }, 'Could not resolve lookup display labels');
    }

    const [recordWithFormulas] = await addProjectNumberFormula([record], apiName, object.id);
    reply.send({ ...recordWithFormulas, lookupLabels });
  });

  // Create new record
  app.post('/objects/:apiName/records', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { data, pageLayoutId } = req.body as { data: Record<string, any>; pageLayoutId?: string };

    req.log.info({ apiName, dataKeys: Object.keys(data || {}) }, 'CREATE RECORD request');

    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'create');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to create records for this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: {
        fields: {
          where: { isActive: true },
        },
      },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    // ---- Normalize data keys ----
    // Strip "ObjectName__" prefix from all data keys so the API always works
    // with bare field names (e.g., "Account__accountName" → "accountName").
    // Keep both the prefixed and stripped versions for validation flexibility.
    const normalizedData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      normalizedData[key] = value;
      const stripped = key.replace(/^[A-Za-z]+__/, '');
      if (stripped !== key) {
        normalizedData[stripped] = value;
      }
    }

    // ---- Auto-generate number fields if missing ----
    // Property numbers follow their linked Opportunity or use an NT sequence;
    // Opportunity/Project numbers are generated by creation year.
    const autoNumberFormats: Record<string, string> = {
      accountNumber: 'A',
      propertyNumber: 'NT',
      contactNumber: 'C',
      leadNumber: 'LEAD',
      opportunityNumber: 'OPP',
      productCode: 'PROD',
      quoteNumber: 'QTE',
      serviceNumber: 'SRV',
      installationNumber: 'INST',
      workOrderNumber: 'WO',
      teamMemberNumber: 'TM',
      taskNumber: 'TSK',
    };
    const year = new Date().getUTCFullYear();
    const importedPropertyOpportunityNumber = normalizedData.__propertyOpportunityNumber;
    delete normalizedData.__propertyOpportunityNumber;
    const workOrderPropertyFieldApiName = apiName.toLowerCase() === 'workorder'
      ? object.fields.find((field) => field.apiName.replace(/^[A-Za-z]+__/, '').toLowerCase() === 'property')?.apiName
        ?? await getRelatedLookupFieldApiName(object.id, 'Property')
      : undefined;
    const workOrderPropertyId = apiName.toLowerCase() === 'workorder'
      ? getOpportunityLookupRecordId(normalizedData, apiName, workOrderPropertyFieldApiName, 'Property')
      : undefined;
    const linkedWorkOrderPropertyNumber = workOrderPropertyId
      ? (await getPropertyNumbersById([workOrderPropertyId])).get(workOrderPropertyId)
      : undefined;
    if (apiName.toLowerCase() === 'project') {
      const linkedOpportunityNumber = await getLinkedOpportunityNumber(normalizedData, object.id, apiName);
      let projectNumber = linkedOpportunityNumber;
      if (!projectNumber) {
        const existingProjects = await prisma.record.findMany({
          where: { objectId: object.id, deletedAt: null },
          select: { data: true },
        });
        projectNumber = formatStandaloneProjectNumber(getMaxStandaloneProjectSequence(existingProjects) + 1);
      }
      normalizedData.projectNumber = projectNumber;
      normalizedData[`${apiName}__projectNumber`] = projectNumber;
    }
    for (const field of object.fields) {
      const bareFieldApiName = field.apiName.replace(/^[A-Za-z]+__/, '');
      const fieldApiName = field.apiName === 'Opportunity__opportunityNumber'
        ? 'opportunityNumber'
        : field.apiName === 'WorkOrder__workOrderNumber'
          ? 'workOrderNumber'
        : field.apiName;
      if (apiName.toLowerCase() === 'property' && bareFieldApiName === 'propertyNumber') {
        const linkedOpportunityNumber = await getLinkedOpportunityNumber(normalizedData, object.id, apiName);
        const copiedNumber = linkedOpportunityNumber
          ?? (typeof importedPropertyOpportunityNumber === 'string' ? importedPropertyOpportunityNumber : undefined);
        let propertyNumber = copiedNumber;
        if (!propertyNumber) {
          const propertyPrefix = getPropertyPrefix(extractAddressFromRecord(normalizedData));
          const existingProperties = await prisma.record.findMany({
            where: { objectId: object.id, deletedAt: null },
            select: { data: true },
          });
          propertyNumber = generatePropertyNumber(propertyPrefix, getPropertyNumbers(existingProperties));
        }
        normalizedData.propertyNumber = propertyNumber;
        normalizedData[`${apiName}__propertyNumber`] = propertyNumber;
        continue;
      }

      const currentVal = normalizedData[field.apiName] ?? normalizedData[fieldApiName];
      const isEmpty = !currentVal || currentVal === 'N/A';
      const hasWorkOrderPropertyPrefix = fieldApiName === 'workOrderNumber'
        && !!linkedWorkOrderPropertyNumber
        && typeof currentVal === 'string'
        && currentVal.toUpperCase().startsWith(`${linkedWorkOrderPropertyNumber}-WO`.toUpperCase());
      const shouldPrefixWorkOrderNumber = fieldApiName === 'workOrderNumber'
        && !!linkedWorkOrderPropertyNumber
        && !hasWorkOrderPropertyPrefix;
      if (fieldApiName in autoNumberFormats && (isEmpty || shouldPrefixWorkOrderNumber)) {
        if (fieldApiName in YEAR_SCOPED_NUMBER_PREFIXES) {
          const existingRecords = await prisma.record.findMany({
            where: { objectId: object.id, deletedAt: null },
            select: { data: true, createdAt: true },
          });
          const maxSequence = getYearScopedNumberSequence(existingRecords, fieldApiName, year);
          if (maxSequence >= 999) {
            return reply.code(409).send({ error: `No ${field.label} numbers remain for ${year}.` });
          }
          const generatedNum = formatYearScopedNumber(year, maxSequence + 1);
          normalizedData[fieldApiName] = generatedNum;
          normalizedData[`${apiName}__${fieldApiName}`] = generatedNum;
          continue;
        }

        const prefix = autoNumberFormats[fieldApiName];
        const prefixRegex = fieldApiName === 'workOrderNumber'
          ? /(?:^|-)WO-?(\d+)$/i
          : new RegExp(`^${prefix}-?(\\d+)$`);
        const existing = await prisma.record.findMany({
          where: { objectId: object.id, deletedAt: null },
          select: { data: true },
        });
        let maxNum = 0;
        for (const rec of existing) {
          const recData = rec.data as Record<string, any> | null;
          if (!recData) continue;
          // Check both bare field name and prefixed variants (e.g. Opportunity__opportunityNumber)
          let val: string | undefined;
          for (const [k, v] of Object.entries(recData)) {
            const stripped = k.replace(/^[A-Za-z]+__/, '');
            if (stripped === fieldApiName && typeof v === 'string') { val = v; break; }
          }
          if (typeof val === 'string') {
            const m = val.match(prefixRegex);
            if (m) { const num = parseInt(m[1], 10); if (num > maxNum) maxNum = num; }
          }
        }
        const padWidth = (fieldApiName === 'propertyNumber' || fieldApiName === 'leadNumber' || fieldApiName === 'opportunityNumber' || fieldApiName === 'workOrderNumber' || fieldApiName === 'teamMemberNumber' || fieldApiName === 'taskNumber') ? 4 : 3;
        const workOrderSuffix = `${prefix}${String(maxNum + 1).padStart(padWidth, '0')}`;
        const generatedNum = fieldApiName === 'workOrderNumber' && linkedWorkOrderPropertyNumber
          ? `${linkedWorkOrderPropertyNumber}-${workOrderSuffix}`
          : workOrderSuffix;
        normalizedData[fieldApiName] = generatedNum;
        // Also set the prefixed key so the stored JSON is consistent
        const prefixedKey = `${apiName}__${fieldApiName}`;
        normalizedData[prefixedKey] = generatedNum;
      }
    }

    // ---- TeamMember validations (POST) ----
    if (apiName === 'TeamMember') {
      const getTeamMemberField = (data: Record<string, any>, fieldName: string): string | null => {
        const val = data[fieldName] || data[`TeamMember__${fieldName}`];
        return val && String(val).trim() ? String(val) : null;
      };

      // Contact or Account required
      const contactVal = getTeamMemberField(normalizedData, 'contact');
      const accountVal = getTeamMemberField(normalizedData, 'account');
      if (!contactVal && !accountVal) {
        return reply.code(400).send({ error: 'Either a contact or an account is required for TeamMember records.' });
      }

      // Exactly one parent required
      const parentFields = ['property', 'opportunity', 'project', 'workOrder', 'installation'];
      const setParents = parentFields.filter(f => getTeamMemberField(normalizedData, f) !== null);
      if (setParents.length !== 1) {
        return reply.code(400).send({ error: 'Exactly one parent is required. Set one of: property, opportunity, project, workOrder, installation.' });
      }

      // Duplicate detection → upsert: when the same contact/account already
      // exists on this parent, merge role + flags into the existing row
      // instead of rejecting with 409. This lets a person hold both a role
      // (e.g. General Contractor) and flags (e.g. Quote Recipient).
      const parentField = setParents[0];
      const parentValue = getTeamMemberField(normalizedData, parentField)!;

      const dupMatchesParent = (dupData: Record<string, any>) => {
        const p = dupData[parentField] || dupData[`TeamMember__${parentField}`];
        return !!p && String(p) === parentValue;
      };

      let existingDuplicate: { id: string; data: any } | null = null;

      if (contactVal) {
        const dup = await prisma.record.findFirst({
          where: { objectId: object.id, deletedAt: null, data: { path: ['contact'], equals: contactVal } },
        });
        if (dup?.data && dupMatchesParent(dup.data as Record<string, any>)) {
          existingDuplicate = dup;
        }
        if (!existingDuplicate) {
          const dups = await prisma.record.findMany({
            where: { objectId: object.id, deletedAt: null, data: { path: ['TeamMember__contact'], equals: contactVal } },
          });
          for (const d of dups) {
            if (d.data && dupMatchesParent(d.data as Record<string, any>)) { existingDuplicate = d; break; }
          }
        }
      } else if (accountVal) {
        const dup = await prisma.record.findFirst({
          where: { objectId: object.id, deletedAt: null, data: { path: ['account'], equals: accountVal } },
        });
        if (dup?.data && dupMatchesParent(dup.data as Record<string, any>)) {
          existingDuplicate = dup;
        }
        if (!existingDuplicate) {
          const dups = await prisma.record.findMany({
            where: { objectId: object.id, deletedAt: null, data: { path: ['TeamMember__account'], equals: accountVal } },
          });
          for (const d of dups) {
            if (d.data && dupMatchesParent(d.data as Record<string, any>)) { existingDuplicate = d; break; }
          }
        }
      }

      if (existingDuplicate) {
        const existingData = (existingDuplicate.data as Record<string, any>) || {};
        const mergedData = { ...existingData };

        // Merge role (new value wins)
        const newRole = normalizedData.role || normalizedData.TeamMember__role;
        if (newRole) {
          mergedData.role = newRole;
          mergedData.TeamMember__role = newRole;
        }

        // Merge flags additively — only set to true, never unset
        const tmFlags = ['primaryContact', 'contact2', 'contact3', 'contact4', 'contractHolder', 'quoteRecipient'];
        for (const flag of tmFlags) {
          if (normalizedData[flag] === true || normalizedData[flag] === 'true') mergedData[flag] = true;
          const pf = `TeamMember__${flag}`;
          if (normalizedData[pf] === true || normalizedData[pf] === 'true') { mergedData[pf] = true; mergedData[flag] = true; }
        }

        // Enforce single-cardinality: unset primaryContact on sibling TMs
        if (mergedData.primaryContact === true) {
          const siblings = await prisma.record.findMany({
            where: {
              objectId: object.id,
              deletedAt: null,
              id: { not: existingDuplicate.id },
              OR: [
                { data: { path: [parentField], equals: parentValue } },
                { data: { path: [`TeamMember__${parentField}`], equals: parentValue } },
              ],
            },
          });
          for (const sib of siblings) {
            const sibData = (sib.data as Record<string, any>) || {};
            if (sibData.primaryContact === true || sibData.TeamMember__primaryContact === true) {
              await prisma.record.update({
                where: { id: sib.id },
                data: { data: { ...sibData, primaryContact: false, TeamMember__primaryContact: false }, modifiedById: userId },
              });
            }
          }
        }

        const updated = await prisma.record.update({
          where: { id: existingDuplicate.id },
          data: { data: mergedData, modifiedById: userId },
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            modifiedBy: { select: { id: true, name: true, email: true } },
          },
        });

        logAudit({
          actorId: userId,
          action: 'UPDATE',
          objectType: apiName,
          objectId: updated.id,
          objectName: existingData.teamMemberNumber || existingData.TeamMember__teamMemberNumber || updated.id,
          before: existingData,
          after: mergedData,
          ipAddress: extractIp(req),
        });

        return reply.code(200).send(updated);
      }
    }

    // ---- Contact name validation ----
    // At least one of firstName / lastName must be non-empty. The schema fields
    // are intentionally NOT marked required (the CompositeText widget needs them
    // individually optional), so we enforce this at the API level.
    if (apiName.toLowerCase() === 'contact') {
      // The DynamicForm stores the name as a nested CompositeText object:
      //   { name: { Contact__name_firstName: "Tomasz", Contact__name_lastName: "..." } }
      // so we must also look inside that object, not just at top-level keys.
      const nameObj: Record<string, any> =
        typeof normalizedData.name === 'object' && normalizedData.name !== null
          ? normalizedData.name
          : {};
      const firstName = (
        normalizedData.firstName ||
        normalizedData.Contact__firstName ||
        normalizedData.Contact__name_firstName ||
        nameObj['Contact__name_firstName'] ||
        nameObj['firstName'] ||
        ''
      ).toString().trim();
      const lastName = (
        normalizedData.lastName ||
        normalizedData.Contact__lastName ||
        normalizedData.Contact__name_lastName ||
        nameObj['Contact__name_lastName'] ||
        nameObj['lastName'] ||
        ''
      ).toString().trim();
      if (!firstName && !lastName) {
        return reply.code(400).send({
          error: 'Contact name is required — provide at least a first name or last name.',
          fields: ['firstName', 'lastName'],
        });
      }
    }

    // ---- Validate required fields ----
    // Skip auto-generated number fields — they are now filled above.
    const autoGeneratedFieldNames = new Set(Object.keys(autoNumberFormats));
    const requiredFields = object.fields.filter(
      (f) => f.required && !autoGeneratedFieldNames.has(f.apiName)
    );
    // Build a camelCase prefix for matching schema field names against DB field names.
    // E.g., DB field 'name' on object 'Account' → also check data['accountName'].
    const camelPrefix = apiName.charAt(0).toLowerCase() + apiName.slice(1);

    const missingFields = requiredFields.filter((f) => {
      const nd = normalizedData;
      // 1. Direct match: data['name']
      const direct = nd[f.apiName];
      // 2. Unprefixed: strip "ObjectName__" from DB field apiName
      const unprefixedKey = f.apiName.replace(/^[A-Za-z]+__/, '');
      const unprefixed = nd[unprefixedKey];
      // 3. Object-prefixed: "Account__name"
      const objectPrefixed = nd[`${apiName}__${f.apiName}`];
      // 4. CamelCase: DB field 'name' → check 'accountName'
      const camelKey = `${camelPrefix}${f.apiName.charAt(0).toUpperCase()}${f.apiName.slice(1)}`;
      const camelCased = nd[camelKey];
      // 5. Composite sub-field patterns like "Contact__name_firstName".
      // Match against the unprefixed key so legacy fields whose own apiName
      // already begins with "Object__" (e.g. "Contact__firstName") still
      // match composite subfields like "Contact__name_firstName".
      const compositeSuffix = `_${unprefixedKey}`;
      const compositeMatch = Object.keys(nd).some(
        (k) => k.endsWith(compositeSuffix) && k.startsWith(`${apiName}__`) && nd[k] !== undefined && nd[k] !== null && String(nd[k]).trim() !== ''
      );

      const hasValue = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
      return !hasValue(direct) && !hasValue(unprefixed) && !hasValue(objectPrefixed) && !hasValue(camelCased) && !compositeMatch;
    });

    if (missingFields.length > 0) {
      return reply.code(400).send({
        error: 'Missing required fields',
        fields: missingFields.map((f) => f.apiName),
      });
    }

    // ---- Min / Max bounds validation ----
    // Enforce min/max constraints on Number, Percent, and Currency fields so
    // values like 150% on a probability field are caught server-side even if
    // the client-side validation is bypassed.
    const boundsErrors: string[] = [];
    for (const field of object.fields) {
      if (field.min == null && field.max == null) continue;
      const typeLower = (field.type || '').toLowerCase();
      if (typeLower !== 'number' && typeLower !== 'percent' && typeLower !== 'currency') continue;
      const unprefixed = field.apiName.replace(/^[A-Za-z]+__/, '');
      const rawVal = normalizedData[field.apiName] ?? normalizedData[unprefixed];
      if (rawVal == null || rawVal === '') continue;
      const num = Number(rawVal);
      if (isNaN(num)) continue;
      if (field.min != null && num < field.min) {
        boundsErrors.push(`${field.label || field.apiName}: value must be at least ${field.min}`);
      }
      if (field.max != null && num > field.max) {
        boundsErrors.push(`${field.label || field.apiName}: value must be at most ${field.max}`);
      }
    }
    if (boundsErrors.length > 0) {
      return reply.code(400).send({
        error: boundsErrors.join('; '),
        fields: boundsErrors.map((e) => e.split(':')[0]),
      });
    }

    // Create record with data as JSON.
    // Records are no longer pinned to a specific page layout — the active
    // layout wins at render time — so we do not persist pageLayoutId.
    let recordIdValue: string;
    try {
      recordIdValue = generateRecordId(apiName);
    } catch {
      registerRecordIdPrefix(apiName);
      recordIdValue = generateRecordId(apiName);
    }

    void pageLayoutId;

    const record = await prisma.record.create({
      data: {
        id: recordIdValue,
        objectId: object.id,
        data: normalizedData,
        createdById: userId,
        modifiedById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Enforce single-cardinality: unset primaryContact on sibling TMs (new create)
    if (apiName === 'TeamMember') {
      const isPrimary = normalizedData.primaryContact === true || normalizedData.primaryContact === 'true'
        || normalizedData.TeamMember__primaryContact === true || normalizedData.TeamMember__primaryContact === 'true';
      if (isPrimary) {
        const parentFields = ['property', 'opportunity', 'project', 'workOrder', 'installation'];
        for (const pf of parentFields) {
          const pv = normalizedData[pf] || normalizedData[`TeamMember__${pf}`];
          if (pv) {
            const siblings = await prisma.record.findMany({
              where: {
                objectId: object.id,
                deletedAt: null,
                id: { not: record.id },
                OR: [
                  { data: { path: [pf], equals: String(pv) } },
                  { data: { path: [`TeamMember__${pf}`], equals: String(pv) } },
                ],
              },
            });
            for (const sib of siblings) {
              const sibData = (sib.data as Record<string, any>) || {};
              if (sibData.primaryContact === true || sibData.TeamMember__primaryContact === true) {
                await prisma.record.update({
                  where: { id: sib.id },
                  data: { data: { ...sibData, primaryContact: false, TeamMember__primaryContact: false }, modifiedById: userId },
                });
              }
            }
            break;
          }
        }
      }
    }

    // Audit: log record creation
    const recordName = normalizedData.name || normalizedData[`${apiName}__name`]
      || normalizedData.accountName || normalizedData[`${apiName}__accountName`]
      || normalizedData.contactName || normalizedData[`${apiName}__contactName`]
      || normalizedData.opportunityName || normalizedData[`${apiName}__opportunityName`]
      || normalizedData.leadName || normalizedData[`${apiName}__leadName`]
      || normalizedData.projectName || normalizedData[`${apiName}__projectName`]
      || normalizedData.productName || normalizedData[`${apiName}__productName`]
      || normalizedData.propertyNumber || normalizedData[`${apiName}__propertyNumber`]
      || normalizedData.teamMemberNumber || normalizedData[`${apiName}__teamMemberNumber`]
      || record.id;
    logAudit({
      actorId: userId,
      action: 'CREATE',
      objectType: apiName,
      objectId: record.id,
      objectName: typeof recordName === 'string' ? recordName : String(recordName),
      after: normalizedData,
      ipAddress: extractIp(req),
    });

    // ── Ensure linked Dropbox folder inside parent Property ──
    try {
      await tryEnsureLinkedFolder(userId, apiName, record.id, normalizedData);
    } catch { /* non-fatal */ }

    // ── Ensure Property root folder + subfolders when a Property is created ──
    if (apiName.toLowerCase() === 'property') {
      tryEnsurePropertyRootFolder(userId, record.id, normalizedData)
        .catch(() => { /* non-fatal */ });
    }

    // ── Workflow automation ──
    runWorkflows({
      event: 'create',
      objectApi: apiName,
      recordId: record.id,
      recordData: normalizedData,
      userId,
    }).catch(() => { /* non-fatal — workflow errors must not break record creation */ });

    // ── Trigger automation ──
    runTriggers({
      event: 'create',
      phase: 'after',
      objectApi: apiName,
      recordId: record.id,
      recordData: normalizedData,
      userId,
      orgId: userId,
    }).catch(() => { /* non-fatal — trigger errors must not break record creation */ });

    const [recordWithFormulas] = await addProjectNumberFormula([record], apiName, object.id);
    reply.code(201).send(recordWithFormulas);
  });

  // ── Create Requote of an Opportunity ────────────────────────────────────
  // POST /objects/Opportunity/records/:id/requote
  // Clones the Opportunity record and names it "YY### - Requote N"
  app.post('/objects/:apiName/records/:id/requote', async (req, reply) => {
    const { apiName, id } = req.params as { apiName: string; id: string };
    const userId = req.user!.sub;
    const userRole = req.user!.role;

    if (apiName !== 'Opportunity') {
      return reply.code(400).send({ error: 'Requote is only available for Opportunity records' });
    }

    const allowed = await checkObjectPermission(userId, userRole, apiName, 'create');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to create records for this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: { fields: { where: { isActive: true } } },
    });
    if (!object) return reply.code(404).send({ error: 'Object not found' });

    // Fetch the source record
    const sourceRecord = await prisma.record.findFirst({
      where: { id, objectId: object.id, deletedAt: null },
    });
    if (!sourceRecord) return reply.code(404).send({ error: 'Source record not found' });

    const sourceData = { ...(sourceRecord.data as Record<string, any>) };

    // Find the opportunity number from the source record
    let oppNumber = '';
    for (const [k, v] of Object.entries(sourceData)) {
      const stripped = k.replace(/^[A-Za-z]+__/, '');
      if (stripped === 'opportunityNumber' && typeof v === 'string') {
        oppNumber = v;
        break;
      }
    }
    // If the source is itself a requote, extract the base opportunity number
    const baseOppNumber = oppNumber.replace(/\s*-\s*Requote\s*\d+$/i, '');

    // Count existing requotes for this base opportunity number
    const allRecords = await prisma.record.findMany({
      where: { objectId: object.id, deletedAt: null },
      select: { data: true },
    });
    let maxRequoteNum = 0;
    for (const rec of allRecords) {
      const recData = rec.data as Record<string, any> | null;
      if (!recData) continue;
      for (const [k, v] of Object.entries(recData)) {
        const stripped = k.replace(/^[A-Za-z]+__/, '');
        if (stripped === 'opportunityNumber' && typeof v === 'string') {
          const m = v.match(new RegExp(`^${baseOppNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*Requote\\s*(\\d+)$`, 'i'));
          if (m) {
            const num = parseInt(m[1], 10);
            if (num > maxRequoteNum) maxRequoteNum = num;
          }
        }
      }
    }
    const requoteNum = maxRequoteNum + 1;
    const newOppNumber = `${baseOppNumber} - Requote ${requoteNum}`;

    // Clone the data and update the opportunity number
    const cloneData = { ...sourceData };
    // Remove internal tracking fields and stale IDs from the source record
    delete cloneData._dropboxFolderId;
    delete cloneData._pageLayoutId;
    delete cloneData.id;
    delete cloneData.Id;
    delete cloneData.createdAt;
    delete cloneData.updatedAt;
    delete cloneData.CreatedDate;
    delete cloneData.LastModifiedDate;
    delete cloneData.CreatedById;
    delete cloneData.LastModifiedById;
    delete cloneData.createdBy;
    delete cloneData.modifiedBy;
    // Mark as a requote with metadata for filtering/linking
    cloneData._isRequote = true;
    cloneData._parentOpportunityNumber = baseOppNumber;
    // Update opportunityNumber fields
    for (const key of Object.keys(cloneData)) {
      const stripped = key.replace(/^[A-Za-z]+__/, '');
      if (stripped === 'opportunityNumber') {
        cloneData[key] = newOppNumber;
      }
    }
    if (!cloneData.opportunityNumber) {
      cloneData.opportunityNumber = newOppNumber;
    }

    // Set the opportunity name — use the user-supplied name if provided,
    // otherwise fall back to auto-generated "<base> - Requote N"
    const body = req.body as { name?: string } | null;
    const userSuppliedName = body?.name?.trim();
    for (const key of Object.keys(cloneData)) {
      const stripped = key.replace(/^[A-Za-z]+__/, '');
      if (stripped === 'opportunityName' || stripped === 'name') {
        if (userSuppliedName) {
          cloneData[key] = userSuppliedName;
        } else {
          const origName = String(cloneData[key] || '');
          const baseName = origName.replace(/\s*-\s*Requote\s*\d+$/i, '');
          cloneData[key] = `${baseName} - Requote ${requoteNum}`;
        }
      }
    }

    // Generate a new record ID
    const newId = generateRecordId(apiName);

    // Create the requote record
    const record = await prisma.record.create({
      data: {
        id: newId,
        objectId: object.id,
        data: cloneData,
        createdById: userId,
        modifiedById: userId,
      },
    });

    // Audit log
    logAudit({
      actorId: userId,
      action: 'CREATE',
      objectType: apiName,
      objectId: record.id,
      objectName: newOppNumber,
      after: cloneData,
      ipAddress: extractIp(req),
    });

    // Send response immediately so the frontend can redirect
    reply.code(201).send(record);

    // Ensure linked Dropbox folder (fire-and-forget so file copies don't block the response)
    tryEnsureLinkedFolder(userId, apiName, record.id, cloneData).catch((err) => {
      console.error('[dropbox] Requote folder creation failed (non-fatal):', err);
    });
  });

  // ── Get requote versions for an Opportunity ──────────────────────────────
  // GET /objects/Opportunity/records/:id/requote-versions
  // Returns the original opportunity + all requotes sharing the same base number
  app.get('/objects/:apiName/records/:id/requote-versions', async (req, reply) => {
    const { apiName, id } = req.params as { apiName: string; id: string };
    if (apiName !== 'Opportunity') return reply.send({ versions: [] });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });
    if (!object) return reply.send({ versions: [] });

    const currentRecord = await prisma.record.findFirst({
      where: { id, objectId: object.id, deletedAt: null },
    });
    if (!currentRecord) return reply.send({ versions: [] });

    const currentData = currentRecord.data as Record<string, any>;

    // Find the opportunity number
    let oppNumber = '';
    for (const [k, v] of Object.entries(currentData)) {
      const stripped = k.replace(/^[A-Za-z]+__/, '');
      if (stripped === 'opportunityNumber' && typeof v === 'string') {
        oppNumber = v; break;
      }
    }

    // Get the base opportunity number (strip "- Requote N")
    const baseOppNumber = oppNumber.replace(/\s*-\s*Requote\s*\d+$/i, '');

    // Find all records with this base number
    const allRecords = await prisma.record.findMany({
      where: { objectId: object.id, deletedAt: null },
      select: { id: true, data: true },
    });

    const versions: Array<{ id: string; label: string; isCurrent: boolean }> = [];
    for (const rec of allRecords) {
      const recData = rec.data as Record<string, any> | null;
      if (!recData) continue;
      let recOppNum = '';
      for (const [k, v] of Object.entries(recData)) {
        const stripped = k.replace(/^[A-Za-z]+__/, '');
        if (stripped === 'opportunityNumber' && typeof v === 'string') {
          recOppNum = v; break;
        }
      }
      // Match: exact base number or base number + "- Requote N"
      if (recOppNum === baseOppNumber || recOppNum.match(new RegExp(`^${baseOppNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*-\\s*Requote\\s*\\d+$`, 'i'))) {
        versions.push({
          id: rec.id,
          label: recOppNum,
          isCurrent: rec.id === id,
        });
      }
    }

    // Sort: original first, then requotes by number
    versions.sort((a, b) => {
      const aMatch = a.label.match(/Requote\s*(\d+)$/i);
      const bMatch = b.label.match(/Requote\s*(\d+)$/i);
      const aNum = aMatch ? parseInt(aMatch[1], 10) : 0;
      const bNum = bMatch ? parseInt(bMatch[1], 10) : 0;
      return aNum - bNum;
    });

    reply.send({ versions });
  });

  app.put('/objects/:apiName/records/:recordId', async (req, reply) => {
    const { apiName, recordId: idParam } = req.params as { apiName: string; recordId: string };
    const body = req.body as Record<string, any>;
    const updateData = body.data || body;

    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'edit');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to edit records for this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: {
        fields: {
          where: { isActive: true },
        },
      },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const existingRecord = await prisma.record.findFirst({ where: { id: idParam, objectId: object.id, deletedAt: null } });

    if (!existingRecord) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    if (!canManageClockInRecord(existingRecord, apiName, userId, userRole)) {
      return reply.code(403).send({ error: 'You can only edit your own Clock In records' });
    }

    if (userRole !== 'ADMIN' && apiName.toLowerCase() === 'clockin') {
      const proposedOwner = updateData.clockedInByUserId ?? updateData[`${apiName}__clockedInByUserId`];
      if (proposedOwner !== undefined && proposedOwner !== userId) {
        return reply.code(403).send({ error: 'You cannot change Clock In record ownership' });
      }
    }

    // Strip auto-number fields — these are system-generated and must not be overwritten
    // by non-admin users. Admins may override them explicitly, but empty values are
    // always stripped to prevent accidentally clearing an existing number.
    const AUTO_NUMBER_FIELDS = new Set([
      'accountNumber', 'contactNumber', 'leadNumber', 'opportunityNumber',
      'projectNumber', 'propertyNumber', 'productCode', 'quoteNumber',
      'serviceNumber', 'installationNumber', 'workOrderNumber', 'teamMemberNumber',
      'taskNumber',
    ]);
    const sanitizedUpdate = { ...updateData };
    for (const key of Object.keys(sanitizedUpdate)) {
      const stripped = key.replace(/^\w+__/, '');
      if (AUTO_NUMBER_FIELDS.has(stripped)) {
        const v = sanitizedUpdate[key];
        // Non-admins: always strip. Admins: only strip if value is empty.
        if (userRole !== 'ADMIN' || !v || String(v).trim() === '') {
          delete sanitizedUpdate[key];
        }
      }
    }

    const beforeData = existingRecord.data as Record<string, any>;
    const mergedData = {
      ...beforeData,
      ...sanitizedUpdate,
    };

    // ---- TeamMember validations (PUT) ----
    if (apiName === 'TeamMember') {
      const getTeamMemberField = (data: Record<string, any>, fieldName: string): string | null => {
        const val = data[fieldName] || data[`TeamMember__${fieldName}`];
        return val && String(val).trim() ? String(val) : null;
      };

      // Contact or Account required
      const contactVal = getTeamMemberField(mergedData, 'contact');
      const accountVal = getTeamMemberField(mergedData, 'account');
      if (!contactVal && !accountVal) {
        return reply.code(400).send({ error: 'Either a contact or an account is required for TeamMember records.' });
      }

      // Exactly one parent required
      const parentFields = ['property', 'opportunity', 'project', 'workOrder', 'installation'];
      const setParents = parentFields.filter(f => getTeamMemberField(mergedData, f) !== null);
      if (setParents.length !== 1) {
        return reply.code(400).send({ error: 'Exactly one parent is required. Set one of: property, opportunity, project, workOrder, installation.' });
      }

      // Duplicate prevention (exclude the current record)
      const parentField = setParents[0];
      const parentValue = getTeamMemberField(mergedData, parentField)!;
      if (contactVal) {
        const duplicate = await prisma.record.findFirst({
          where: {
            objectId: object.id,
            id: { not: existingRecord.id },
            deletedAt: null,
            data: { path: ['contact'], equals: contactVal },
          },
        });
        if (duplicate) {
          const dupData = duplicate.data as Record<string, any> | null;
          if (dupData) {
            const dupParent = dupData[parentField] || dupData[`TeamMember__${parentField}`];
            if (dupParent && String(dupParent) === parentValue) {
              return reply.code(409).send({ error: 'This contact is already a team member on this record.' });
            }
          }
        }
        const duplicates = await prisma.record.findMany({
          where: {
            objectId: object.id,
            id: { not: existingRecord.id },
            deletedAt: null,
            data: { path: [`TeamMember__contact`], equals: contactVal },
          },
        });
        for (const dup of duplicates) {
          const dupData = dup.data as Record<string, any> | null;
          if (dupData) {
            const dupParent = dupData[parentField] || dupData[`TeamMember__${parentField}`];
            if (dupParent && String(dupParent) === parentValue) {
              return reply.code(409).send({ error: 'This contact is already a team member on this record.' });
            }
          }
        }
      } else if (accountVal) {
        const duplicate = await prisma.record.findFirst({
          where: {
            objectId: object.id,
            id: { not: existingRecord.id },
            deletedAt: null,
            data: { path: ['account'], equals: accountVal },
          },
        });
        if (duplicate) {
          const dupData = duplicate.data as Record<string, any> | null;
          if (dupData) {
            const dupParent = dupData[parentField] || dupData[`TeamMember__${parentField}`];
            if (dupParent && String(dupParent) === parentValue) {
              return reply.code(409).send({ error: 'This account is already a team member on this record.' });
            }
          }
        }
        const duplicates = await prisma.record.findMany({
          where: {
            objectId: object.id,
            id: { not: existingRecord.id },
            deletedAt: null,
            data: { path: [`TeamMember__account`], equals: accountVal },
          },
        });
        for (const dup of duplicates) {
          const dupData = dup.data as Record<string, any> | null;
          if (dupData) {
            const dupParent = dupData[parentField] || dupData[`TeamMember__${parentField}`];
            if (dupParent && String(dupParent) === parentValue) {
              return reply.code(409).send({ error: 'This account is already a team member on this record.' });
            }
          }
        }
      }
    }

    // Keep Property numbers aligned with their Opportunity lookup.
    if (apiName.toLowerCase() === 'property') {
      const opportunityFieldApiName = await getOpportunityLookupFieldApiName(object.id);
      const previousOpportunityId = getOpportunityLookupRecordId(beforeData, apiName, opportunityFieldApiName);
      const opportunityId = getOpportunityLookupRecordId(mergedData, apiName, opportunityFieldApiName);
      const lookupChanged = previousOpportunityId !== opportunityId;
      if (opportunityId) {
        const linkedNumber = await getLinkedOpportunityNumber(mergedData, object.id, apiName);
        if (linkedNumber) {
          mergedData.propertyNumber = linkedNumber;
          mergedData.Property__propertyNumber = linkedNumber;
        }
      } else if (previousOpportunityId && lookupChanged) {
        const existingProperties = await prisma.record.findMany({
          where: { objectId: object.id, deletedAt: null, id: { not: existingRecord.id } },
          select: { data: true },
        });
        const propertyPrefix = getPropertyPrefix(extractAddressFromRecord(mergedData));
        const standaloneNumber = generatePropertyNumber(propertyPrefix, getPropertyNumbers(existingProperties));
        mergedData.propertyNumber = standaloneNumber;
        mergedData.Property__propertyNumber = standaloneNumber;
      }
    }

    // ---- Min / Max bounds validation (PUT) ----
    const putBoundsErrors: string[] = [];
    for (const field of object.fields) {
      if (field.min == null && field.max == null) continue;
      const typeLower = (field.type || '').toLowerCase();
      if (typeLower !== 'number' && typeLower !== 'percent' && typeLower !== 'currency') continue;
      const unprefixed = field.apiName.replace(/^[A-Za-z]+__/, '');
      // Only validate fields that are actually being updated
      const rawVal = sanitizedUpdate[field.apiName] ?? sanitizedUpdate[unprefixed];
      if (rawVal == null || rawVal === '') continue;
      const num = Number(rawVal);
      if (isNaN(num)) continue;
      if (field.min != null && num < field.min) {
        putBoundsErrors.push(`${field.label || field.apiName}: value must be at least ${field.min}`);
      }
      if (field.max != null && num > field.max) {
        putBoundsErrors.push(`${field.label || field.apiName}: value must be at most ${field.max}`);
      }
    }
    if (putBoundsErrors.length > 0) {
      return reply.code(400).send({
        error: putBoundsErrors.join('; '),
        fields: putBoundsErrors.map((e) => e.split(':')[0]),
      });
    }

    const record = await prisma.record.update({
      where: { id: existingRecord.id },
      data: {
        data: mergedData,
        modifiedById: userId,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        modifiedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // ── Rename Dropbox folder if the derived name changed ──
    // Await so the rename completes before the client re-renders the widget
    try {
      await tryRenameDropboxFolder(userId, apiName, existingRecord.id, beforeData, mergedData);
    } catch { /* non-fatal — Dropbox errors must not block record updates */ }

    // ── Ensure linked Dropbox folder if Property lookup was set/changed ──
    try {
      await tryEnsureLinkedFolder(userId, apiName, existingRecord.id, mergedData);
    } catch { /* non-fatal */ }

    // Audit: log record update (only changed fields)
    const changedBefore: Record<string, any> = {};
    const changedAfter: Record<string, any> = {};
    for (const key of Object.keys(sanitizedUpdate)) {
      const oldVal = beforeData[key];
      const newVal = sanitizedUpdate[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changedBefore[key] = oldVal;
        changedAfter[key] = newVal;
      }
    }
    if (Object.keys(changedAfter).length > 0) {
      const recName = mergedData.name || mergedData[`${apiName}__name`]
        || mergedData.accountName || mergedData[`${apiName}__accountName`]
        || mergedData.contactName || mergedData[`${apiName}__contactName`]
        || mergedData.opportunityName || mergedData[`${apiName}__opportunityName`]
        || mergedData.leadName || mergedData[`${apiName}__leadName`]
        || mergedData.projectName || mergedData[`${apiName}__projectName`]
        || mergedData.productName || mergedData[`${apiName}__productName`]
        || mergedData.propertyNumber || mergedData[`${apiName}__propertyNumber`]
        || mergedData.teamMemberNumber || mergedData[`${apiName}__teamMemberNumber`]
        || existingRecord.id;
      logAudit({
        actorId: userId,
        action: 'UPDATE',
        objectType: apiName,
        objectId: existingRecord.id,
        objectName: typeof recName === 'string' ? recName : String(recName),
        before: changedBefore,
        after: changedAfter,
        ipAddress: extractIp(req),
      });
    }

    // ── Workflow automation ──
    runWorkflows({
      event: 'update',
      objectApi: apiName,
      recordId: existingRecord.id,
      recordData: mergedData,
      beforeData,
      userId,
    }).catch(() => { /* non-fatal */ });

    // ── Trigger automation ──
    runTriggers({
      event: 'update',
      phase: 'after',
      objectApi: apiName,
      recordId: existingRecord.id,
      recordData: mergedData,
      beforeData,
      userId,
      orgId: userId,
    }).catch(() => { /* non-fatal */ });

    const [recordWithFormulas] = await addProjectNumberFormula([record], apiName, object.id);
    reply.send(recordWithFormulas);
  });

  app.delete('/objects/:apiName/records/:recordId', async (req, reply) => {
    const { apiName, recordId: idParam } = req.params as { apiName: string; recordId: string };

    const userId = req.user!.sub;
    const userRole = req.user!.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'delete');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to delete records for this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const existingRecord = await prisma.record.findFirst({ where: { id: idParam, objectId: object.id, deletedAt: null } });

    if (!existingRecord) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    if (!canManageClockInRecord(existingRecord, apiName, userId, userRole)) {
      return reply.code(403).send({ error: 'You can only delete your own Clock In records' });
    }

    // Audit: log record deletion
    const delData = existingRecord.data as Record<string, any>;
    const delName = delData?.name || delData?.[`${apiName}__name`]
      || delData?.accountName || delData?.[`${apiName}__accountName`]
      || delData?.contactName || delData?.[`${apiName}__contactName`]
      || delData?.opportunityName || delData?.[`${apiName}__opportunityName`]
      || delData?.leadName || delData?.[`${apiName}__leadName`]
      || delData?.projectName || delData?.[`${apiName}__projectName`]
      || delData?.productName || delData?.[`${apiName}__productName`]
      || delData?.propertyNumber || delData?.[`${apiName}__propertyNumber`]
      || delData?.teamMemberNumber || delData?.[`${apiName}__teamMemberNumber`]
      || existingRecord.id;
    logAudit({
      actorId: userId,
      action: 'DELETE',
      objectType: apiName,
      objectId: existingRecord.id,
      objectName: typeof delName === 'string' ? delName : String(delName),
      before: delData,
      ipAddress: extractIp(req),
    });

    const deletedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.record.update({
        where: { id: existingRecord.id },
        data: { deletedAt, deletedById: userId },
      });

      if (apiName.toLowerCase() !== 'workorder') return;

      for (const childApiName of ['PunchList', 'PerDiem']) {
        const childObject = await tx.customObject.findFirst({
          where: { apiName: { equals: childApiName, mode: 'insensitive' } },
          select: { id: true, apiName: true },
        });
        if (!childObject) continue;

        await tx.record.updateMany({
          where: {
            objectId: childObject.id,
            deletedAt: null,
            OR: [
              { data: { path: ['workOrder'], equals: existingRecord.id } },
              { data: { path: [`${childObject.apiName}__workOrder`], equals: existingRecord.id } },
            ],
          },
          data: { deletedAt, deletedById: userId },
        });
      }
    });

    reply.code(204).send();
  });

  // ── Bulk import records (CSV import) ──────────────────────────────────
  // POST /objects/:apiName/records/import
  // Body: { records: Array<Record<string, any>>, sfIdField?: string }
  // Returns: { created: number, errors: Array<{ row: number, error: string }>, idMap: Record<string, string> }
  // idMap maps original sfId values → new CRM record IDs (for relational re-linking)
  app.post('/objects/:apiName/records/import', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { records: rows, sfIdField } = req.body as { records?: Record<string, any>[]; sfIdField?: string };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return reply.code(400).send({ error: 'Request body must contain a non-empty "records" array.' });
    }

    // Hard limit to prevent abuse
    if (rows.length > 5000) {
      return reply.code(400).send({ error: 'Maximum 5,000 records per import.' });
    }

    const userId = req.user!.sub;
    const userRole = req.user!.role;

    // Check create permission on the object
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'create');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to create records on this object.' });

    // Check importData app permission (non-admin users)
    if (userRole !== 'ADMIN') {
      const user = await prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
      const perms = (user?.profile?.permissions as any) || {};
      if (!perms?.app?.importData) {
        return reply.code(403).send({ error: 'You do not have the Import Data permission.' });
      }
    }

    // Load the object + fields
    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
      include: { fields: { where: { isActive: true } } },
    });
    if (!object) return reply.code(404).send({ error: 'Object not found' });

    const normalizedApiName = apiName.toLowerCase();
    const isPropertyImport = normalizedApiName === 'property';
    const isOpportunityImport = normalizedApiName === 'opportunity';
    const requiresSalesforceId = ['punchlist', 'perdiem'].includes(normalizedApiName);
    const tracksSalesforceIds = isPropertyImport || isOpportunityImport || requiresSalesforceId;
    const incomingSalesforceIds = tracksSalesforceIds
      ? rows.map((rawData) => getImportedSalesforceId(rawData, sfIdField) ?? '').filter(Boolean)
      : [];
    const seenSalesforceIds = new Set<string>();
    const salesforceIdToRecordId = new Map<string, string>();
    if (incomingSalesforceIds.length > 0) {
      const lookupCandidates = [...new Set(incomingSalesforceIds.flatMap(getSalesforceIdLookupCandidates))];
      const existingRecords = await prisma.record.findMany({
        where: { objectId: object.id, id: { in: lookupCandidates, mode: 'insensitive' } },
        select: { id: true },
      });
      for (const existing of existingRecords) {
        const normalizedId = normalizeSalesforceIdForComparison(existing.id);
        seenSalesforceIds.add(normalizedId);
        salesforceIdToRecordId.set(normalizedId, existing.id);
      }
    }

    // Prepare auto-number info once
    const autoNumberFormats: Record<string, string> = {
      accountNumber: 'A', propertyNumber: 'NT', contactNumber: 'C',
      leadNumber: 'LEAD', opportunityNumber: 'OPP', productCode: 'PROD',
      quoteNumber: 'QTE', serviceNumber: 'SRV',
      installationNumber: 'INST', workOrderNumber: 'WO', teamMemberNumber: 'TM',
      taskNumber: 'TSK',
    };
    const year = new Date().getUTCFullYear();

    // Pre-fetch existing records for auto-number sequence
    let maxAutoNumbers: Record<string, number> = {};
    let existingPropertyNumbers: string[] = [];
    const autoNumberFields = object.fields.filter(
      (field) => field.apiName in autoNumberFormats
        || field.apiName === 'Opportunity__opportunityNumber'
        || (apiName.toLowerCase() === 'workorder' && field.apiName === 'WorkOrder__workOrderNumber')
        || (apiName.toLowerCase() === 'property' && field.apiName === 'Property__propertyNumber'),
    );
    if (autoNumberFields.length > 0) {
      const existing = await prisma.record.findMany({
        where: { objectId: object.id, deletedAt: null },
        select: { data: true, createdAt: true },
      });
      for (const field of autoNumberFields) {
        const fieldApiName = field.apiName === 'Opportunity__opportunityNumber'
          ? 'opportunityNumber'
          : field.apiName === 'Property__propertyNumber'
            ? 'propertyNumber'
            : field.apiName === 'WorkOrder__workOrderNumber'
              ? 'workOrderNumber'
          : field.apiName;
        if (fieldApiName === 'propertyNumber') {
          existingPropertyNumbers = getPropertyNumbers(existing);
          continue
        }
        if (fieldApiName in YEAR_SCOPED_NUMBER_PREFIXES) {
          maxAutoNumbers[fieldApiName] = getYearScopedNumberSequence(existing, fieldApiName, year);
          continue;
        }
        const prefix = autoNumberFormats[fieldApiName]!;
        const prefixRegex = fieldApiName === 'workOrderNumber'
          ? /(?:^|-)WO-?(\d+)$/i
          : fieldApiName === 'propertyNumber'
          ? /^[A-Za-z]+-?(\d+)$/
          : new RegExp(`^${prefix}-?(\\d+)$`);
        let maxNum = 0;
        for (const rec of existing) {
          const recData = rec.data as Record<string, any> | null;
          if (!recData) continue;
          for (const [k, v] of Object.entries(recData)) {
            const stripped = k.replace(/^[A-Za-z]+__/, '');
            if (stripped === fieldApiName && typeof v === 'string') {
              const m = v.match(prefixRegex);
              if (m) { const num = parseInt(m[1], 10); if (num > maxNum) maxNum = num; }
            }
          }
        }
        maxAutoNumbers[fieldApiName] = maxNum;
      }
    }

    const autoGeneratedFieldNames = new Set(Object.keys(autoNumberFormats));
    const optionalPropertyAddressFields = new Set(['address', 'address_search', 'city', 'state', 'zipcode', 'country']);
    const requiredFields = object.fields.filter(
      f => f.required && !autoGeneratedFieldNames.has(f.apiName)
        && f.apiName !== 'Opportunity__opportunityNumber'
        && !(apiName.toLowerCase() === 'workorder' && f.apiName === 'WorkOrder__workOrderNumber')
        && !(apiName.toLowerCase() === 'property' && f.apiName === 'Property__propertyNumber')
        && !(apiName.toLowerCase() === 'property'
          && optionalPropertyAddressFields.has(f.apiName.replace(/^[A-Za-z]+__/, '').toLowerCase()))
        && f.apiName.replace(/^[A-Za-z]+__/, '').toLowerCase() !== 'id'
        && f.type !== 'Lookup' && f.type !== 'ExternalLookup'
    );

    let created = 0;
    let reused = 0;
    const errors: Array<{ row: number; error: string }> = [];
    // Maps original SF Id value → newly created CRM record id
    const idMap: Record<string, string> = {};
    const propertyOpportunityFieldApiName = apiName.toLowerCase() === 'property'
      ? await getOpportunityLookupFieldApiName(object.id)
      : undefined;
    const propertyOpportunityNumberById = apiName.toLowerCase() === 'property'
      ? await getOpportunityNumbersById(rows.map((rawData) => getOpportunityLookupRecordId(rawData ?? {}, apiName, propertyOpportunityFieldApiName) ?? ''))
      : new Map<string, string>()
    const workOrderPropertyFieldApiName = apiName.toLowerCase() === 'workorder'
      ? object.fields.find((field) => field.apiName.replace(/^[A-Za-z]+__/, '').toLowerCase() === 'property')?.apiName
        ?? await getRelatedLookupFieldApiName(object.id, 'Property')
      : undefined;
    const workOrderPropertyNumberById = apiName.toLowerCase() === 'workorder'
      ? await getPropertyNumbersById(rows.map((rawData) =>
        getOpportunityLookupRecordId(rawData ?? {}, apiName, workOrderPropertyFieldApiName, 'Property') ?? '',
      ))
      : new Map<string, string>();

    for (let i = 0; i < rows.length; i++) {
      try {
        const rawData = sanitizeImportedValue(rows[i]!) as Record<string, any>;
        const allowBlankAccountType = apiName.toLowerCase() === 'account'
          && rawData['__allowBlankAccountType'] === true;
        // Capture the original SF id before normalisation (used for idMap).
        // The frontend strips the SF Id column from the mapped record and instead
        // injects it as __sfId so it is always available regardless of column name.
        const sfIdValue = getImportedSalesforceId(rawData, sfIdField) ?? null;
        if (requiresSalesforceId && !sfIdValue) {
          errors.push({ row: i + 1, error: 'Salesforce Id is required to import Punch List and Per Diem records.' });
          continue;
        }
        const normalizedSalesforceId = sfIdValue
          ? normalizeSalesforceIdForComparison(sfIdValue)
          : undefined;
        if (tracksSalesforceIds && normalizedSalesforceId && seenSalesforceIds.has(normalizedSalesforceId)) {
          const existingRecordId = salesforceIdToRecordId.get(normalizedSalesforceId);
          if ((isPropertyImport || isOpportunityImport) && existingRecordId && sfIdValue) {
            idMap[sfIdValue] = existingRecordId;
            reused++;
            continue;
          }
          errors.push({ row: i + 1, error: `Duplicate Salesforce Id: ${sfIdValue}.` });
          continue;
        }
        if (tracksSalesforceIds && sfIdValue) {
          const existingIdRecord = await prisma.record.findUnique({
            where: { id: sfIdValue },
            select: { objectId: true },
          });
          if (existingIdRecord) {
            errors.push({ row: i + 1, error: `Salesforce Id already exists: ${sfIdValue}.` });
            continue;
          }
        }

        // Normalize keys, excluding the internal __sfId sentinel
        const normalizedData: Record<string, any> = {};
        for (const [key, value] of Object.entries(rawData)) {
          if (key === '__sfId' || key === '__allowBlankAccountType' || key === '__propertyOpportunityNumber') continue; // internal import sentinels — never stored
          if (key.replace(/^[A-Za-z]+__/, '').toLowerCase() === 'id') continue; // native CRM IDs are generated server-side
          if (value === '' || value === null || value === undefined) continue; // skip empty
          normalizedData[key] = value;
          const stripped = key.replace(/^[A-Za-z]+__/, '');
          if (stripped !== key) normalizedData[stripped] = value;
        }

        // Auto-generate number fields
        let exhaustedYearNumberField: string | null = null;
        for (const field of autoNumberFields) {
          const fieldApiName = field.apiName === 'Opportunity__opportunityNumber'
            ? 'opportunityNumber'
            : field.apiName === 'WorkOrder__workOrderNumber'
              ? 'workOrderNumber'
            : field.apiName;
          if (fieldApiName === 'propertyNumber') {
            const opportunityId = getOpportunityLookupRecordId(rawData, apiName, propertyOpportunityFieldApiName)
            const linkedNumber = opportunityId ? propertyOpportunityNumberById.get(opportunityId) : undefined
            const importedOpportunityNumber = typeof rawData.__propertyOpportunityNumber === 'string'
              ? rawData.__propertyOpportunityNumber.trim()
              : undefined
            const copiedNumber = linkedNumber || importedOpportunityNumber
            if (copiedNumber) {
              normalizedData.propertyNumber = copiedNumber
              normalizedData[`${apiName}__propertyNumber`] = copiedNumber
              existingPropertyNumbers.push(copiedNumber)
            } else {
              const propertyPrefix = getPropertyPrefix(extractAddressFromRecord(normalizedData))
              const generatedNum = generatePropertyNumber(propertyPrefix, existingPropertyNumbers)
              existingPropertyNumbers.push(generatedNum)
              normalizedData.propertyNumber = generatedNum
              normalizedData[`${apiName}__propertyNumber`] = generatedNum
            }
            continue
          }
          const workOrderPropertyId = fieldApiName === 'workOrderNumber'
            ? getOpportunityLookupRecordId(rawData, apiName, workOrderPropertyFieldApiName, 'Property')
            : undefined;
          const linkedPropertyNumber = workOrderPropertyId
            ? workOrderPropertyNumberById.get(workOrderPropertyId)
            : undefined;
          const currentVal = normalizedData[field.apiName] ?? normalizedData[fieldApiName];
          const isEmpty = !currentVal || currentVal === 'N/A';
          const hasWorkOrderPropertyPrefix = fieldApiName === 'workOrderNumber'
            && !!linkedPropertyNumber
            && typeof currentVal === 'string'
            && currentVal.toUpperCase().startsWith(`${linkedPropertyNumber}-WO`.toUpperCase());
          const shouldPrefixWorkOrderNumber = fieldApiName === 'workOrderNumber'
            && !!linkedPropertyNumber
            && !hasWorkOrderPropertyPrefix;
          if (isEmpty || shouldPrefixWorkOrderNumber) {
            if (fieldApiName in YEAR_SCOPED_NUMBER_PREFIXES) {
              if ((maxAutoNumbers[fieldApiName] ?? 0) >= 999) {
                exhaustedYearNumberField = field.label;
                break;
              }
              maxAutoNumbers[fieldApiName] = (maxAutoNumbers[fieldApiName] ?? 0) + 1;
              const generatedNum = formatYearScopedNumber(year, maxAutoNumbers[fieldApiName]!);
              normalizedData[fieldApiName] = generatedNum;
              normalizedData[`${apiName}__${fieldApiName}`] = generatedNum;
              continue;
            }
            const prefix = autoNumberFormats[fieldApiName]!;
            const padWidth = (fieldApiName === 'propertyNumber' || fieldApiName === 'leadNumber' || fieldApiName === 'opportunityNumber' || fieldApiName === 'workOrderNumber' || fieldApiName === 'teamMemberNumber' || fieldApiName === 'taskNumber') ? 4 : 3;
            maxAutoNumbers[fieldApiName] = (maxAutoNumbers[fieldApiName] || 0) + 1;
            const workOrderSuffix = `${prefix}${String(maxAutoNumbers[fieldApiName]).padStart(padWidth, '0')}`;
            const generatedNum = fieldApiName === 'workOrderNumber' && linkedPropertyNumber
              ? `${linkedPropertyNumber}-${workOrderSuffix}`
              : workOrderSuffix;
            normalizedData[fieldApiName] = generatedNum;
            normalizedData[`${apiName}__${fieldApiName}`] = generatedNum;
          }
        }
        if (exhaustedYearNumberField) {
          errors.push({ row: i + 1, error: `No ${exhaustedYearNumberField} numbers remain for ${year}.` });
          continue;
        }

        // Apply defaultValues for any field that is missing from the row data.
        // This covers system-managed fields like `status` (default: 'Active') that
        // are not present in CSV exports from external systems.
        for (const field of object.fields) {
          if (field.defaultValue == null) continue;
          const bare = field.apiName.replace(/^[A-Za-z]+__/, '');
          const prefixed = `${apiName}__${field.apiName}`;
          const hasVal = (v: any) => v !== undefined && v !== null;
          if (!hasVal(normalizedData[field.apiName]) && !hasVal(normalizedData[bare]) && !hasVal(normalizedData[prefixed])) {
            normalizedData[field.apiName] = field.defaultValue;
            normalizedData[bare] = field.defaultValue;
          }
        }

        // Validate required fields
        const camelPrefix = apiName.charAt(0).toLowerCase() + apiName.slice(1);
        const missing = requiredFields.filter(f => {
          const bareApiName = f.apiName.replace(/^Account__/i, '').toLowerCase();
          if (allowBlankAccountType && ['accounttype', 'type'].includes(bareApiName)) return false;
          const nd = normalizedData;
          const direct = nd[f.apiName];
          const unprefixed = nd[f.apiName.replace(/^[A-Za-z]+__/, '')];
          const objectPrefixed = nd[`${apiName}__${f.apiName}`];
          const camelKey = `${camelPrefix}${f.apiName.charAt(0).toUpperCase()}${f.apiName.slice(1)}`;
          const camelCased = nd[camelKey];
          const hasValue = (v: any) => v !== undefined && v !== null && String(v).trim() !== '';
          return !hasValue(direct) && !hasValue(unprefixed) && !hasValue(objectPrefixed) && !hasValue(camelCased);
        });

        if (missing.length > 0) {
          errors.push({ row: i + 1, error: `Missing required fields: ${missing.map(f => f.apiName).join(', ')}` });
          continue;
        }

        // Contact name validation — at least one of firstName / lastName required
        if (apiName.toLowerCase() === 'contact') {
          const nameObj: Record<string, any> =
            typeof normalizedData.name === 'object' && normalizedData.name !== null
              ? normalizedData.name : {};
          const fn = (normalizedData.firstName || normalizedData.Contact__firstName || normalizedData.Contact__name_firstName || nameObj['Contact__name_firstName'] || nameObj['firstName'] || '').toString().trim();
          const ln = (normalizedData.lastName || normalizedData.Contact__lastName || normalizedData.Contact__name_lastName || nameObj['Contact__name_lastName'] || nameObj['lastName'] || '').toString().trim();
          if (!fn && !ln) {
            errors.push({ row: i + 1, error: 'Contact name is required — provide at least a first name or last name.' });
            continue;
          }
        }

        // Preserve an external source ID when supplied; otherwise generate a native CRM ID.
        let recordIdValue: string;
        if (sfIdValue) {
          recordIdValue = sfIdValue;
        } else {
          try {
            recordIdValue = generateRecordId(apiName);
          } catch {
            registerRecordIdPrefix(apiName);
            recordIdValue = generateRecordId(apiName);
          }
        }

        await prisma.record.create({
          data: {
            id: recordIdValue,
            objectId: object.id,
            data: normalizedData,
            createdById: userId,
            modifiedById: userId,
          },
        });

        // Track SF id → new CRM id mapping for relational re-linking
        if (sfIdValue) {
          idMap[sfIdValue] = recordIdValue;
          if (tracksSalesforceIds) {
            const normalizedId = normalizeSalesforceIdForComparison(sfIdValue);
            seenSalesforceIds.add(normalizedId);
            salesforceIdToRecordId.set(normalizedId, recordIdValue);
          }
        }

        created++;
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message || 'Unknown error' });
      }
    }

    // Audit: log the import
    logAudit({
      actorId: userId,
      action: 'IMPORT',
      objectType: apiName,
      objectId: object.id,
      objectName: `Imported ${created} ${apiName} records`,
      after: { totalRows: rows.length, created, errorCount: errors.length },
      ipAddress: extractIp(req),
    });

    reply.send({ created, reused, errors, idMap });
  });

}
