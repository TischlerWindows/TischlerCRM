'use client'
import { Download, Printer } from 'lucide-react'
import { VARIANCE_CATEGORIES, calculateActual, num, fmt, fmtNum } from '../utils/calculations'

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
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const w = doc.internal.pageSize.getWidth()
    let y = 20

    // Header
    doc.setFontSize(18)
    doc.setTextColor(44, 62, 80)
    doc.text('TISCHLER UND SOHN', w / 2, y, { align: 'center' })
    y += 6
    doc.setFontSize(10)
    doc.setTextColor(127, 140, 141)
    doc.text('End of Project Final Report', w / 2, y, { align: 'center' })
    y += 4
    doc.text(reportDate, w / 2, y, { align: 'center' })
    y += 2
    doc.setDrawColor(218, 41, 28)
    doc.setLineWidth(0.5)
    doc.line(20, y, w - 20, y)
    y += 8

    // Project Info
    doc.setFontSize(12)
    doc.setTextColor(44, 62, 80)
    doc.text('Project Information', 20, y)
    y += 6
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    const projectName = installationData.installationName || '—'
    doc.text(`Project: ${projectName}`, 20, y); y += 5
    doc.text(`Start Date: ${startDate}`, 20, y)
    doc.text(`End Date: ${endDate}`, w / 2, y); y += 8

    // Financial Summary
    doc.setFontSize(12)
    doc.setTextColor(44, 62, 80)
    doc.text('Financial Summary', 20, y); y += 6
    doc.setFontSize(9)
    doc.setTextColor(80, 80, 80)
    doc.text('Budget / Sales Price:', 20, y)
    doc.text(fmt(budget), w - 20, y, { align: 'right' }); y += 5
    doc.text('Actual Cost:', 20, y)
    doc.text(fmt(actualCost), w - 20, y, { align: 'right' }); y += 5
    const profitR = isProfitable ? 39 : 192
    const profitG = isProfitable ? 174 : 57
    const profitB = isProfitable ? 96 : 43
    doc.setTextColor(profitR, profitG, profitB)
    doc.setFont('helvetica', 'bold')
    doc.text(`${isProfitable ? 'Profit' : 'Loss'}:`, 20, y)
    doc.text(`${isProfitable ? '+' : ''}${fmt(profit)} (${profitPct}%)`, w - 20, y, { align: 'right' })
    y += 10
    doc.setFont('helvetica', 'normal')

    // Cost Breakdown
    doc.setFontSize(12)
    doc.setTextColor(44, 62, 80)
    doc.text('Cost Breakdown', 20, y); y += 6

    doc.setFillColor(44, 62, 80)
    doc.rect(20, y, w - 40, 6, 'F')
    doc.setFontSize(8)
    doc.setTextColor(255, 255, 255)
    doc.text('Category', 22, y + 4)
    doc.text('Estimated', 95, y + 4, { align: 'right' })
    doc.text('Actual', 130, y + 4, { align: 'right' })
    doc.text('Variance', w - 22, y + 4, { align: 'right' })
    y += 8

    doc.setFontSize(8)
    for (const row of breakdownRows) {
      if (y > 270) { doc.addPage(); y = 20 }
      if (row.isSubcategory) {
        doc.setFillColor(244, 247, 251)
        doc.rect(20, y - 3, w - 40, 5, 'F')
        doc.setFont('helvetica', 'italic')
        doc.setTextColor(80, 80, 80)
        doc.text(`  ↳ ${row.label}`, 22, y)
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(50, 50, 50)
        doc.text(row.label, 22, y)
      }
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      doc.text(formatVal(row.estimated, row.type), 95, y, { align: 'right' })
      doc.text(formatVal(row.actual, row.type), 130, y, { align: 'right' })
      const vc = varColor(row.variance)
      doc.setTextColor(vc === '#27ae60' ? 39 : vc === '#c0392b' ? 192 : 100, vc === '#27ae60' ? 174 : vc === '#c0392b' ? 57 : 100, vc === '#27ae60' ? 96 : vc === '#c0392b' ? 43 : 100)
      doc.text(`${row.variance > 0 ? '+' : ''}${formatVal(row.variance, row.type)}`, w - 22, y, { align: 'right' })
      y += 5
    }

    y += 1
    doc.setDrawColor(200, 200, 200)
    doc.line(20, y - 3, w - 20, y - 3)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(44, 62, 80)
    doc.text('Total Cost', 22, y)
    doc.text(fmt(totalEstimated), 95, y, { align: 'right' })
    doc.text(fmt(totalActual), 130, y, { align: 'right' })
    const tv = totalEstimated - totalActual
    doc.setTextColor(tv >= 0 ? 39 : 192, tv >= 0 ? 174 : 57, tv >= 0 ? 96 : 43)
    doc.text(`${tv > 0 ? '+' : ''}${fmt(tv)}`, w - 22, y, { align: 'right' })

    y = 285
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(180, 180, 180)
    doc.text('Tischler und Sohn | Confidential', w / 2, y, { align: 'center' })

    doc.save(`Installation_Report_${projectName.replace(/\s+/g, '_')}.pdf`)
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
