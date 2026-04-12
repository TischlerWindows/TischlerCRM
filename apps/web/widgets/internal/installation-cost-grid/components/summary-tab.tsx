'use client'
import { COST_COLUMNS, LABOR_HOUR_FIELDS, EXPENSE_FIELDS, num, fmt } from '../utils/calculations'

interface SummaryTabProps {
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  dirtyCosts: Record<string, Record<string, number>>
  dirtyExpenses: Record<string, Record<string, number>>
}

export function SummaryTab({ costs, techExpenses, dirtyCosts, dirtyExpenses }: SummaryTabProps) {
  const getVal = (recordId: string, field: string, data: Record<string, any>, dirtyMap: Record<string, Record<string, number>>): number => {
    return dirtyMap[recordId]?.[field] !== undefined ? dirtyMap[recordId][field] : num(data[field])
  }

  const projectTotals: Record<string, number> = {}
  for (const col of COST_COLUMNS) projectTotals[col.key] = 0
  for (const cost of costs) {
    for (const col of COST_COLUMNS) projectTotals[col.key] += getVal(cost.id, col.key, cost.data, dirtyCosts)
  }
  const projectSubtotal = Object.values(projectTotals).reduce((a, b) => a + b, 0)

  let techLaborTotal = 0, techPerDiemTotal = 0, techMileageTotal = 0, techMaterialsTotal = 0
  for (const { technician, expenses } of Object.values(techExpenses)) {
    for (const exp of expenses) {
      const d = exp.data as Record<string, any>
      let hours = 0
      for (const f of LABOR_HOUR_FIELDS) hours += getVal(exp.id, f, d, dirtyExpenses)
      techLaborTotal += hours * technician.assignedHourlyRate
      techPerDiemTotal += getVal(exp.id, 'perDiem', d, dirtyExpenses)
      techMileageTotal += getVal(exp.id, 'mileage', d, dirtyExpenses)
      techMaterialsTotal += getVal(exp.id, 'materials', d, dirtyExpenses)
    }
  }
  const techSubtotal = techLaborTotal + techPerDiemTotal + techMileageTotal + techMaterialsTotal

  const rows: Array<{ label: string; value: number; bold?: boolean; separator?: boolean }> = [
    ...COST_COLUMNS.map(col => ({ label: col.label, value: projectTotals[col.key] })),
    { label: 'Subtotal: Project Costs', value: projectSubtotal, bold: true },
    { label: '', value: 0, separator: true },
    { label: 'Technician Labor', value: techLaborTotal },
    { label: 'Per Diem', value: techPerDiemTotal },
    { label: 'Mileage', value: techMileageTotal },
    { label: 'Materials (Tech)', value: techMaterialsTotal },
    { label: 'Subtotal: Technician Costs', value: techSubtotal, bold: true },
    { label: '', value: 0, separator: true },
    { label: 'Grand Total', value: projectSubtotal + techSubtotal, bold: true },
  ]

  return (
    <div className="p-4">
      <table className="w-full max-w-lg border-collapse text-xs">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">Category</th>
            <th className="px-3 py-2 text-right font-semibold border-b border-gray-200">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            if (row.separator) return <tr key={i}><td colSpan={2} className="py-1" /></tr>
            return (
              <tr key={i} className={row.bold ? 'bg-gray-50' : ''}>
                <td className={`px-3 py-1.5 border-b border-gray-100 ${row.bold ? 'font-bold text-brand-dark' : 'text-gray-600'}`}>{row.label}</td>
                <td className={`px-3 py-1.5 border-b border-gray-100 text-right ${row.bold ? 'font-bold text-brand-dark' : ''}`}>{fmt(row.value)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
