'use client'
import { COST_COLUMNS, costWeeklyTotal, num, fmt } from '../utils/calculations'
import { useGridNavigation } from '../hooks/use-grid-navigation'

interface ProjectCostsTabProps {
  costs: Array<{ id: string; data: Record<string, any> }>
  dirtyCosts: Record<string, Record<string, number>>
  onFieldChange: (recordId: string, field: string, value: number) => void
}

export function ProjectCostsTab({ costs, dirtyCosts, onFieldChange }: ProjectCostsTabProps) {
  const { containerRef, getCellProps } = useGridNavigation()

  const getValue = (recordId: string, field: string, data: Record<string, any>): number => {
    return dirtyCosts[recordId]?.[field] !== undefined ? dirtyCosts[recordId][field] : num(data[field])
  }

  const columnTotals: Record<string, number> = {}
  let grandTotal = 0
  for (const col of COST_COLUMNS) columnTotals[col.key] = 0
  for (const cost of costs) {
    const d = cost.data as Record<string, any>
    for (const col of COST_COLUMNS) columnTotals[col.key] += getValue(cost.id, col.key, d)
    grandTotal += costWeeklyTotal(d, dirtyCosts[cost.id])
  }

  return (
    <div className="overflow-x-auto" ref={containerRef}>
      <table className="w-full border-collapse text-xs min-w-[700px]">
        <thead>
          <tr className="bg-gray-50">
            <th className="px-2 py-2 text-left font-semibold border-b border-gray-200 sticky left-0 bg-gray-50 z-10">Week</th>
            {COST_COLUMNS.map(col => (
              <th key={col.key} className="px-2 py-2 text-right font-semibold border-b border-gray-200 whitespace-nowrap">{col.short}</th>
            ))}
            <th className="px-2 py-2 text-right font-bold border-b border-gray-200 whitespace-nowrap" style={{ background: 'rgba(200,200,255,0.2)', borderLeft: '3px solid #8b9cf7' }}>Weekly Total</th>
          </tr>
        </thead>
        <tbody>
          {costs.map((cost, rowIndex) => {
            const d = cost.data as Record<string, any>
            const weekTotal = costWeeklyTotal(d, dirtyCosts[cost.id])
            return (
              <tr key={cost.id} className="hover:bg-gray-50/50">
                <td className="px-2 py-1 border-b border-gray-100 font-medium sticky left-0 bg-white z-10">Wk {d.weekNumber}</td>
                {COST_COLUMNS.map((col, colIndex) => (
                  <td key={col.key} className="p-0.5 border-b border-gray-100">
                    <input type="number" step="0.01" value={getValue(cost.id, col.key, d) || ''}
                      onChange={e => onFieldChange(cost.id, col.key, parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      {...getCellProps(rowIndex, colIndex)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-right text-xs focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none" />
                  </td>
                ))}
                <td className="px-2 py-1 border-b border-gray-100 text-right font-semibold" style={{ background: 'rgba(200,200,255,0.1)', borderLeft: '3px solid #8b9cf7' }}>{fmt(weekTotal)}</td>
              </tr>
            )
          })}
          <tr style={{ background: '#fef3c7' }}>
            <td className="px-2 py-2 font-bold text-amber-800 sticky left-0 z-10" style={{ background: '#fef3c7' }}>TOTAL</td>
            {COST_COLUMNS.map(col => (
              <td key={col.key} className="px-2 py-2 text-right font-bold text-amber-800">{fmt(columnTotals[col.key])}</td>
            ))}
            <td className="px-2 py-2 text-right font-extrabold text-amber-800" style={{ background: 'rgba(251,191,36,0.2)', borderLeft: '3px solid #f59e0b' }}>{fmt(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
