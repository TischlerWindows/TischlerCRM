import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
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
      department: true,
      profile: true,
    },
  });
  if (!user) return false;

  // If user has no department or profile — no permissions configured yet, allow access
  if (!user.department && !user.profile) return true;

  // Admin departments have full access to every object
  const deptRaw = (user.department?.permissions as any) || {};
  if (deptRaw.isAdmin) return true;

  // Department restrictions are the CEILING
  // If department explicitly sets this action to false, deny regardless of other sources
  const deptPerms = deptRaw.objectPermissions?.[objectApiName];
  if (user.department && deptPerms && action in deptPerms && !deptPerms[action]) {
    return false; // department explicitly denied — cannot be overridden
  }

  // Check if any source grants the permission
  if (deptPerms?.[action]) return true;

  // Check profile permissions
  const profPerms = (user.profile?.permissions as any)?.objectPermissions?.[objectApiName];
  if (profPerms?.[action]) return true;

  return false;
}

export async function recordRoutes(app: FastifyInstance) {
  // Get all records for an object
  app.get('/objects/:apiName/records', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { limit = 50, offset = 0 } = req.query as { limit?: number; offset?: number };

    const userId = (req as any).user.sub;
    const userRole = (req as any).user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'read');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to view this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const records = await prisma.record.findMany({
      where: { objectId: object.id },
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
      take: Number(limit),
      skip: Number(offset),
    });

    reply.send(records);
  });

  // Get single record
  app.get('/objects/:apiName/records/:recordId', async (req, reply) => {
    const { apiName, recordId } = req.params as { apiName: string; recordId: string };

    const userId = (req as any).user.sub;
    const userRole = (req as any).user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'read');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to view this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const record = await prisma.record.findFirst({
      where: {
        id: recordId,
        objectId: object.id,
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

    const userId = (req as any).user.sub;
    const userRole = (req as any).user.role;
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
      dealNumber: 'DEAL',
      productCode: 'PROD',
      projectNumber: 'PRJ',
      quoteNumber: 'QTE',
      serviceNumber: 'SRV',
      installationNumber: 'INST',
    };
    for (const field of object.fields) {
      if (field.apiName in autoNumberFormats && !normalizedData[field.apiName]) {
        // Find the highest existing number for this field
        const prefix = autoNumberFormats[field.apiName];
        const existing = await prisma.record.findMany({
          where: { objectId: object.id },
          select: { data: true },
        });
        let maxNum = 0;
        for (const rec of existing) {
          const recData = rec.data as Record<string, any> | null;
          if (!recData) continue;
          const val = recData[field.apiName];
          if (typeof val === 'string' && val.startsWith(`${prefix}-`)) {
            const num = parseInt(val.replace(`${prefix}-`, ''), 10);
            if (!isNaN(num) && num > maxNum) maxNum = num;
          }
        }
        normalizedData[field.apiName] = `${prefix}-${String(maxNum + 1).padStart(3, '0')}`;
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
    const isValidUuid = pageLayoutId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageLayoutId);
    const record = await prisma.record.create({
      data: {
        objectId: object.id,
        data: { ...normalizedData, ...(pageLayoutId ? { _pageLayoutId: pageLayoutId } : {}) },
        ...(isValidUuid ? { pageLayoutId } : {}),
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

    reply.code(201).send(record);
  });

  // Update record
  app.put('/objects/:apiName/records/:recordId', async (req, reply) => {
    const { apiName, recordId } = req.params as { apiName: string; recordId: string };
    const body = req.body as Record<string, any>;
    const updateData = body.data || body;

    const userId = (req as any).user.sub;
    const userRole = (req as any).user.role;
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

    const existingRecord = await prisma.record.findFirst({
      where: {
        id: recordId,
        objectId: object.id,
      },
    });

    if (!existingRecord) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    // Merge existing data with new data
    const mergedData = {
      ...(existingRecord.data as Record<string, any>),
      ...updateData,
    };

    const record = await prisma.record.update({
      where: { id: recordId },
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

    reply.send(record);
  });

  // Delete record
  app.delete('/objects/:apiName/records/:recordId', async (req, reply) => {
    const { apiName, recordId } = req.params as { apiName: string; recordId: string };

    const userId = (req as any).user.sub;
    const userRole = (req as any).user.role;
    const allowed = await checkObjectPermission(userId, userRole, apiName, 'delete');
    if (!allowed) return reply.code(403).send({ error: 'You do not have permission to delete records for this object' });

    const object = await prisma.customObject.findFirst({
      where: { apiName: { equals: apiName, mode: 'insensitive' } },
    });

    if (!object) {
      return reply.code(404).send({ error: 'Object not found' });
    }

    const existingRecord = await prisma.record.findFirst({
      where: {
        id: recordId,
        objectId: object.id,
      },
    });

    if (!existingRecord) {
      return reply.code(404).send({ error: 'Record not found' });
    }

    await prisma.record.delete({
      where: { id: recordId },
    });

    reply.code(204).send();
  });

  // Search records
  app.get('/objects/:apiName/records/search', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { q } = req.query as { q?: string };

    const userId = (req as any).user.sub;
    const userRole = (req as any).user.role;
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

    // Simple search in JSON data (this could be enhanced with full-text search)
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

    // Filter records that contain the search term in any field
    const searchTerm = q.toLowerCase();
    const filtered = records.filter((record) => {
      const data = record.data as Record<string, any>;
      return Object.values(data).some((value) =>
        String(value).toLowerCase().includes(searchTerm)
      );
    });

    reply.send(filtered);
  });
}
