'use client'
import { Download, Printer } from 'lucide-react'
import { VARIANCE_CATEGORIES, calculateActual, num, fmt, fmtNum } from '../utils/calculations'
import { generateInstallationReportPdf } from '../utils/pdf'

interface ExecutiveSummaryTabProps {
  installationData: Record<string, any>
  costs: Array<{ id: string; data: Record<string, any> }>
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number }
    expenses: Array<{ id: string; data: Record<string, any> }>
  }>
}

export function ExecutiveSummaryTab({ installationData, costs, techExpenses }: ExecutiveSummaryTabProps) {
  const budget = num(installationData.installationBudget)
  const actualCost = num(installationData.finalCost)
  const profit = num(installationData.finalProfit)
  const isProfitable = profit >= 0
  const profitPct = budget > 0 ? ((profit / budget) * 100).toFixed(1) : '0.0'

  const startDate = installationData.startDate
    ? new Date(installationData.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'
  const endDate = installationData.endDate
    ? new Date(installationData.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—'
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const breakdownRows = VARIANCE_CATEGORIES.map(cat => {
    const estimated = num(installationData[cat.estimatedField])
    const actual = calculateActual(cat, costs, techExpenses)
    const variance = estimated - actual
    return { ...cat, estimated, actual, variance }
  })

  let totalEstimated = 0
  let totalActual = 0
  for (const row of breakdownRows) {
    if (row.type === 'currency') {
      totalEstimated += row.estimated
      totalActual += row.actual
    }
  }

  const formatVal = (v: number, type: 'currency' | 'hours') => type === 'hours' ? `${fmtNum(v)} hrs` : fmt(v)
  const varColor = (v: number) => v > 0 ? '#27ae60' : v < 0 ? '#c0392b' : '#666'

  const handlePrint = () => window.print()

  const handleDownloadPdf = async () => {
    const { blob, filename } = await generateInstallationReportPdf({ installationData, costs, techExpenses })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="p-6" style={{ fontFamily: "'Segoe UI', Arial, sans-serif", maxWidth: 800, margin: '0 auto' }}>
      {/* Action buttons */}
      <div className="flex justify-end gap-2 mb-4 print:hidden">
        <button onClick={handleDownloadPdf} className="text-xs px-3 py-1.5 bg-brand-navy text-white rounded hover:bg-brand-navy/90 flex items-center gap-1.5">
          <Download className="w-3.5 h-3.5" /> Download PDF
        </button>
        <button onClick={handlePrint} className="text-xs px-3 py-1.5 bg-[#f0f1f9] text-brand-navy border border-blue-200 rounded hover:bg-blue-50 flex items-center gap-1.5">
          <Printer className="w-3.5 h-3.5" /> Print
        </button>
      </div>

      {/* Report Header */}
      <div className="text-center mb-4" style={{ borderBottom: '2px solid #DA291C', paddingBottom: 12 }}>
        <h2 className="text-lg font-bold tracking-wider" style={{ color: '#2c3e50' }}>TISCHLER UND SOHN</h2>
        <p className="text-xs" style={{ color: '#7f8c8d' }}>End of Project Final Report</p>
        <p className="text-[10px]" style={{ color: '#7f8c8d' }}>{reportDate}</p>
      </div>

      {/* Project Information */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2" style={{ color: '#2c3e50' }}>Project Information</h3>
        <table className="w-full text-xs border border-gray-200">
          <tbody>
            <tr><td className="px-3 py-1.5 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d', width: '30%' }}>Project</td><td className="px-3 py-1.5 border-b border-gray-200">{installationData.installationName || '—'}</td></tr>
            <tr><td className="px-3 py-1.5 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d' }}>Start Date</td><td className="px-3 py-1.5 border-b border-gray-200">{startDate}</td></tr>
            <tr><td className="px-3 py-1.5 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d' }}>End Date</td><td className="px-3 py-1.5 border-b border-gray-200">{endDate}</td></tr>
          </tbody>
        </table>
      </div>

      {/* Financial Summary */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2" style={{ color: '#2c3e50' }}>Financial Summary</h3>
        <table className="w-full text-xs border border-gray-200">
          <tbody>
            <tr><td className="px-3 py-2 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d', width: '50%' }}>Budget / Sales Price</td><td className="px-3 py-2 border-b border-gray-200 text-right font-semibold">{fmt(budget)}</td></tr>
            <tr><td className="px-3 py-2 border-b border-gray-200 font-medium" style={{ color: '#7f8c8d' }}>Actual Cost</td><td className="px-3 py-2 border-b border-gray-200 text-right font-semibold">{fmt(actualCost)}</td></tr>
            <tr style={{ background: isProfitable ? '#e8f5e9' : '#ffebee' }}>
              <td className="px-3 py-2 font-bold" style={{ color: isProfitable ? '#27ae60' : '#c0392b' }}>{isProfitable ? 'Profit' : 'Loss'}</td>
              <td className="px-3 py-2 text-right font-bold" style={{ color: isProfitable ? '#27ae60' : '#c0392b' }}>{isProfitable ? '+' : ''}{fmt(profit)} ({profitPct}%)</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Cost Breakdown */}
      <div className="mb-4">
        <h3 className="text-sm font-bold mb-2" style={{ color: '#2c3e50' }}>Cost Breakdown</h3>
        <table className="w-full text-xs border border-gray-200 border-collapse">
          <thead>
            <tr style={{ background: '#2c3e50', color: 'white' }}>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Estimated</th>
              <th className="px-3 py-2 text-right font-semibold">Actual</th>
              <th className="px-3 py-2 text-right font-semibold">Variance</th>
            </tr>
          </thead>
          <tbody>
            {breakdownRows.map((row) => (
              <tr key={row.estimatedField} style={row.isSubcategory ? { background: '#f4f7fb', borderLeft: '3px solid #a8c0e0', fontStyle: 'italic' } : {}}>
                <td className="px-3 py-1.5 border-b border-gray-200" style={{ fontSize: row.isSubcategory ? 11 : 12 }}>{row.isSubcategory ? '↳ ' : ''}{row.label}</td>
                <td className="px-3 py-1.5 border-b border-gray-200 text-right">{formatVal(row.estimated, row.type)}</td>
                <td className="px-3 py-1.5 border-b border-gray-200 text-right">{formatVal(row.actual, row.type)}</td>
                <td className="px-3 py-1.5 border-b border-gray-200 text-right font-semibold" style={{ color: varColor(row.variance) }}>{row.variance > 0 ? '+' : ''}{formatVal(row.variance, row.type)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f5f5f5' }}>
              <td className="px-3 py-2 font-bold border-t-2 border-gray-300">Total Cost</td>
              <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalEstimated)}</td>
              <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300">{fmt(totalActual)}</td>
              <td className="px-3 py-2 text-right font-bold border-t-2 border-gray-300" style={{ color: varColor(totalEstimated - totalActual) }}>{(totalEstimated - totalActual) > 0 ? '+' : ''}{fmt(totalEstimated - totalActual)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div className="text-center text-[10px] pt-3 border-t border-gray-200" style={{ color: '#b0b0b0' }}>
        Tischler und Sohn | Confidential
      </div>
    </div>
  )
}
