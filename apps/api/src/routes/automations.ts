import type { FastifyInstance } from 'fastify'
import { prisma } from '@crm/db/client'
import { TRIGGER_IDS } from '@crm/triggers'
import { CONTROLLER_IDS } from '@crm/controllers'
import { getAllTriggers } from '../lib/triggers/registry-loader.js'
import { getAllControllers } from '../lib/controllers/registry-loader.js'

const triggerIds: readonly string[] = TRIGGER_IDS
const controllerIds: readonly string[] = CONTROLLER_IDS

export async function automationRoutes(app: FastifyInstance) {
  // GET /automations/triggers — list all triggers with enabled state (admin only)
  app.get('/automations/triggers', async (request, reply) => {
    const user = (request as any).user
    if (!user || user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can manage automations.' })
    }

    try {
      const orgId = user.sub as string
      const settings = await prisma.triggerSetting.findMany({ where: { orgId } })
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.triggerId, s.enabled]))

      return getAllTriggers().map((t) => ({
        triggerId: t.id,
        enabled: settingsMap[t.id] ?? false,
        name: t.name,
        description: t.description,
        icon: t.icon,
        objectApiName: t.objectApiName,
        events: t.events,
      }))
    } catch (err: any) {
      app.log.error(err, 'GET /automations/triggers failed')
      return reply.code(500).send({ error: 'Failed to load trigger settings' })
    }
  })

  // PUT /automations/triggers/:triggerId — toggle enabled state (admin only)
  app.put<{ Params: { triggerId: string }; Body: { enabled: boolean } }>(
    '/automations/triggers/:triggerId',
    async (request, reply) => {
      const user = (request as any).user
      if (!user || user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Only admins can manage automations.' })
      }

      const { triggerId } = request.params
      const { enabled } = request.body as { enabled: boolean }
      const orgId = user.sub as string

      if (!triggerIds.includes(triggerId)) {
        return reply.code(404).send({ error: 'Trigger not found' })
      }

      try {
        await prisma.triggerSetting.upsert({
          where: { orgId_triggerId: { orgId, triggerId } },
          create: { orgId, triggerId, enabled },
          update: { enabled },
        })

        return { triggerId, enabled }
      } catch (err: any) {
        app.log.error(err, 'PUT /automations/triggers/:triggerId failed')
        return reply.code(500).send({ error: 'Failed to update trigger setting' })
      }
    }
  )

  // GET /automations/controllers — list all controllers with enabled state (admin only)
  app.get('/automations/controllers', async (request, reply) => {
    const user = (request as any).user
    if (!user || user.role !== 'ADMIN') {
      return reply.code(403).send({ error: 'Only admins can manage automations.' })
    }

    try {
      const orgId = user.sub as string
      const settings = await prisma.controllerSetting.findMany({ where: { orgId } })
      const settingsMap = Object.fromEntries(settings.map((s: any) => [s.controllerId, s.enabled]))

      return getAllControllers().map((c) => ({
        controllerId: c.id,
        enabled: settingsMap[c.id] ?? false,
        name: c.name,
        description: c.description,
        icon: c.icon,
        objectApiName: c.objectApiName,
        routePrefix: c.routePrefix,
      }))
    } catch (err: any) {
      app.log.error(err, 'GET /automations/controllers failed')
      return reply.code(500).send({ error: 'Failed to load controller settings' })
    }
  })

  // PUT /automations/controllers/:controllerId — toggle enabled state (admin only)
  app.put<{ Params: { controllerId: string }; Body: { enabled: boolean } }>(
    '/automations/controllers/:controllerId',
    async (request, reply) => {
      const user = (request as any).user
      if (!user || user.role !== 'ADMIN') {
        return reply.code(403).send({ error: 'Only admins can manage automations.' })
      }

      const { controllerId } = request.params
      const { enabled } = request.body as { enabled: boolean }
      const orgId = user.sub as string

      if (!controllerIds.includes(controllerId)) {
        return reply.code(404).send({ error: 'Controller not found' })
      }

      try {
        await prisma.controllerSetting.upsert({
          where: { orgId_controllerId: { orgId, controllerId } },
          create: { orgId, controllerId, enabled },
          update: { enabled },
        })

        return { controllerId, enabled }
      } catch (err: any) {
        app.log.error(err, 'PUT /automations/controllers/:controllerId failed')
        return reply.code(500).send({ error: 'Failed to update controller setting' })
      }
    }
  )
}
