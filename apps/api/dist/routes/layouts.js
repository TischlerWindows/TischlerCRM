import { prisma } from '@crm/db/client';
import { z } from 'zod';
const layoutFieldSchema = z.object({
    fieldApiName: z.string(),
    column: z.number(),
    order: z.number(),
});
const layoutSectionSchema = z.object({
    label: z.string(),
    columns: z.number().min(1).max(3),
    order: z.number(),
    fields: z.array(layoutFieldSchema),
});
const layoutTabSchema = z.object({
    label: z.string(),
    order: z.number(),
    sections: z.array(layoutSectionSchema),
});
const createLayoutSchema = z.object({
    objectApiName: z.string(),
    name: z.string().min(1),
    layoutType: z.string(),
    isDefault: z.boolean().optional(),
    tabs: z.array(layoutTabSchema),
});
const updateLayoutSchema = createLayoutSchema.omit({ objectApiName: true }).partial();
export async function layoutRoutes(app) {
    // Get all layouts for an object
    app.get('/objects/:apiName/layouts', async (req, reply) => {
        const { apiName } = req.params;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
            include: {
                pageLayouts: {
                    where: { isActive: true },
                    include: {
                        tabs: {
                            include: {
                                sections: {
                                    include: {
                                        fields: {
                                            include: {
                                                field: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        reply.send(object.pageLayouts);
    });
    // Get single layout
    app.get('/layouts/:layoutId', async (req, reply) => {
        const { layoutId } = req.params;
        const layout = await prisma.pageLayout.findUnique({
            where: { id: layoutId },
            include: {
                tabs: {
                    include: {
                        sections: {
                            include: {
                                fields: {
                                    include: {
                                        field: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!layout) {
            return reply.code(404).send({ error: 'Layout not found' });
        }
        reply.send(layout);
    });
    // Create new layout
    app.post('/objects/:apiName/layouts', async (req, reply) => {
        const { apiName } = req.params;
        const parsed = createLayoutSchema.safeParse({ ...req.body, objectApiName: apiName });
        if (!parsed.success) {
            return reply.code(400).send(parsed.error.flatten());
        }
        const userId = req.user.sub;
        const object = await prisma.customObject.findUnique({
            where: { apiName },
            include: {
                fields: true,
            },
        });
        if (!object) {
            return reply.code(404).send({ error: 'Object not found' });
        }
        // Create layout with nested tabs, sections, and fields
        const layout = await prisma.pageLayout.create({
            data: {
                objectId: object.id,
                name: parsed.data.name,
                layoutType: parsed.data.layoutType,
                isDefault: parsed.data.isDefault ?? false,
                createdById: userId,
                modifiedById: userId,
                tabs: {
                    create: parsed.data.tabs.map((tab) => ({
                        label: tab.label,
                        order: tab.order,
                        sections: {
                            create: tab.sections.map((section) => ({
                                label: section.label,
                                columns: section.columns,
                                order: section.order,
                                fields: {
                                    create: section.fields.map((field) => {
                                        const fieldDef = object.fields.find((f) => f.apiName === field.fieldApiName);
                                        if (!fieldDef) {
                                            throw new Error(`Field ${field.fieldApiName} not found`);
                                        }
                                        return {
                                            fieldId: fieldDef.id,
                                            column: field.column,
                                            order: field.order,
                                        };
                                    }),
                                },
                            })),
                        },
                    })),
                },
            },
            include: {
                tabs: {
                    include: {
                        sections: {
                            include: {
                                fields: {
                                    include: {
                                        field: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        reply.code(201).send(layout);
    });
    // Update layout
    app.put('/layouts/:layoutId', async (req, reply) => {
        const { layoutId } = req.params;
        const parsed = updateLayoutSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.code(400).send(parsed.error.flatten());
        }
        const userId = req.user.sub;
        const existingLayout = await prisma.pageLayout.findUnique({
            where: { id: layoutId },
            include: {
                object: {
                    include: {
                        fields: true,
                    },
                },
                tabs: {
                    include: {
                        sections: {
                            include: {
                                fields: true,
                            },
                        },
                    },
                },
            },
        });
        if (!existingLayout) {
            return reply.code(404).send({ error: 'Layout not found' });
        }
        // Delete existing tabs (cascade will delete sections and fields)
        await prisma.layoutTab.deleteMany({
            where: { layoutId },
        });
        // Update layout with new tabs if provided
        const layout = await prisma.pageLayout.update({
            where: { id: layoutId },
            data: {
                name: parsed.data.name,
                layoutType: parsed.data.layoutType,
                isDefault: parsed.data.isDefault,
                modifiedById: userId,
                ...(parsed.data.tabs && {
                    tabs: {
                        create: parsed.data.tabs.map((tab) => ({
                            label: tab.label,
                            order: tab.order,
                            sections: {
                                create: tab.sections.map((section) => ({
                                    label: section.label,
                                    columns: section.columns,
                                    order: section.order,
                                    fields: {
                                        create: section.fields.map((field) => {
                                            const fieldDef = existingLayout.object.fields.find((f) => f.apiName === field.fieldApiName);
                                            if (!fieldDef) {
                                                throw new Error(`Field ${field.fieldApiName} not found`);
                                            }
                                            return {
                                                fieldId: fieldDef.id,
                                                column: field.column,
                                                order: field.order,
                                            };
                                        }),
                                    },
                                })),
                            },
                        })),
                    },
                }),
            },
            include: {
                tabs: {
                    include: {
                        sections: {
                            include: {
                                fields: {
                                    include: {
                                        field: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        reply.send(layout);
    });
    // Delete layout (soft delete)
    app.delete('/layouts/:layoutId', async (req, reply) => {
        const { layoutId } = req.params;
        const userId = req.user.sub;
        await prisma.pageLayout.update({
            where: { id: layoutId },
            data: {
                isActive: false,
                modifiedById: userId,
            },
        });
        reply.code(204).send();
    });
}
