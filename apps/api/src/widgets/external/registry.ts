import type { FastifyInstance } from 'fastify'

// IDs must match WidgetManifest.id in apps/web/widgets/external/
export const externalWidgetIds: string[] = [
  'demo-widget',
]

export const externalWidgetRouteModules: Array<{
  widgetId: string
  registerRoutes: (app: FastifyInstance) => Promise<void>
}> = []
