'use client'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { LABOR_COLUMNS, TECH_EXPENSE_COLUMNS, totalHours, techWeeklyCost, num, fmt, fmtNum } from '../utils/calculations'

interface TechExpenseCardProps {
  junctionId: string
  technician: { id: string; name: string; assignedHourlyRate: number }
  expenses: Array<{ id: string; data: Record<string, any> }>
  dirtyExpenses: Record<string, Record<string, number>>
  onFieldChange: (recordId: string, field: string, value: number) => void
}

export function TechExpenseCard({ junctionId, technician, expenses, dirtyExpenses, onFieldChange }: TechExpenseCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const getValue = (recordId: string, field: string, data: Record<string, any>): number => {
    return dirtyExpenses[recordId]?.[field] !== undefined ? dirtyExpenses[recordId][field] : num(data[field])
  }

  let techTotalCost = 0
  let techTotalHours = 0
  for (const exp of expenses) {
    const d = exp.data as Record<string, any>
    techTotalCost += techWeeklyCost(d, technician.assignedHourlyRate, dirtyExpenses[exp.id])
    techTotalHours += totalHours(d, dirtyExpenses[exp.id])
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setCollapsed(!collapsed)} className="w-full px-3 py-2 bg-gray-50 flex items-center justify-between text-left hover:bg-gray-100 transition-colors">
        <div className="flex items-center gap-2">
          {collapsed ? <ChevronRight className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          <span className="text-xs font-semibold text-brand-dark">{technician.name}</span>
          <span className="text-[10px] text-gray-500">(${technician.assignedHourlyRate}/hr)</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-gray-500">{fmtNum(techTotalHours)} hrs</span>
          <span className="font-semibold text-brand-navy">{fmt(techTotalCost)}</span>
        </div>
      </button>
      {!collapsed && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[10px] min-w-[800px]">
            <thead>
              <tr className="bg-gray-50/50">
                <th className="px-2 py-1.5 text-left font-semibold border-b border-gray-200 sticky left-0 bg-gray-50 z-10">Wk</th>
                {LABOR_COLUMNS.map(col => (
                  <th key={col.key} className="px-1 py-1.5 text-center font-semibold border-b border-gray-200 whitespace-nowrap" style={{ background: `${col.color}20` }}>{col.short}</th>
                ))}
                {TECH_EXPENSE_COLUMNS.map(col => (
                  <th key={col.key} className="px-1 py-1.5 text-center font-semibold border-b border-gray-200 whitespace-nowrap" style={{ background: `${col.color}20` }}>{col.short}</th>
                ))}
                <th className="px-2 py-1.5 text-center font-bold border-b border-gray-200" style={{ background: 'rgba(200,200,255,0.2)' }}>Hrs</th>
                <th className="px-2 py-1.5 text-center font-bold border-b border-gray-200" style={{ background: 'rgba(200,200,255,0.2)' }}>Cost</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => {
                const d = exp.data as Record<string, any>
                const hours = totalHours(d, dirtyExpenses[exp.id])
                const cost = techWeeklyCost(d, technician.assignedHourlyRate, dirtyExpenses[exp.id])
                return (
                  <tr key={exp.id} className="hover:bg-gray-50/50">
                    <td className="px-2 py-0.5 border-b border-gray-100 font-medium sticky left-0 bg-white z-10">{d.weekNumber}</td>
                    {LABOR_COLUMNS.map(col => (
                      <td key={col.key} className="p-0.5 border-b border-gray-100">
                        <input type="number" step="0.5" value={getValue(exp.id, col.key, d)}
                          onChange={e => onFieldChange(exp.id, col.key, parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded px-1 py-0.5 text-center text-[10px] focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                          style={{ background: `${col.color}08` }} />
                      </td>
                    ))}
                    {TECH_EXPENSE_COLUMNS.map(col => (
                      <td key={col.key} className="p-0.5 border-b border-gray-100">
                        <input type="number" step="0.01" value={getValue(exp.id, col.key, d)}
                          onChange={e => onFieldChange(exp.id, col.key, parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-200 rounded px-1 py-0.5 text-center text-[10px] focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                          style={{ background: `${col.color}08` }} />
                      </td>
                    ))}
                    <td className="px-2 py-0.5 border-b border-gray-100 text-center font-semibold" style={{ background: 'rgba(200,200,255,0.1)' }}>{fmtNum(hours)}</td>
                    <td className="px-2 py-0.5 border-b border-gray-100 text-center font-semibold" style={{ background: 'rgba(200,200,255,0.1)' }}>{fmt(cost)}</td>
                  </tr>
                )
              })}
              <tr style={{ background: '#fef3c7' }}>
                <td className="px-2 py-1.5 font-bold text-amber-800 sticky left-0 z-10" style={{ background: '#fef3c7' }}>TOT</td>
                {LABOR_COLUMNS.map(col => {
                  let colTotal = 0
                  for (const exp of expenses) colTotal += getValue(exp.id, col.key, exp.data)
                  return <td key={col.key} className="px-1 py-1.5 text-center font-bold text-amber-800">{fmtNum(colTotal)}</td>
                })}
                {TECH_EXPENSE_COLUMNS.map(col => {
                  let colTotal = 0
                  for (const exp of expenses) colTotal += getValue(exp.id, col.key, exp.data)
                  return <td key={col.key} className="px-1 py-1.5 text-center font-bold text-amber-800">{fmt(colTotal)}</td>
                })}
                <td className="px-2 py-1.5 text-center font-bold text-amber-800" style={{ background: 'rgba(251,191,36,0.2)' }}>{fmtNum(techTotalHours)}</td>
                <td className="px-2 py-1.5 text-center font-bold text-amber-800" style={{ background: 'rgba(251,191,36,0.2)' }}>{fmt(techTotalCost)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
