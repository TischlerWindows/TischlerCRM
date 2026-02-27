import { prisma } from '@crm/db/client';
import { z } from 'zod';
const createFieldSchema = z.object({
    objectApiName: z.string(),
    apiName: z.string().min(1).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
    label: z.string().min(1),
    type: z.string(),
    description: z.string().optional(),
    helpText: z.string().optional(),
    required: z.boolean().optional(),
    unique: z.boolean().optional(),
    readOnly: z.boolean().optional(),
    maxLength: z.number().optional(),
    minLength: z.number().optional(),
    scale: z.number().optional(),
    precision: z.number().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    picklistValues: z.array(z.string()).optional(),
    defaultValue: z.string().optional(),
});
const updateFieldSchema = createFieldSchema.omit({ objectApiName: true }).partial();
export async function fieldRoutes(app) {
    // Get all fields for an object
    app.get('/objects/:apiName/fields', async (req, reply) => {
        const { apiName } = req.params;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
            include: {
                fields: {
                    where: { isActive: true },
                    include: {
                        relationship: {
                            include: {
                                parentObject: true,
                                childObject: true,
                            },
                        },
                    },
                    orderBy: { label: 'asc' },
                },
            },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        reply.send(object.fields);
    });
    // Create new field
    app.post('/objects/:apiName/fields', async (req, reply) => {
        const { apiName } = req.params;
        const parsed = createFieldSchema.safeParse({ ...req.body, objectApiName: apiName });
        if (!parsed.success) {
            return reply.code(400).send(parsed.error.flatten());
        }
        const userId = req.user.sub;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        const field = await prisma.customField.create({
            data: {
                objectId: object.id,
                apiName: parsed.data.apiName,
                label: parsed.data.label,
                type: parsed.data.type,
                description: parsed.data.description,
                helpText: parsed.data.helpText,
                required: parsed.data.required ?? false,
                unique: parsed.data.unique ?? false,
                readOnly: parsed.data.readOnly ?? false,
                maxLength: parsed.data.maxLength,
                minLength: parsed.data.minLength,
                scale: parsed.data.scale,
                precision: parsed.data.precision,
                min: parsed.data.min,
                max: parsed.data.max,
                picklistValues: parsed.data.picklistValues ? JSON.stringify(parsed.data.picklistValues) : null,
                defaultValue: parsed.data.defaultValue,
                createdById: userId,
                modifiedById: userId,
            },
            include: {
                relationship: true,
            },
        });
        reply.code(201).send(field);
    });
    // Update field
    app.put('/objects/:apiName/fields/:fieldApiName', async (req, reply) => {
        const { apiName, fieldApiName } = req.params;
        const parsed = updateFieldSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send(parsed.error.flatten());
        }
        const userId = req.user.sub;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        const updateData = {
            ...parsed.data,
            modifiedById: userId,
        };
        if (parsed.data.picklistValues) {
            updateData.picklistValues = JSON.stringify(parsed.data.picklistValues);
        }
        const field = await prisma.customField.update({
            where: {
                objectId_apiName: {
                    objectId: object.id,
                    apiName: fieldApiName,
                },
            },
            data: updateData,
            include: {
                relationship: true,
            },
        });
        reply.send(field);
    });
    // Delete field (soft delete)
    app.delete('/objects/:apiName/fields/:fieldApiName', async (req, reply) => {
        const { apiName, fieldApiName } = req.params;
        const userId = req.user.sub;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        await prisma.customField.update({
            where: {
                objectId_apiName: {
                    objectId: object.id,
                    apiName: fieldApiName,
                },
            },
            data: {
                isActive: false,
                modifiedById: userId,
            },
        });
        reply.code(204).send();
    });
}
