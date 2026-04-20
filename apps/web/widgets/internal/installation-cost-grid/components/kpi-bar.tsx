'use client'
import { fmt } from '../utils/calculations'

interface KpiBarProps {
  budget: number
  totalCost: number
  profit: number
}

export function KpiBar({ budget, totalCost, profit }: KpiBarProps) {
  const profitPct = budget > 0 ? ((profit / budget) * 100).toFixed(1) : '0.0'
  const isPositive = profit >= 0

  return (
    <div className="flex items-center gap-0 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="flex-1 text-center py-4 px-5">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Budget</div>
        <div className="text-xl font-bold text-brand-navy">{fmt(budget)}</div>
      </div>
      <div className="w-px bg-gray-200 self-stretch" />
      <div className="flex-1 text-center py-4 px-5">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Total Cost</div>
        <div className="text-xl font-bold text-brand-navy">{fmt(totalCost)}</div>
      </div>
      <div className="w-px bg-gray-200 self-stretch" />
      <div className="flex-1 text-center py-4 px-5">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Profit</div>
        <div className={`text-xl font-bold ${isPositive ? 'text-green-700' : 'text-red-600'}`}>
          {isPositive ? '+' : ''}{fmt(profit)}
        </div>
        <div className={`text-[10px] ${isPositive ? 'text-green-600' : 'text-red-500'}`}>{profitPct}%</div>
      </div>
    </div>
  )
}
