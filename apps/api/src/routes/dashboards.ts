import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@crm/db/client';
import { z } from 'zod';

const dashboardSchema = z.object({
  name: z.string().min(1, 'Dashboard name is required'),
  description: z.string().optional(),
  isFavorite: z.boolean().optional(),
  widgets: z.array(z.object({
    type: z.string(),
    title: z.string(),
    dataSource: z.string(),
    reportId: z.string().optional().nullable(),
    config: z.record(z.unknown()).optional(),
    position: z.object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    }).optional(),
  })).optional().default([]),
});

export async function dashboardRoutes(app: FastifyInstance) {
  // GET /dashboards - List all dashboards for the current user
  app.get('/dashboards', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const dashboards = await prisma.dashboard.findMany({
        where: {
          OR: [
            { createdById: userId },
            { isPrivate: false },
          ],
        },
        include: {
          widgets: {
            orderBy: { positionY: 'asc' },
          },
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      return reply.send(dashboards);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      return reply.code(500).send({ error: 'Failed to fetch dashboards' });
    }
  });

  // POST /dashboards - Create a new dashboard
  app.post('/dashboards', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const parsed = dashboardSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { name, description, widgets } = parsed.data;

      const dashboard = await prisma.dashboard.create({
        data: {
          name,
          description,
          createdById: userId,
          modifiedById: userId,
          widgets: {
            create: widgets.map((widget: any) => ({
              type: widget.type,
              title: widget.title,
              dataSource: widget.dataSource,
              reportId: widget.reportId,
              config: widget.config || {},
              positionX: widget.position?.x || 0,
              positionY: widget.position?.y || 0,
              width: widget.position?.w || 4,
              height: widget.position?.h || 2,
            })),
          },
        },
        include: {
          widgets: true,
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      return reply.code(201).send(dashboard);
    } catch (error) {
      console.error('Error creating dashboard:', error);
      return reply.code(500).send({ error: 'Failed to create dashboard' });
    }
  });

  // GET /dashboards/:id - Get a specific dashboard
  app.get('/dashboards/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.sub;
      const { id } = request.params as any;

      const dashboard = await prisma.dashboard.findUnique({
        where: { id },
        include: {
          widgets: {
            orderBy: { positionY: 'asc' },
          },
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      if (!dashboard) {
        return reply.code(404).send({ error: 'Dashboard not found' });
      }

      // Check permissions
      if (dashboard.isPrivate && dashboard.createdById !== userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      return reply.send(dashboard);
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      return reply.code(500).send({ error: 'Failed to fetch dashboard' });
    }
  });

  // PUT /dashboards/:id - Update a dashboard
  app.put('/dashboards/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;
      const parsed = dashboardSchema.partial().safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { name, description, isFavorite, widgets = [] } = parsed.data;

      // Check ownership
      const dashboard = await prisma.dashboard.findUnique({
        where: { id },
        select: { createdById: true },
      });

      if (!dashboard || dashboard.createdById !== userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      // Delete existing widgets and create new ones
      const updated = await prisma.dashboard.update({
        where: { id },
        data: {
          name,
          description,
          isFavorite,
          modifiedById: userId,
          widgets: {
            deleteMany: {}, // Delete all existing widgets
            create: widgets.map((widget: any) => ({
              type: widget.type,
              title: widget.title,
              dataSource: widget.dataSource,
              reportId: widget.reportId,
              config: widget.config || {},
              positionX: widget.position?.x || 0,
              positionY: widget.position?.y || 0,
              width: widget.position?.w || 4,
              height: widget.position?.h || 2,
            })),
          },
        },
        include: {
          widgets: true,
          createdBy: {
            select: { id: true, email: true, name: true },
          },
        },
      });

      return reply.send(updated);
    } catch (error) {
      console.error('Error updating dashboard:', error);
      return reply.code(500).send({ error: 'Failed to update dashboard' });
    }
  });

  // DELETE /dashboards/:id - Delete a dashboard
  app.delete('/dashboards/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = request.user?.sub;
      if (!userId) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const { id } = request.params as any;

      // Check ownership
      const dashboard = await prisma.dashboard.findUnique({
        where: { id },
        select: { createdById: true },
      });

      if (!dashboard || dashboard.createdById !== userId) {
        return reply.code(403).send({ error: 'Access denied' });
      }

      await prisma.dashboard.delete({
        where: { id },
      });

      return reply.code(204).send();
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      return reply.code(500).send({ error: 'Failed to delete dashboard' });
    }
  });

  // GET /dashboards/:id/widgets - List widgets for a dashboard
  app.get(
    '/dashboards/:id/widgets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.sub;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as any;

        // Verify dashboard exists and user has access
        const dashboard = await prisma.dashboard.findUnique({
          where: { id },
          select: { createdById: true, isPrivate: true },
        });

        if (!dashboard) {
          return reply.code(404).send({ error: 'Dashboard not found' });
        }

        if (dashboard.isPrivate && dashboard.createdById !== userId) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const widgets = await prisma.dashboardWidget.findMany({
          where: { dashboardId: id },
          orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }],
        });

        return reply.send(widgets);
      } catch (error) {
        console.error('Error fetching widgets:', error);
        return reply.code(500).send({ error: 'Failed to fetch widgets' });
      }
    }
  );

  // POST /dashboards/:id/widgets - Add a widget to a dashboard
  app.post(
    '/dashboards/:id/widgets',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.sub;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id } = request.params as any;
        const widgetSchema = z.object({
          type: z.string().min(1),
          title: z.string().min(1),
          dataSource: z.string().min(1),
          reportId: z.string().optional().nullable(),
          config: z.record(z.unknown()).optional(),
          position: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }).optional(),
        });
        const parsed = widgetSchema.safeParse(request.body);
        if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
        const { type, title, dataSource, reportId, config, position } = parsed.data;

        // Verify dashboard exists and user owns it
        const dashboard = await prisma.dashboard.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!dashboard || dashboard.createdById !== userId) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        const widget = await prisma.dashboardWidget.create({
          data: {
            dashboardId: id,
            type,
            title,
            dataSource,
            reportId: reportId || null,
            config: config || {},
            positionX: position?.x || 0,
            positionY: position?.y || 0,
            width: position?.w || 4,
            height: position?.h || 2,
          },
        });

        return reply.code(201).send(widget);
      } catch (error) {
        console.error('Error creating widget:', error);
        return reply.code(500).send({ error: 'Failed to create widget' });
      }
    }
  );

  // PUT /dashboards/:id/widgets/:widgetId - Update a widget
  app.put(
    '/dashboards/:id/widgets/:widgetId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.sub;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id, widgetId } = request.params as any;
        const { type, title, dataSource, reportId, config, position } =
          request.body as any;

        // Verify dashboard exists and user owns it
        const dashboard = await prisma.dashboard.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!dashboard || dashboard.createdById !== userId) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        // Verify widget exists in this dashboard
        const widget = await prisma.dashboardWidget.findFirst({
          where: { id: widgetId, dashboardId: id },
        });

        if (!widget) {
          return reply.code(404).send({ error: 'Widget not found' });
        }

        const updated = await prisma.dashboardWidget.update({
          where: { id: widgetId },
          data: {
            ...(type && { type }),
            ...(title && { title }),
            ...(dataSource && { dataSource }),
            ...(reportId !== undefined && { reportId }),
            ...(config && { config }),
            ...(position && {
              positionX: position.x,
              positionY: position.y,
              width: position.w,
              height: position.h,
            }),
          },
        });

        return reply.send(updated);
      } catch (error) {
        console.error('Error updating widget:', error);
        return reply.code(500).send({ error: 'Failed to update widget' });
      }
    }
  );

  // DELETE /dashboards/:id/widgets/:widgetId - Delete a widget
  app.delete(
    '/dashboards/:id/widgets/:widgetId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const userId = request.user?.sub;
        if (!userId) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }

        const { id, widgetId } = request.params as any;

        // Verify dashboard exists and user owns it
        const dashboard = await prisma.dashboard.findUnique({
          where: { id },
          select: { createdById: true },
        });

        if (!dashboard || dashboard.createdById !== userId) {
          return reply.code(403).send({ error: 'Access denied' });
        }

        // Verify widget exists in this dashboard
        const widget = await prisma.dashboardWidget.findFirst({
          where: { id: widgetId, dashboardId: id },
        });

        if (!widget) {
          return reply.code(404).send({ error: 'Widget not found' });
        }

        await prisma.dashboardWidget.delete({
          where: { id: widgetId },
        });

        return reply.code(204).send();
      } catch (error) {
        console.error('Error deleting widget:', error);
        return reply.code(500).send({ error: 'Failed to delete widget' });
      }
    }
  );
}
