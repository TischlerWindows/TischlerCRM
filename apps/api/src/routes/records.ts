import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

export async function recordRoutes(app: FastifyInstance) {
  // Get all records for an object
  app.get('/objects/:apiName/records', async (req, reply) => {
    const { apiName } = req.params as { apiName: string };
    const { limit = 50, offset = 0 } = req.query as { limit?: number; offset?: number };

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

    // Validate required fields — only reject if value is undefined or null
    // Support both prefixed (e.g., "TestObject__name") and unprefixed ("name") keys in data
    const requiredFields = object.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => {
      const prefixed = data[f.apiName];
      // Also check unprefixed: strip "ObjectName__" prefix from field apiName
      const unprefixedKey = f.apiName.replace(/^[A-Za-z]+__/, '');
      const unprefixed = data[unprefixedKey];
      return (prefixed === undefined || prefixed === null) && (unprefixed === undefined || unprefixed === null);
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
    const isValidUuid = pageLayoutId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageLayoutId);
    const record = await prisma.record.create({
      data: {
        objectId: object.id,
        data: { ...data, ...(pageLayoutId ? { _pageLayoutId: pageLayoutId } : {}) },
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
