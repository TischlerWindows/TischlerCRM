import { prisma } from '@crm/db/client'
import { generateRecordId, registerRecordIdPrefix } from '@crm/db/record-id'
import type { TriggerHandler, TriggerContext } from '../../lib/triggers/types.js'

// Reference Sunday for week boundary calculation (March 17, 2024)
const REFERENCE_SUNDAY = new Date('2024-03-17T00:00:00Z')
const MS_PER_DAY = 86400000

/**
 * Calculate week boundaries for an installation date range.
 * Uses Sunday-based boundaries aligned to a fixed reference date.
 */
function calculateWeeks(startDate: Date, endDate: Date): Array<{ weekNumber: number; start: Date; end: Date }> {
  const weeks: Array<{ weekNumber: number; start: Date; end: Date }> = []

  // Find the first Sunday on or after startDate
  const daysSinceRef = Math.floor((startDate.getTime() - REFERENCE_SUNDAY.getTime()) / MS_PER_DAY)
  const daysUntilSunday = (7 - (daysSinceRef % 7)) % 7
  const firstSunday = new Date(startDate.getTime() + daysUntilSunday * MS_PER_DAY)

  let weekNum = 1

  if (firstSunday.getTime() > startDate.getTime() && firstSunday.getTime() <= endDate.getTime()) {
    // Partial first week: startDate → day before firstSunday
    weeks.push({
      weekNumber: weekNum++,
      start: new Date(startDate),
      end: new Date(firstSunday.getTime() - MS_PER_DAY),
    })
  }

  // Full weeks + final partial
  let current = firstSunday.getTime() <= startDate.getTime()
    ? new Date(startDate)
    : firstSunday

  while (current.getTime() <= endDate.getTime()) {
    const weekEnd = new Date(current.getTime() + 6 * MS_PER_DAY)
    weeks.push({
      weekNumber: weekNum++,
      start: new Date(current),
      end: weekEnd > endDate ? new Date(endDate) : weekEnd,
    })
    current = new Date(current.getTime() + 7 * MS_PER_DAY)
  }

  return weeks
}

async function getObjectId(apiName: string): Promise<string | null> {
  const obj = await prisma.customObject.findFirst({
    where: { apiName: { equals: apiName, mode: 'insensitive' } },
    select: { id: true },
  })
  return obj?.id ?? null
}

async function findRecordsByObjectAndField(
  objectId: string, fieldName: string, fieldValue: string
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

export const handler: TriggerHandler = async (ctx: TriggerContext) => {
  const { recordId, recordData, userId, orgId } = ctx

  // Guard: must have valid dates
  const startDateStr = recordData.startDate
  const endDateStr = recordData.endDate
  if (!startDateStr || !endDateStr) return null

  const startDate = new Date(startDateStr)
  const endDate = new Date(endDateStr)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null
  if (startDate >= endDate) return null

  // Look up object IDs
  const [costObjectId, techExpenseObjectId, junctionObjectId] = await Promise.all([
    getObjectId('InstallationCost'),
    getObjectId('InstallationTechExpense'),
    getObjectId('InstallationTechnician'),
  ])
  if (!costObjectId || !techExpenseObjectId || !junctionObjectId) {
    console.error('[create-installation-costs] Missing required objects')
    return null
  }

  // Register prefixes for custom objects so generateRecordId doesn't throw
  registerRecordIdPrefix('InstallationCost')
  registerRecordIdPrefix('InstallationTechExpense')

  // Query existing cost records for dedup
  const existingCosts = await findRecordsByObjectAndField(costObjectId, 'installation', recordId)
  const existingCostWeeks = new Set(
    existingCosts.map((r: any) => (r.data as Record<string, any>).weekNumber)
  )

  // Query existing tech expense records for dedup
  const existingExpenses = await findRecordsByObjectAndField(techExpenseObjectId, 'installation', recordId)
  const existingExpenseKeys = new Set(
    existingExpenses.map((r: any) => {
      const d = r.data as Record<string, any>
      return `${d.installationTechnician}_${d.weekNumber}`
    })
  )

  // Query assigned technicians (junction records)
  const junctionRecords = await findRecordsByObjectAndField(junctionObjectId, 'installation', recordId)

  // Calculate weeks
  const weeks = calculateWeeks(startDate, endDate)
  if (weeks.length === 0) return null

  // Create missing InstallationCost records
  const costRecordsToCreate: any[] = []
  for (const week of weeks) {
    if (existingCostWeeks.has(week.weekNumber)) continue
    costRecordsToCreate.push({
      id: generateRecordId('InstallationCost'),
      objectId: costObjectId,
      data: {
        installation: recordId,
        weekNumber: week.weekNumber,
        weekStartDate: week.start.toISOString().split('T')[0],
        weekEndDate: week.end.toISOString().split('T')[0],
        flightsActual: 0, lodgingActual: 0, carRental: 0, airportTransportation: 0,
        parking: 0, equipment: 0, miscellaneousExpenses: 0, waterproofing: 0, woodBucks: 0,
      },
      createdById: userId,
      modifiedById: userId,
    })
  }

  // Create missing InstallationTechExpense records
  const expenseRecordsToCreate: any[] = []
  for (const junction of junctionRecords) {
    for (const week of weeks) {
      const key = `${junction.id}_${week.weekNumber}`
      if (existingExpenseKeys.has(key)) continue
      expenseRecordsToCreate.push({
        id: generateRecordId('InstallationTechExpense'),
        objectId: techExpenseObjectId,
        data: {
          installation: recordId,
          installationTechnician: junction.id,
          weekNumber: week.weekNumber,
          weekStartDate: week.start.toISOString().split('T')[0],
          weekEndDate: week.end.toISOString().split('T')[0],
          containerUnload: 0, woodbucks: 0, waterproofing: 0, installationLabor: 0,
          travel: 0, waterTesting: 0, sills: 0, finishCaulking: 0,
          screenLutronShades: 0, punchListWork: 0, finishHardware: 0, finalAdjustments: 0,
          perDiem: 0, mileage: 0, materials: 0,
        },
        createdById: userId,
        modifiedById: userId,
      })
    }
  }

  // Bulk create
  if (costRecordsToCreate.length > 0) {
    await prisma.record.createMany({ data: costRecordsToCreate })
    console.log(`[create-installation-costs] Created ${costRecordsToCreate.length} cost records`)
  }
  if (expenseRecordsToCreate.length > 0) {
    await prisma.record.createMany({ data: expenseRecordsToCreate })
    console.log(`[create-installation-costs] Created ${expenseRecordsToCreate.length} tech expense records`)
  }

  return null // Side effects only, no field updates
}
