import type { FastifyInstance } from 'fastify'
import { prisma } from '@crm/db/client'
import { externalWidgetIds } from '../widgets/external/registry.js'

export async function widgetRoutes(app: FastifyInstance) {
  // GET /widgets — list all external widgets with enabled state (admin only)
  app.get('/widgets', async (request, reply) => {
    const user = (request as any).user
    if (!user || user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can manage widgets.' })
    }

    try {
      const orgId = user.sub as string
      const settings = await prisma.widgetSetting.findMany({ where: { orgId } })
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.widgetId, s.enabled]))

      return externalWidgetIds.map((id) => ({
        widgetId: id,
        enabled: settingsMap[id] ?? false,
      }))
    } catch (err: any) {
      app.log.error(err, 'GET /widgets failed')
      return reply.code(500).send({ error: 'Failed to load widget settings' })
    }
  })

  // PUT /widgets/:widgetId — toggle enabled state (admin only)
  app.put<{ Params: { widgetId: string }; Body: { enabled: boolean } }>(
    '/widgets/:widgetId',
    async (request, reply) => {
      const user = (request as any).user
      if (!user || user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Only admins can manage widgets.' })
      }

      const { widgetId } = request.params
      const { enabled } = request.body as { enabled: boolean }
      const orgId = user.sub as string

      if (!externalWidgetIds.includes(widgetId)) {
        return reply.code(404).send({ error: 'Widget not found' })
      }

      try {
        await prisma.widgetSetting.upsert({
          where: { orgId_widgetId: { orgId, widgetId } },
          create: { orgId, widgetId, enabled },
          update: { enabled },
        })

        return { widgetId, enabled }
      } catch (err: any) {
        app.log.error(err, 'PUT /widgets/:widgetId failed')
        return reply.code(500).send({ error: 'Failed to update widget setting' })
      }
    }
  )
}
