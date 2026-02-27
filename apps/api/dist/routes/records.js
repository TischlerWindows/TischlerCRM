import { prisma } from '@crm/db/client';
export async function recordRoutes(app) {
    // Get all records for an object
    app.get('/objects/:apiName/records', async (req, reply) => {
        const { apiName } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
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
        const { apiName, recordId } = req.params;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
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
        const { apiName } = req.params;
        const { data, pageLayoutId } = req.body;
        const userId = req.user.sub;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
            include: {
                fields: {
                    where: { isActive: true },
                },
            },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        // Validate required fields
        const requiredFields = object.fields.filter((f) => f.required);
        const missingFields = requiredFields.filter((f) => !data[f.apiName]);
        if (missingFields.length > 0) {
            return reply.code(400).send({
                error: 'Missing required fields',
                fields: missingFields.map((f) => f.apiName),
            });
        }
        // If pageLayoutId is provided, verify it belongs to this object
        if (pageLayoutId) {
            const layout = await prisma.pageLayout.findFirst({
                where: {
                    id: pageLayoutId,
                    objectId: object.id,
                },
            });
            if (!layout) {
                return reply.code(400).send({
                    error: 'Invalid page layout for this object',
                });
            }
        }
        // Create record with data as JSON and pageLayoutId
        const record = await prisma.record.create({
            data: {
                objectId: object.id,
                data: data,
                pageLayoutId: pageLayoutId || null,
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
        const { apiName, recordId } = req.params;
        const data = req.body;
        const userId = req.user.sub;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
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
            ...existingRecord.data,
            ...data,
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
        const { apiName, recordId } = req.params;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
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
        const { apiName } = req.params;
        const { q } = req.query;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
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
            const data = record.data;
            return Object.values(data).some((value) => String(value).toLowerCase().includes(searchTerm));
        });
        reply.send(filtered);
    });
}
