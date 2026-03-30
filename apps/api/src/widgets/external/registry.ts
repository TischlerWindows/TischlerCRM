import type { FastifyInstance } from 'fastify'

export const externalWidgetRouteModules: Array<{
  widgetId: string
  registerRoutes: (app: FastifyInstance) => Promise<void>
}> = []
