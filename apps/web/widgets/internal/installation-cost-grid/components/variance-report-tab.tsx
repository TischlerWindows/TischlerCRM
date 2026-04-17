'use client'
import { Save, Loader2 } from 'lucide-react'
import { VARIANCE_CATEGORIES, calculateActual, num, fmt, fmtNum } from '../utils/calculations'

interface VarianceReportTabProps {
  installationData: Record<string, any>
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
  dirtyEstimates: Record<string, number>
  onEstimateChange: (field: string, value: number) => void
  onSaveEstimates: () => void
  saving: boolean
}

export function VarianceReportTab({
  installationData, costs, techExpenses,
  dirtyEstimates, onEstimateChange, onSaveEstimates, saving,
}: VarianceReportTabProps) {
  const hasDirty = Object.keys(dirtyEstimates).length > 0

  const getEstimated = (field: string): number => {
    return dirtyEstimates[field] !== undefined ? dirtyEstimates[field] : num(installationData[field])
  }

  let totalEstimated = 0
  let totalActual = 0
  const rows = VARIANCE_CATEGORIES.map(cat => {
    const estimated = getEstimated(cat.estimatedField)
    const actual = calculateActual(cat, costs, techExpenses)
    const variance = estimated - actual
    if (cat.type === 'currency') {
      totalEstimated += estimated
      totalActual += actual
    }
    return { ...cat, estimated, actual, variance }
  })
  const totalVariance = totalEstimated - totalActual

  const formatValue = (value: number, type: 'currency' | 'hours'): string => {
    return type === 'hours' ? fmtNum(value) : fmt(value)
  }

  const varianceColor = (v: number): string => {
    if (v > 0) return 'text-green-700'
    if (v < 0) return 'text-red-600'
    return 'text-gray-400'
  }

  return (
    <div className="p-4">
      <div className="flex justify-end mb-3">
        <button
          onClick={onSaveEstimates}
          disabled={!hasDirty && !saving}
          className="text-[10px] px-3 py-1 bg-brand-navy text-white rounded hover:bg-brand-navy/90 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed font-semibold relative"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save Estimates
          {hasDirty && !saving && <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />}
        </button>
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr style={{ background: '#2c3e50', color: 'white' }}>
            <th className="px-3 py-2 text-left font-semibold">Category</th>
            <th className="px-3 py-2 text-right font-semibold">Estimated</th>
            <th className="px-3 py-2 text-right font-semibold">Actual</th>
            <th className="px-3 py-2 text-right font-semibold">Variance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.estimatedField}
              className={row.isSubcategory ? 'italic' : ''}
              style={row.isSubcategory ? { background: '#f4f7fb', borderLeft: '3px solid #a8c0e0' } : {}}
            >
              <td className="px-3 py-1.5 border-b border-gray-200" style={{ fontSize: row.isSubcategory ? '11px' : '12px' }}>
                {row.isSubcategory ? '↳ ' : ''}{row.label}
              </td>
              <td className="px-1 py-1.5 border-b border-gray-200 text-right">
                <input
                  type="number"
                  step={row.type === 'hours' ? '0.5' : '0.01'}
                  value={getEstimated(row.estimatedField)}
                  onChange={e => onEstimateChange(row.estimatedField, parseFloat(e.target.value) || 0)}
                  className="w-24 border border-gray-200 rounded px-2 py-1 text-right text-xs focus:border-brand-navy focus:ring-1 focus:ring-brand-navy/20 outline-none"
                />
              </td>
              <td className="px-3 py-1.5 border-b border-gray-200 text-right">
                {formatValue(row.actual, row.type)}
              </td>
              <td className={`px-3 py-1.5 border-b border-gray-200 text-right font-semibold ${varianceColor(row.variance)}`}>
                {row.variance > 0 ? '+' : ''}{formatValue(row.variance, row.type)}
              </td>
            </tr>
          ))}
          <tr style={{ background: '#f5f5f5' }}>
            <td className="px-3 py-2 font-bold border-t-2 border-gray-300">Total Expenses</td>
            <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalEstimated)}</td>
            <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalActual)}</td>
            <td className={`px-3 py-2 text-right font-bold border-t-2 border-gray-300 ${varianceColor(totalVariance)}`}>
              {totalVariance > 0 ? '+' : ''}{fmt(totalVariance)}
            </td>
          </tr>
        </tbody>
      </table>

      <p className="text-[10px] text-gray-400 mt-3 italic">
        Actuals are calculated from the cost grid and technician data. Estimates are editable above.
      </p>
    </div>
  )
}
