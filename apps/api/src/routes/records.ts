import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id';
import { getPropertyPrefix, extractAddressFromRecord } from '@crm/types';
import { logAudit, extractIp } from '../audit.js';
import { tryRenameDropboxFolder, tryEnsureLinkedFolder, tryEnsurePropertyRootFolder } from './dropbox.js';
import { runWorkflows } from '../workflow-engine.js';
import { z } from 'zod';

// ── Permission helper ──────────────────────────────────────────────
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
  const profilePerms = (user.profile?.permissions as any) || {};
  const objPerms = profilePerms?.objects?.[objectApiName];
  if (objPerms?.[action]) return true;

  return false;
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

  // Build a display-friendly string from a data value
  function displayValue(val: unknown): string {
    if (val == null) return '';
    if (typeof val === 'object') {
      return Object.values(val as Record<string, unknown>)
        .filter(v => v != null && v !== '')
        .map(v => String(v))
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
        where: { objectId: customObj.id },
        take: 50,
      });

      const config = objDef.searchConfig;
      const searchFields: string[] = config.searchableFields ?? [];
      const titleField: string = config.titleField || searchFields[0] || '';
      const subtitleFields: string[] = config.subtitleFields || [];

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
          const titleVal = resolveDataValue(data, titleField);
          matched.push({
            id: record.id,
            objectApiName: objDef.apiName,
            objectLabel: objDef.label,
            objectPluralLabel: objDef.pluralLabel || objDef.label,
            title: displayValue(titleVal) || record.id,
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

    // Build JSON path filter conditions for the data column (PostgreSQL)
    const jsonFilters = filters.map(([field, value]) => ({
      data: { path: [field], equals: value },
    }));

    // When a custom orderBy is requested, fetch a larger batch for JS sorting
    const needsJsSort = orderByField !== null;
    const fetchLimit = needsJsSort ? Math.min(limit * 10, 500) : limit;

    const records = await prisma.record.findMany({
      where: {
        objectId: object.id,
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

    reply.send(result);
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
      where: { id: idParam, objectId: object.id },
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

    reply.send(record);
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
    // The page-level handlers each generate sequential IDs (e.g., A-001).
    // When records are created via inline create (lookups), those handlers
    // don't run, so the API must fill in a value to prevent uniqueness errors.
    const autoNumberFormats: Record<string, string> = {
      accountNumber: 'A',
      propertyNumber: 'P',
      contactNumber: 'C',
      leadNumber: 'LEAD',
      opportunityNumber: 'OPP',
      productCode: 'PROD',
      projectNumber: 'PRJ',
      quoteNumber: 'QTE',
      serviceNumber: 'SRV',
      installationNumber: 'INST',
      workOrderNumber: 'WO',
      teamMemberNumber: 'TM',
    };
    for (const field of object.fields) {
      const currentVal = normalizedData[field.apiName];
      const isEmpty = !currentVal || currentVal === 'N/A';
      if (field.apiName in autoNumberFormats && isEmpty) {
        // For propertyNumber, derive a smart prefix from address data
        const prefix = field.apiName === 'propertyNumber'
          ? getPropertyPrefix(extractAddressFromRecord(normalizedData))
          : autoNumberFormats[field.apiName];
        const existing = await prisma.record.findMany({
          where: { objectId: object.id },
          select: { data: true },
        });
        let maxNum = 0;
        const prefixRegex = field.apiName === 'propertyNumber'
          ? /^[A-Za-z]+-?(\d+)$/   // property numbers: global sequence across all prefixes
          : new RegExp(`^${prefix}-?(\\d+)$`);
        for (const rec of existing) {
          const recData = rec.data as Record<string, any> | null;
          if (!recData) continue;
          // Check both bare field name and prefixed variants (e.g. Opportunity__opportunityNumber)
          let val: string | undefined;
          for (const [k, v] of Object.entries(recData)) {
            const stripped = k.replace(/^[A-Za-z]+__/, '');
            if (stripped === field.apiName && typeof v === 'string') { val = v; break; }
          }
          if (typeof val === 'string') {
            const m = val.match(prefixRegex);
            if (m) { const num = parseInt(m[1], 10); if (num > maxNum) maxNum = num; }
          }
        }
        const padWidth = (field.apiName === 'propertyNumber' || field.apiName === 'leadNumber' || field.apiName === 'opportunityNumber' || field.apiName === 'workOrderNumber' || field.apiName === 'teamMemberNumber') ? 4 : 3;
        const generatedNum = `${prefix}${String(maxNum + 1).padStart(padWidth, '0')}`;
        normalizedData[field.apiName] = generatedNum;
        // Also set the prefixed key so the stored JSON is consistent
        const prefixedKey = `${apiName}__${field.apiName}`;
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

      // Duplicate prevention
      const parentField = setParents[0];
      const parentValue = getTeamMemberField(normalizedData, parentField)!;
      if (contactVal) {
        // Check duplicates based on contact + parent
        const duplicate = await prisma.record.findFirst({
          where: {
            objectId: object.id,
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
        // Also check with prefixed contact key
        const duplicates = await prisma.record.findMany({
          where: {
            objectId: object.id,
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
        // Check duplicates based on account + parent (account-only team member)
        const duplicate = await prisma.record.findFirst({
          where: {
            objectId: object.id,
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
        // Also check with prefixed account key
        const duplicates = await prisma.record.findMany({
          where: {
            objectId: object.id,
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
      // 5. Composite sub-field patterns like "Contact__name_firstName"
      const compositeMatch = Object.keys(nd).some(
        (k) => k.endsWith(`_${f.apiName}`) && k.startsWith(`${apiName}__`) && nd[k] !== undefined && nd[k] !== null
      );

      const hasValue = (v: any) => v !== undefined && v !== null;
      return !hasValue(direct) && !hasValue(unprefixed) && !hasValue(objectPrefixed) && !hasValue(camelCased) && !compositeMatch;
    });

    if (missingFields.length > 0) {
      return reply.code(400).send({
        error: 'Missing required fields',
        fields: missingFields.map((f) => f.apiName),
      });
    }

    // Create record with data as JSON
    // Store pageLayoutId inside the data JSON blob as _pageLayoutId so it
    // survives regardless of format (localStorage IDs are NOT UUIDs).
    // Also set the FK column when the value happens to be a valid UUID.
    // Use normalizedData which includes stripped keys + auto-generated numbers.
    let recordIdValue: string;
    try {
      recordIdValue = generateRecordId(apiName);
    } catch {
      registerRecordIdPrefix(apiName);
      recordIdValue = generateRecordId(apiName);
    }

    const isValidLayout = pageLayoutId && /^[0-9]{3}[A-Za-z0-9]{12}$/.test(pageLayoutId);

    const record = await prisma.record.create({
      data: {
        id: recordIdValue,
        objectId: object.id,
        data: { ...normalizedData, ...(pageLayoutId ? { _pageLayoutId: pageLayoutId } : {}) },
        ...(isValidLayout ? { pageLayoutId } : {}),
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

    reply.code(201).send(record);
  });

  // ── Bulk migrate per-record layout overrides ────────────────────────────
  // POST /objects/:apiName/records/page-layout/migrate
  // Body: { fromPageLayoutId: string }
  // Finds all records on this object whose stored layout FK or data._pageLayoutId
  // matches `fromPageLayoutId`, then clears both so they fall back to the
  // record-type / default layout going forward.
  app.post('/objects/:apiName/records/page-layout/migrate', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { fromPageLayoutId } = req.body as { fromPageLayoutId?: string };

    if (!fromPageLayoutId) {
      return reply.code(400).send({ error: 'fromPageLayoutId is required' });
    }

    const userRole = req.user!.role;
    if (userRole !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can perform layout migrations' });
    }

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    // Collect record IDs to migrate in two passes:
    // 1. Records whose FK column matches
    // 2. Records whose JSON data._pageLayoutId matches (those skipped FK storage)
    const BATCH_SIZE = 500;
    let updatedCount = 0;
    let skip = 0;

    // Pass 1 — FK column match
    while (true) {
      const batch = await prisma.record.findMany({
        where: { objectId: object.id, pageLayoutId: fromPageLayoutId },
        select: { id: true, data: true },
        take: BATCH_SIZE,
        skip,
      });

      if (batch.length === 0) break;

      for (const rec of batch) {
        const cleaned = { ...(rec.data as Record<string, any>) };
        delete cleaned._pageLayoutId;
        await prisma.record.update({
          where: { id: rec.id },
          data: { pageLayoutId: null, data: cleaned },
        });
      }

      updatedCount += batch.length;
      if (batch.length < BATCH_SIZE) break;
      skip += BATCH_SIZE;
    }

    // Pass 2 — JSON blob match (records where FK was null / non-UUID but _pageLayoutId was stored)
    skip = 0;
    while (true) {
      const batch = await prisma.record.findMany({
        where: {
          objectId: object.id,
          pageLayoutId: null, // FK already cleared records are excluded; only touch un-cleared ones
          data: { path: ['_pageLayoutId'], equals: fromPageLayoutId },
        },
        select: { id: true, data: true },
        take: BATCH_SIZE,
        skip,
      });

      if (batch.length === 0) break;

      for (const rec of batch) {
        const cleaned = { ...(rec.data as Record<string, any>) };
        delete cleaned._pageLayoutId;
        await prisma.record.update({
          where: { id: rec.id },
          data: { data: cleaned },
        });
      }

      updatedCount += batch.length;
      if (batch.length < BATCH_SIZE) break;
      skip += BATCH_SIZE;
    }

    return reply.send({ updatedCount });
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

    const existingRecord = await prisma.record.findFirst({ where: { id: idParam, objectId: object.id } });

    if (!existingRecord) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    // Strip auto-number fields — these are system-generated and must not be overwritten.
    const AUTO_NUMBER_FIELDS = new Set([
      'accountNumber', 'contactNumber', 'leadNumber', 'opportunityNumber',
      'projectNumber', 'propertyNumber', 'productCode', 'quoteNumber',
      'serviceNumber', 'installationNumber', 'workOrderNumber', 'teamMemberNumber',
    ]);
    const sanitizedUpdate = { ...updateData };
    for (const key of Object.keys(sanitizedUpdate)) {
      const stripped = key.replace(/^\w+__/, '');
      if (AUTO_NUMBER_FIELDS.has(stripped)) delete sanitizedUpdate[key];
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

    // ── Re-derive propertyNumber when address changes on a Property ──
    if (apiName.toLowerCase() === 'property') {
      const oldAddr = extractAddressFromRecord(beforeData);
      const newAddr = extractAddressFromRecord(mergedData);
      if (oldAddr.state !== newAddr.state || oldAddr.country !== newAddr.country) {
        const oldNumber: string = beforeData.propertyNumber
          || beforeData.Property__propertyNumber || '';
        // Keep the same sequence number, just swap the prefix
        const seqMatch = oldNumber.match(/[A-Za-z]+(\d+)$/);
        const seq = seqMatch ? seqMatch[1] : null;
        if (seq) {
          const newPrefix = getPropertyPrefix(newAddr);
          const newPropertyNumber = `${newPrefix}${seq}`;
          mergedData.propertyNumber = newPropertyNumber;
          mergedData.Property__propertyNumber = newPropertyNumber;
        }
      }
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

    reply.send(record);
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

    const existingRecord = await prisma.record.findFirst({ where: { id: idParam, objectId: object.id } });

    if (!existingRecord) {
      return reply.code(404).send({ error: 'Record not found' });
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

    await prisma.record.delete({
      where: { id: existingRecord.id },
    });

    reply.code(204).send();
  });

}
