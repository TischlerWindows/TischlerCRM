import { FastifyInstance } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

const reportSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  objectType: z.string(),
  format: z.enum(['tabular', 'summary', 'matrix']),
  fields: z.array(z.string()),
  filters: z.array(z.any()),
  groupBy: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  isPrivate: z.boolean().optional(),
  sharedWith: z.array(z.string()).optional(),
  isFavorite: z.boolean().optional(),
  folderId: z.string().optional(),
});

export async function reportRoutes(app: FastifyInstance) {
  // Get all reports (with filtering)
  app.get('/reports', async (req, reply) => {
    const { 
      objectType, 
      format, 
      isPrivate, 
      isFavorite, 
      createdByMe,
      folderId 
    } = req.query as { 
      objectType?: string; 
      format?: string; 
      isPrivate?: string;
      isFavorite?: string;
      createdByMe?: string;
      folderId?: string;
    };

    const userId = req.user?.id || 'default-user-id'; // TODO: Get from auth

    const where: any = {};

    if (objectType) where.objectType = objectType;
    if (format) where.format = format;
    if (isPrivate) where.isPrivate = isPrivate === 'true';
    if (isFavorite) where.isFavorite = isFavorite === 'true';
    if (createdByMe === 'true') where.createdById = userId;
    if (folderId) where.folderId = folderId;

    const reports = await prisma.report.findMany({
      where,
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
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    reply.send(reports);
  });

  // Get single report
  app.get('/reports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const report = await prisma.report.findUnique({
      where: { id },
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
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!report) {
      return reply.code(404).send({ error: 'Report not found' });
    }

    reply.send(report);
  });

  // Create report
  app.post('/reports', async (req, reply) => {
    const userId = req.user?.id || 'default-user-id'; // TODO: Get from auth

    try {
      const data = reportSchema.parse(req.body);

      const report = await prisma.report.create({
        data: {
          ...data,
          sharedWith: data.sharedWith || [],
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

      reply.code(201).send(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  // Update report
  app.put('/reports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user?.id || 'default-user-id'; // TODO: Get from auth

    try {
      const data = reportSchema.partial().parse(req.body);

      const report = await prisma.report.update({
        where: { id },
        data: {
          ...data,
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

      reply.send(report);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: error.errors });
      }
      throw error;
    }
  });

  // Toggle favorite
  app.patch('/reports/:id/favorite', async (req, reply) => {
    const { id } = req.params as { id: string };

    const report = await prisma.report.findUnique({
      where: { id },
      select: { isFavorite: true },
    });

    if (!report) {
      return reply.code(404).send({ error: 'Report not found' });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: { isFavorite: !report.isFavorite },
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

    reply.send(updated);
  });

  // Toggle private
  app.patch('/reports/:id/private', async (req, reply) => {
    const { id } = req.params as { id: string };

    const report = await prisma.report.findUnique({
      where: { id },
      select: { isPrivate: true },
    });

    if (!report) {
      return reply.code(404).send({ error: 'Report not found' });
    }

    const updated = await prisma.report.update({
      where: { id },
      data: { isPrivate: !report.isPrivate },
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

    reply.send(updated);
  });

  // Share report
  app.post('/reports/:id/share', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { emails } = req.body as { emails: string[] };

    if (!emails || !Array.isArray(emails)) {
      return reply.code(400).send({ error: 'emails array is required' });
    }

    const report = await prisma.report.findUnique({
      where: { id },
    });

    if (!report) {
      return reply.code(404).send({ error: 'Report not found' });
    }

    const currentSharedWith = (report.sharedWith as string[]) || [];
    const newSharedWith = [...new Set([...currentSharedWith, ...emails])];

    const updated = await prisma.report.update({
      where: { id },
      data: { 
        sharedWith: newSharedWith,
        isPrivate: false, // Sharing makes it non-private
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

    reply.send(updated);
  });

  // Delete report
  app.delete('/reports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      await prisma.report.delete({
        where: { id },
      });

      reply.code(204).send();
    } catch (error) {
      return reply.code(404).send({ error: 'Report not found' });
    }
  });

  // ============================================
  // Report Folders
  // ============================================

  // Get all folders
  app.get('/reports/folders', async (req, reply) => {
    const userId = req.user?.id || 'default-user-id';

    const folders = await prisma.reportFolder.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            reports: true,
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    reply.send(folders);
  });

  // Create folder
  app.post('/reports/folders', async (req, reply) => {
    const userId = req.user?.id || 'default-user-id';

    const { name, description, parentId, isPrivate } = req.body as {
      name: string;
      description?: string;
      parentId?: string;
      isPrivate?: boolean;
    };

    if (!name) {
      return reply.code(400).send({ error: 'name is required' });
    }

    const folder = await prisma.reportFolder.create({
      data: {
        name,
        description,
        parentId,
        isPrivate: isPrivate || false,
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
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    reply.code(201).send(folder);
  });

  // Update folder
  app.put('/reports/folders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const userId = req.user?.id || 'default-user-id';

    const { name, description, parentId, isPrivate } = req.body as {
      name?: string;
      description?: string;
      parentId?: string;
      isPrivate?: boolean;
    };

    const folder = await prisma.reportFolder.update({
      where: { id },
      data: {
        name,
        description,
        parentId,
        isPrivate,
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
        parent: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    reply.send(folder);
  });

  // Delete folder
  app.delete('/reports/folders/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    try {
      await prisma.reportFolder.delete({
        where: { id },
      });

      reply.code(204).send();
    } catch (error) {
      return reply.code(404).send({ error: 'Folder not found' });
    }
  });
}
