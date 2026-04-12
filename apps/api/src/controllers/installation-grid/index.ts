import type { FastifyInstance } from 'fastify'
import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'

/* ------------------------------------------------------------------ */
/*  Field-name allow-lists                                            */
/* ------------------------------------------------------------------ */

const COST_FIELDS = [
  'flightsActual', 'lodgingActual', 'carRental', 'airportTransportation',
  'parking', 'equipment', 'miscellaneousExpenses', 'waterproofing', 'woodBucks',
]

const LABOR_HOUR_FIELDS = [
  'containerUnload', 'woodbucks', 'waterproofing', 'installationLabor',
  'travel', 'waterTesting', 'sills', 'finishCaulking',
  'screenLutronShades', 'punchListWork', 'finishHardware', 'finalAdjustments',
]

const EXPENSE_FIELDS = ['perDiem', 'mileage', 'materials']

const TECH_EXPENSE_ALLOWED = [...LABOR_HOUR_FIELDS, ...EXPENSE_FIELDS]

const ESTIMATED_FIELDS = [
  'estimatedLaborCost', 'estimatedHotel', 'estimatedTravelExp',
  'estimatedMileage', 'estimatedPerDiem', 'estimatedFlights',
  'estimatedCarRental', 'estimatedParking', 'estimatedEquipment',
  'estimatedMiscellaneous', 'estimatedWaterproofing', 'estimatedWoodBucks',
  'estimatedAirportTransportation', 'estimatedMaterials', 'estimatedContainerUnload',
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

async function getObjectId(apiName: string): Promise<string | null> {
  const obj = await prisma.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
    select: { id: true },
  })
  return obj?.id ?? null
}

async function findRecordsByObjectAndField(
  objectId: string,
  fieldName: string,
  fieldValue: string,
): Promise<Array<{ id: string; data: any }>> {
  const all = await prisma.record.findMany({
    where: { objectId },
    select: { id: true, data: true },
  })
  return all.filter((r: any) => {
    const d = r.data as Record<string, any>
    return d[fieldName] === fieldValue
  })
}

async function checkControllerEnabled(orgId: string): Promise<boolean> {
  try {
    const setting = await prisma.controllerSetting.findFirst({
      where: { orgId, controllerId: 'installation-grid' },
    })
    // If no setting row exists, treat as enabled (opt-out model)
    if (!setting) return true
    return setting.enabled
  } catch {
    // Table may not exist yet — treat as enabled
    return true
  }
}

/* ------------------------------------------------------------------ */
/*  Route registration                                                */
/* ------------------------------------------------------------------ */

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  // Ensure ID prefixes are registered for custom objects we create records for
  registerRecordIdPrefix('InstallationCost')
  registerRecordIdPrefix('InstallationTechExpense')
  registerRecordIdPrefix('InstallationTechnician')

  // ---------- Auth + controller-enabled guard ----------
  app.addHook('preHandler', async (request, reply) => {
    const user = (request as any).user
    if (!user) {
      return reply.code(401).send({ error: 'Authentication required' })
    }
    const enabled = await checkControllerEnabled(user.sub)
    if (!enabled) {
      return reply.code(403).send({ error: 'Installation grid controller is disabled' })
    }
  })

  // ====================================================================
  // 1. GET /:installationId/data — Full data wrapper
  // ====================================================================
  app.get('/:installationId/data', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const user = (request as any).user

    // Fetch installation record
    const installation = await prisma.record.findUnique({ where: { id: installationId } })
    if (!installation) {
      return reply.code(404).send({ error: 'Installation not found' })
    }

    // Fetch object IDs
    const [costObjectId, junctionObjectId, techExpenseObjectId, techObjectId] = await Promise.all([
      getObjectId('InstallationCost'),
      getObjectId('InstallationTechnician'),
      getObjectId('InstallationTechExpense'),
      getObjectId('Technician'),
    ])

    // Fetch cost records sorted by weekNumber
    let costs: any[] = []
    if (costObjectId) {
      const raw = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
      costs = raw.sort((a: any, b: any) => {
        const aW = (a.data as Record<string, any>).weekNumber ?? 0
        const bW = (b.data as Record<string, any>).weekNumber ?? 0
        return aW - bW
      })
    }

    // Fetch technician junctions
    let junctions: any[] = []
    if (junctionObjectId) {
      junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
    }

    // For each junction, look up technician name
    const techExpenses: Record<string, any> = {}
    for (const junction of junctions) {
      const jData = junction.data as Record<string, any>
      let techName = 'Unknown'
      if (techObjectId && jData.technician) {
        const techRecord = await prisma.record.findUnique({ where: { id: jData.technician } })
        if (techRecord) {
          techName = (techRecord.data as Record<string, any>).technicianName ?? 'Unknown'
        }
      }

      // Fetch tech expenses for this junction, sorted by weekNumber
      let expenses: any[] = []
      if (techExpenseObjectId) {
        expenses = (await findRecordsByObjectAndField(
          techExpenseObjectId,
          'installationTechnician',
          junction.id,
        )).sort((a: any, b: any) =>
          ((a.data as Record<string, any>).weekNumber ?? 0) - ((b.data as Record<string, any>).weekNumber ?? 0)
        )
      }

      techExpenses[junction.id] = {
        technician: {
          id: jData.technician,
          name: techName,
          assignedHourlyRate: jData.assignedHourlyRate ?? 0,
        },
        expenses,
      }
    }

    return {
      installation,
      costs,
      techExpenses,
      weekCount: costs.length,
    }
  })

  // ====================================================================
  // 2. PUT /:installationId/costs — Bulk update cost records
  // ====================================================================
  app.put('/:installationId/costs', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const { updates } = request.body as { updates: Array<{ id: string; [k: string]: any }> }
    const user = (request as any).user

    if (!Array.isArray(updates) || updates.length === 0) {
      return reply.code(400).send({ error: 'updates array is required' })
    }

    let count = 0
    for (const update of updates) {
      const record = await prisma.record.findUnique({ where: { id: update.id } })
      if (!record) continue

      const data = record.data as Record<string, any>
      if (data.installation !== installationId) continue

      const patch: Record<string, any> = {}
      for (const [key, value] of Object.entries(update)) {
        if (key === 'id') continue
        if (!COST_FIELDS.includes(key)) continue
        patch[key] = round2(Number(value))
      }

      if (Object.keys(patch).length > 0) {
        await prisma.record.update({
          where: { id: update.id },
          data: {
            data: { ...data, ...patch },
            modifiedById: user.sub,
          },
        })
        count++
      }
    }

    return { updated: count }
  })

  // ====================================================================
  // 3. PUT /:installationId/tech-expenses — Bulk update tech expense records
  // ====================================================================
  app.put('/:installationId/tech-expenses', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const { updates } = request.body as { updates: Array<{ id: string; [k: string]: any }> }
    const user = (request as any).user

    if (!Array.isArray(updates) || updates.length === 0) {
      return reply.code(400).send({ error: 'updates array is required' })
    }

    let count = 0
    for (const update of updates) {
      const record = await prisma.record.findUnique({ where: { id: update.id } })
      if (!record) continue

      const data = record.data as Record<string, any>
      if (data.installation !== installationId) continue

      const patch: Record<string, any> = {}
      for (const [key, value] of Object.entries(update)) {
        if (key === 'id') continue
        if (!TECH_EXPENSE_ALLOWED.includes(key)) continue
        patch[key] = round2(Number(value))
      }

      if (Object.keys(patch).length > 0) {
        await prisma.record.update({
          where: { id: update.id },
          data: {
            data: { ...data, ...patch },
            modifiedById: user.sub,
          },
        })
        count++
      }
    }

    return { updated: count }
  })

  // ====================================================================
  // 4. POST /:installationId/recalculate — Recalculate totals
  // ====================================================================
  app.post('/:installationId/recalculate', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const user = (request as any).user

    const installation = await prisma.record.findUnique({ where: { id: installationId } })
    if (!installation) {
      return reply.code(404).send({ error: 'Installation not found' })
    }
    const instData = installation.data as Record<string, any>

    // Get object IDs
    const [costObjectId, junctionObjectId, techExpenseObjectId] = await Promise.all([
      getObjectId('InstallationCost'),
      getObjectId('InstallationTechnician'),
      getObjectId('InstallationTechExpense'),
    ])

    // Sum all InstallationCost fields across all weeks
    let totalCostFromWeeks = 0
    if (costObjectId) {
      const costRecords = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
      for (const rec of costRecords) {
        const d = rec.data as Record<string, any>
        for (const field of COST_FIELDS) {
          totalCostFromWeeks += Number(d[field] ?? 0)
        }
      }
    }

    // Sum tech expenses: LABOR_HOUR_FIELDS x hourlyRate + perDiem + mileage + materials
    let techExpenseTotal = 0
    if (junctionObjectId && techExpenseObjectId) {
      const junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
      for (const junction of junctions) {
        const jData = junction.data as Record<string, any>
        const hourlyRate = Number(jData.assignedHourlyRate ?? 0)

        const expenses = await findRecordsByObjectAndField(
          techExpenseObjectId,
          'installationTechnician',
          junction.id,
        )
        for (const exp of expenses) {
          const ed = exp.data as Record<string, any>
          // Labor hours * hourly rate
          for (const field of LABOR_HOUR_FIELDS) {
            techExpenseTotal += Number(ed[field] ?? 0) * hourlyRate
          }
          // Flat expenses
          techExpenseTotal += Number(ed.perDiem ?? 0)
          techExpenseTotal += Number(ed.mileage ?? 0)
          techExpenseTotal += Number(ed.materials ?? 0)
        }
      }
    }

    const finalCost = round2(totalCostFromWeeks + techExpenseTotal)
    const installationBudget = Number(instData.installationBudget ?? 0)
    const finalProfit = round2(installationBudget - finalCost)

    // Update installation record
    await prisma.record.update({
      where: { id: installationId },
      data: {
        data: {
          ...instData,
          finalCost,
          finalProfit,
          techExpenseTotal: round2(techExpenseTotal),
        },
        modifiedById: user.sub,
      },
    })

    return {
      finalCost,
      finalProfit,
      techExpenseTotal: round2(techExpenseTotal),
    }
  })

  // ====================================================================
  // 5. POST /:installationId/weeks/add — Add a week
  // ====================================================================
  app.post('/:installationId/weeks/add', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const user = (request as any).user

    try {
    const installation = await prisma.record.findUnique({ where: { id: installationId } })
    if (!installation) {
      return reply.code(404).send({ error: 'Installation not found' })
    }
    const instData = installation.data as Record<string, any>

    // Guard: need at least startDate to add weeks
    if (!instData.startDate && !instData.endDate) {
      return reply.code(400).send({ error: 'Installation must have start and end dates before adding weeks. Set dates on the Installation record first.' })
    }

    const [costObjectId, junctionObjectId, techExpenseObjectId] = await Promise.all([
      getObjectId('InstallationCost'),
      getObjectId('InstallationTechnician'),
      getObjectId('InstallationTechExpense'),
    ])
    if (!costObjectId) {
      return reply.code(500).send({ error: 'InstallationCost object not found. Ensure the database has been seeded.' })
    }

    // Find max weekNumber
    const existingCosts = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
    let maxWeek = 0
    let lastEnd: string | null = null
    for (const rec of existingCosts) {
      const d = rec.data as Record<string, any>
      const wn = Number(d.weekNumber ?? 0)
      if (wn > maxWeek) {
        maxWeek = wn
        lastEnd = d.weekEndDate ?? null
      }
    }

    const newWeekNumber = maxWeek + 1

    // Calculate new week dates
    let weekStartDate: string
    let weekEndDate: string
    if (lastEnd) {
      const start = new Date(lastEnd)
      start.setDate(start.getDate() + 1)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      weekStartDate = start.toISOString().split('T')[0]!
      weekEndDate = end.toISOString().split('T')[0]!
    } else if (instData.endDate) {
      // No existing weeks but has endDate — start from there
      const start = new Date(instData.endDate)
      start.setDate(start.getDate() + 1)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      weekStartDate = start.toISOString().split('T')[0]!
      weekEndDate = end.toISOString().split('T')[0]!
    } else {
      // Has startDate but no endDate — start from startDate
      const start = new Date(instData.startDate)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      weekStartDate = start.toISOString().split('T')[0]!
      weekEndDate = end.toISOString().split('T')[0]!
    }

    // Create new InstallationCost record
    await prisma.record.create({
      data: {
        id: generateRecordId('InstallationCost'),
        objectId: costObjectId,
        data: {
          installation: installationId,
          weekNumber: newWeekNumber,
          weekStartDate,
          weekEndDate,
          flightsActual: 0, lodgingActual: 0, carRental: 0, airportTransportation: 0,
          parking: 0, equipment: 0, miscellaneousExpenses: 0, waterproofing: 0, woodBucks: 0,
        },
        createdById: user.sub,
        modifiedById: user.sub,
      },
    })

    // Create InstallationTechExpense for each assigned technician x new week
    if (junctionObjectId && techExpenseObjectId) {
      const junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
      for (const junction of junctions) {
        await prisma.record.create({
          data: {
            id: generateRecordId('InstallationTechExpense'),
            objectId: techExpenseObjectId,
            data: {
              installation: installationId,
              installationTechnician: junction.id,
              weekNumber: newWeekNumber,
              weekStartDate,
              weekEndDate,
              containerUnload: 0, woodbucks: 0, waterproofing: 0, installationLabor: 0,
              travel: 0, waterTesting: 0, sills: 0, finishCaulking: 0,
              screenLutronShades: 0, punchListWork: 0, finishHardware: 0, finalAdjustments: 0,
              perDiem: 0, mileage: 0, materials: 0,
            },
            createdById: user.sub,
            modifiedById: user.sub,
          },
        })
      }
    }

    // Update installation endDate
    await prisma.record.update({
      where: { id: installationId },
      data: {
        data: { ...instData, endDate: weekEndDate },
        modifiedById: user.sub,
      },
    })

    return { weekNumber: newWeekNumber, weekStartDate, weekEndDate }
    } catch (err: any) {
      request.log.error(err, 'POST weeks/add failed')
      return reply.code(500).send({ error: err.message || 'Failed to add week' })
    }
  })

  // ====================================================================
  // 6. POST /:installationId/weeks/remove — Remove last week
  // ====================================================================
  app.post('/:installationId/weeks/remove', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const user = (request as any).user

    const installation = await prisma.record.findUnique({ where: { id: installationId } })
    if (!installation) {
      return reply.code(404).send({ error: 'Installation not found' })
    }
    const instData = installation.data as Record<string, any>

    const [costObjectId, techExpenseObjectId] = await Promise.all([
      getObjectId('InstallationCost'),
      getObjectId('InstallationTechExpense'),
    ])
    if (!costObjectId) {
      return reply.code(500).send({ error: 'InstallationCost object not found' })
    }

    const existingCosts = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
    if (existingCosts.length <= 1) {
      return reply.code(400).send({ error: 'Cannot remove the only remaining week' })
    }

    // Find the max weekNumber and its record
    let maxWeek = 0
    let maxWeekRecord: any = null
    for (const rec of existingCosts) {
      const d = rec.data as Record<string, any>
      const wn = Number(d.weekNumber ?? 0)
      if (wn > maxWeek) {
        maxWeek = wn
        maxWeekRecord = rec
      }
    }

    // Delete the cost record for the last week
    if (maxWeekRecord) {
      await prisma.record.delete({ where: { id: maxWeekRecord.id } })
    }

    // Delete all tech expense records for that week
    if (techExpenseObjectId) {
      const techExpenses = await findRecordsByObjectAndField(
        techExpenseObjectId,
        'installation',
        installationId,
      )
      for (const exp of techExpenses) {
        const ed = exp.data as Record<string, any>
        if (Number(ed.weekNumber) === maxWeek) {
          await prisma.record.delete({ where: { id: exp.id } })
        }
      }
    }

    // Shorten endDate by 7 days
    const currentEnd = new Date(instData.endDate)
    currentEnd.setDate(currentEnd.getDate() - 7)
    const newEndDate = currentEnd.toISOString().split('T')[0]!

    await prisma.record.update({
      where: { id: installationId },
      data: {
        data: { ...instData, endDate: newEndDate },
        modifiedById: user.sub,
      },
    })

    return { removedWeek: maxWeek, remainingWeeks: existingCosts.length - 1 }
  })

  // ====================================================================
  // 7. GET /:installationId/technicians — List assigned technicians
  // ====================================================================
  app.get('/:installationId/technicians', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }

    const [junctionObjectId, techObjectId] = await Promise.all([
      getObjectId('InstallationTechnician'),
      getObjectId('Technician'),
    ])

    if (!junctionObjectId) {
      return []
    }

    const junctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)

    const result: any[] = []
    for (const junction of junctions) {
      const jData = junction.data as Record<string, any>
      let techName = 'Unknown'
      if (techObjectId && jData.technician) {
        const techRecord = await prisma.record.findUnique({ where: { id: jData.technician } })
        if (techRecord) {
          techName = (techRecord.data as Record<string, any>).technicianName ?? 'Unknown'
        }
      }
      result.push({
        junctionId: junction.id,
        technicianId: jData.technician,
        technicianName: techName,
        assignedHourlyRate: jData.assignedHourlyRate ?? 0,
      })
    }

    return result
  })

  // ====================================================================
  // 8. POST /:installationId/technicians — Assign technician
  // ====================================================================
  app.post('/:installationId/technicians', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const { technicianId } = request.body as { technicianId: string }
    const user = (request as any).user

    if (!technicianId) {
      return reply.code(400).send({ error: 'technicianId is required' })
    }

    // Look up technician record
    const techRecord = await prisma.record.findUnique({ where: { id: technicianId } })
    if (!techRecord) {
      return reply.code(404).send({ error: 'Technician not found' })
    }
    const techData = techRecord.data as Record<string, any>
    const hourlyRate = Number(techData.hourlyRate ?? 0)
    const technicianName = techData.technicianName ?? 'Unknown'

    // Get junction object ID
    const junctionObjectId = await getObjectId('InstallationTechnician')
    if (!junctionObjectId) {
      return reply.code(500).send({ error: 'InstallationTechnician object not found' })
    }

    // Check for duplicate assignment
    const existingJunctions = await findRecordsByObjectAndField(junctionObjectId, 'installation', installationId)
    for (const j of existingJunctions) {
      const jd = j.data as Record<string, any>
      if (jd.technician === technicianId) {
        return reply.code(409).send({ error: 'Technician is already assigned to this installation' })
      }
    }

    // Create junction record with frozen hourly rate
    const junctionId = generateRecordId('InstallationTechnician')
    await prisma.record.create({
      data: {
        id: junctionId,
        objectId: junctionObjectId,
        data: {
          installation: installationId,
          technician: technicianId,
          assignedHourlyRate: hourlyRate,
        },
        createdById: user.sub,
        modifiedById: user.sub,
      },
    })

    // If installation has existing weeks, create tech expense records for each week
    const costObjectId = await getObjectId('InstallationCost')
    const techExpenseObjectId = await getObjectId('InstallationTechExpense')
    if (costObjectId && techExpenseObjectId) {
      const costRecords = await findRecordsByObjectAndField(costObjectId, 'installation', installationId)
      for (const cost of costRecords) {
        const cd = cost.data as Record<string, any>
        await prisma.record.create({
          data: {
            id: generateRecordId('InstallationTechExpense'),
            objectId: techExpenseObjectId,
            data: {
              installation: installationId,
              installationTechnician: junctionId,
              weekNumber: cd.weekNumber,
              weekStartDate: cd.weekStartDate,
              weekEndDate: cd.weekEndDate,
              containerUnload: 0, woodbucks: 0, waterproofing: 0, installationLabor: 0,
              travel: 0, waterTesting: 0, sills: 0, finishCaulking: 0,
              screenLutronShades: 0, punchListWork: 0, finishHardware: 0, finalAdjustments: 0,
              perDiem: 0, mileage: 0, materials: 0,
            },
            createdById: user.sub,
            modifiedById: user.sub,
          },
        })
      }
    }

    return { junctionId, technicianId, technicianName, assignedHourlyRate: hourlyRate }
  })

  // ====================================================================
  // 9. DELETE /:installationId/technicians/:junctionId — Remove technician
  // ====================================================================
  app.delete('/:installationId/technicians/:junctionId', async (request, reply) => {
    const { installationId, junctionId } = request.params as { installationId: string; junctionId: string }

    // Validate junction belongs to this installation
    const junctionRecord = await prisma.record.findUnique({ where: { id: junctionId } })
    if (!junctionRecord) return reply.code(404).send({ error: 'Junction not found' })
    const jData = junctionRecord.data as Record<string, any>
    if (jData.installation !== installationId) {
      return reply.code(400).send({ error: 'Junction does not belong to this installation' })
    }

    // Delete all tech expense records linked to this junction
    const techExpenseObjectId = await getObjectId('InstallationTechExpense')
    if (techExpenseObjectId) {
      const expenses = await findRecordsByObjectAndField(
        techExpenseObjectId,
        'installationTechnician',
        junctionId,
      )
      for (const exp of expenses) {
        await prisma.record.delete({ where: { id: exp.id } })
      }
    }

    // Delete the junction record
    await prisma.record.delete({ where: { id: junctionId } })

    return { deleted: true }
  })

  // ====================================================================
  // 10. PUT /:installationId/estimates — Update estimated costs
  // ====================================================================
  app.put('/:installationId/estimates', async (request, reply) => {
    const { installationId } = request.params as { installationId: string }
    const body = request.body as Record<string, any>
    const user = (request as any).user

    const installation = await prisma.record.findUnique({ where: { id: installationId } })
    if (!installation) {
      return reply.code(404).send({ error: 'Installation not found' })
    }
    const instData = installation.data as Record<string, any>

    const patch: Record<string, any> = {}
    for (const [key, value] of Object.entries(body)) {
      if (!ESTIMATED_FIELDS.includes(key)) continue
      patch[key] = round2(Number(value))
    }

    if (Object.keys(patch).length > 0) {
      await prisma.record.update({
        where: { id: installationId },
        data: {
          data: { ...instData, ...patch },
          modifiedById: user.sub,
        },
      })
    }

    return { updated: true }
  })
}
