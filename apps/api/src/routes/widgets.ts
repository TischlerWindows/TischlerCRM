import type { FastifyInstance } from 'fastify'
import { prisma } from '@crm/db/client'
import { EXTERNAL_WIDGET_IDS, INTERNAL_WIDGET_IDS, widgetKind } from '@crm/widgets'

const ALL_WIDGET_IDS = [...EXTERNAL_WIDGET_IDS, ...INTERNAL_WIDGET_IDS] as readonly string[]
const SHARED_WIDGET_SETTINGS_ORG_ID = 'default'

export async function widgetRoutes(app: FastifyInstance) {
  // GET /widgets — list all widgets (internal + external) with enabled state.
  // Readable by any authenticated user; record renderers need this to skip
  // disabled widgets. Writes are still admin-only (see PUT below).
  app.get('/widgets', async (request, reply) => {
    const user = (request as any).user
    if (!user) return reply.code(401).send({ error: 'Unauthorized' })

    try {
      const [sharedSettings, admins] = await Promise.all([
        prisma.widgetSetting.findMany({ where: { orgId: SHARED_WIDGET_SETTINGS_ORG_ID } }),
        prisma.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
      ])
      const legacySettings = admins.length
        ? await prisma.widgetSetting.findMany({
            where: { orgId: { in: admins.map((admin) => admin.id) } },
            orderBy: { updatedAt: 'desc' },
          })
        : []
      const settingsMap: Record<string, boolean> = {}
      for (const setting of legacySettings) {
        if (!(setting.widgetId in settingsMap)) settingsMap[setting.widgetId] = setting.enabled
      }
      for (const setting of sharedSettings) settingsMap[setting.widgetId] = setting.enabled

      return ALL_WIDGET_IDS.map((id) => {
        const kind = widgetKind(id) ?? 'external'
        // External widgets are opt-in (often require an integration); internal
        // widgets are opt-out because they render by default today. No-record
        // therefore means enabled for internal, disabled for external.
        const defaultEnabled = kind === 'internal'
        return {
          widgetId: id,
          kind,
          enabled: settingsMap[id] ?? defaultEnabled,
        }
      })
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
      if (!ALL_WIDGET_IDS.includes(widgetId)) {
        return reply.code(404).send({ error: 'Widget not found' })
      }

      try {
        await prisma.widgetSetting.upsert({
          where: { orgId_widgetId: { orgId: SHARED_WIDGET_SETTINGS_ORG_ID, widgetId } },
          create: { orgId: SHARED_WIDGET_SETTINGS_ORG_ID, widgetId, enabled },
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
