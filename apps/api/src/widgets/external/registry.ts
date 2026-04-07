import type { FastifyInstance } from 'fastify'
export { EXTERNAL_WIDGET_IDS as externalWidgetIds } from '@crm/widgets'

export const externalWidgetRouteModules: Array<{
  widgetId: string
  registerRoutes: (app: FastifyInstance) => Promise<void>
}> = []
