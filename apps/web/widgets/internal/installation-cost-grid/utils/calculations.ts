// Field lists matching the controller's allow-lists
export const COST_FIELDS = [
  'flightsActual', 'lodgingActual', 'carRental', 'airportTransportation',
  'parking', 'equipment', 'miscellaneousExpenses', 'waterproofing', 'woodBucks',
] as const

export const LABOR_HOUR_FIELDS = [
  'containerUnload', 'woodbucks', 'waterproofing', 'installationLabor',
  'travel', 'waterTesting', 'sills', 'finishCaulking', 'screenLutronShades',
  'punchListWork', 'finishHardware', 'finalAdjustments',
] as const

export const EXPENSE_FIELDS = ['perDiem', 'mileage', 'materials'] as const

export const COST_COLUMNS = [
  { key: 'flightsActual', label: 'Flights', short: 'Flights' },
  { key: 'lodgingActual', label: 'Lodging', short: 'Lodging' },
  { key: 'airportTransportation', label: 'Airport', short: 'Airport' },
  { key: 'carRental', label: 'Car Rental', short: 'Car' },
  { key: 'parking', label: 'Parking', short: 'Parking' },
  { key: 'equipment', label: 'Equipment', short: 'Equip' },
  { key: 'miscellaneousExpenses', label: 'Miscellaneous', short: 'Misc' },
  { key: 'waterproofing', label: 'Waterproofing', short: 'WP' },
  { key: 'woodBucks', label: 'Wood Bucks', short: 'WB' },
] as const

export const LABOR_COLUMNS = [
  { key: 'woodbucks', label: 'Woodbucks', short: 'WB', color: '#b3d9ff' },
  { key: 'waterproofing', label: 'Waterproofing', short: 'WP', color: '#b3ffb3' },
  { key: 'installationLabor', label: 'Installation Labor', short: 'Labor', color: '#ffe6b3' },
  { key: 'travel', label: 'Travel', short: 'Travel', color: '#ffe6b3' },
  { key: 'waterTesting', label: 'Water Testing', short: 'WTest', color: '#ffe6b3' },
  { key: 'sills', label: 'Sills', short: 'Sills', color: '#ffe6b3' },
  { key: 'finishCaulking', label: 'Finish Caulking', short: 'Caulk', color: '#ffe6b3' },
  { key: 'screenLutronShades', label: 'Screen/Lutron', short: 'Screen', color: '#ffe6b3' },
  { key: 'punchListWork', label: 'Punch List', short: 'Punch', color: '#ffe6b3' },
  { key: 'finishHardware', label: 'Finish Hardware', short: 'HW', color: '#ffe6b3' },
  { key: 'finalAdjustments', label: 'Final Adjustments', short: 'Adj', color: '#ffe6b3' },
  { key: 'containerUnload', label: 'Container Unload', short: 'Unload', color: '#ffe6b3' },
] as const

export const TECH_EXPENSE_COLUMNS = [
  { key: 'perDiem', label: 'Per Diem', short: 'P/D', color: '#ffb366' },
  { key: 'mileage', label: 'Mileage', short: 'Mile', color: '#ffb366' },
  { key: 'materials', label: 'Materials', short: 'Mat', color: '#ffb366' },
] as const

export function num(v: unknown): number {
  if (typeof v === 'number') return v
  const n = parseFloat(String(v))
  return isNaN(n) ? 0 : n
}

export function fmt(v: number): string {
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export function fmtNum(v: number): string {
  return v % 1 === 0 ? String(v) : v.toFixed(2)
}

export function sumFields(data: Record<string, any>, fields: readonly string[], dirty?: Record<string, number>): number {
  let total = 0
  for (const f of fields) {
    total += dirty?.[f] !== undefined ? dirty[f] : num(data[f])
  }
  return total
}

export function totalHours(data: Record<string, any>, dirty?: Record<string, number>): number {
  return sumFields(data, LABOR_HOUR_FIELDS, dirty)
}

export function techWeeklyCost(data: Record<string, any>, hourlyRate: number, dirty?: Record<string, number>): number {
  const hours = totalHours(data, dirty)
  const expenses = sumFields(data, EXPENSE_FIELDS, dirty)
  return (hours * hourlyRate) + expenses
}

export function costWeeklyTotal(data: Record<string, any>, dirty?: Record<string, number>): number {
  return sumFields(data, COST_FIELDS, dirty)
}

// ── Variance Report categories (18 rows matching Salesforce) ──────────

export interface VarianceCategory {
  label: string
  estimatedField: string
  type: 'currency' | 'hours'
  isSubcategory?: boolean
  laborField?: string
  costField?: string
  expenseField?: string
}

export const VARIANCE_CATEGORIES: VarianceCategory[] = [
  { label: 'Labor Hours', estimatedField: 'estimatedLaborHours', type: 'hours' },
  { label: 'Technician Labor Cost', estimatedField: 'estimatedLaborCost', type: 'currency' },
  { label: 'Waterproofing Labor Cost', estimatedField: 'estimatedWaterproofingLabor', type: 'currency', isSubcategory: true, laborField: 'waterproofing' },
  { label: 'Woodbucks Labor Cost', estimatedField: 'estimatedWoodBucksLabor', type: 'currency', isSubcategory: true, laborField: 'woodbucks' },
  { label: 'Travel Time', estimatedField: 'estimatedTravelTime', type: 'currency', laborField: 'travel' },
  { label: 'Flights', estimatedField: 'estimatedFlights', type: 'currency', costField: 'flightsActual' },
  { label: 'Lodging', estimatedField: 'estimatedHotel', type: 'currency', costField: 'lodgingActual' },
  { label: 'Airport Transportation', estimatedField: 'estimatedAirportTransportation', type: 'currency', costField: 'airportTransportation' },
  { label: 'Car Rental', estimatedField: 'estimatedCarRental', type: 'currency', costField: 'carRental' },
  { label: 'Parking', estimatedField: 'estimatedParking', type: 'currency', costField: 'parking' },
  { label: 'Equipment', estimatedField: 'estimatedEquipment', type: 'currency', costField: 'equipment' },
  { label: 'Miscellaneous', estimatedField: 'estimatedMiscellaneous', type: 'currency', costField: 'miscellaneousExpenses' },
  { label: 'Waterproofing', estimatedField: 'estimatedWaterproofing', type: 'currency', costField: 'waterproofing' },
  { label: 'Woodbucks', estimatedField: 'estimatedWoodBucks', type: 'currency', costField: 'woodBucks' },
  { label: 'Per Diem', estimatedField: 'estimatedPerDiem', type: 'currency', expenseField: 'perDiem' },
  { label: 'Mileage', estimatedField: 'estimatedMileage', type: 'currency', expenseField: 'mileage' },
  { label: 'Materials', estimatedField: 'estimatedMaterials', type: 'currency', expenseField: 'materials' },
  { label: 'Internal TUS Labor', estimatedField: 'estimatedInternalLabor', type: 'currency' },
]

export function calculateActual(
  category: VarianceCategory,
  costs: Array<{ id: string; data: Record<string, any> }>,
  techExpenses: Record<string, { technician: { assignedHourlyRate: number }; expenses: Array<{ id: string; data: Record<string, any> }> }>,
): number {
  if (category.costField) {
    let total = 0
    for (const cost of costs) total += num(cost.data[category.costField])
    return total
  }
  if (category.expenseField) {
    let total = 0
    for (const { expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) total += num(exp.data[category.expenseField!])
    }
    return total
  }
  if (category.laborField) {
    let total = 0
    for (const { technician, expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) {
        total += num(exp.data[category.laborField!]) * technician.assignedHourlyRate
      }
    }
    return total
  }
  if (category.label === 'Labor Hours') {
    let total = 0
    for (const { expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) total += totalHours(exp.data)
    }
    return total
  }
  if (category.label === 'Technician Labor Cost') {
    let total = 0
    for (const { technician, expenses } of Object.values(techExpenses)) {
      for (const exp of expenses) {
        total += totalHours(exp.data) * technician.assignedHourlyRate
      }
    }
    return total
  }
  return 0
}
