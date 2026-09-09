/**
 * Shared PDF generator for the Installation Cost Grid widget's "End of
 * Project Final Report" — used by both the Executive Summary tab's
 * Download button and the top-level Toolbar's Preview PDF button.
 */
import { VARIANCE_CATEGORIES, calculateActual, num, fmt, fmtNum } from './calculations';

export interface InstallationReportParams {
  installationData: Record<string, any>;
  costs: Array<{ id: string; data: Record<string, any> }>;
  techExpenses: Record<string, {
    technician: { id: string; name: string; assignedHourlyRate: number };
    expenses: Array<{ id: string; data: Record<string, any> }>;
  }>;
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'Installation_Report';
}

export async function generateInstallationReportPdf({
  installationData,
  costs,
  techExpenses,
}: InstallationReportParams): Promise<{ blob: Blob; filename: string }> {
  const budget = num(installationData.installationBudget);
  const actualCost = num(installationData.finalCost);
  const profit = num(installationData.finalProfit);
  const isProfitable = profit >= 0;
  const profitPct = budget > 0 ? ((profit / budget) * 100).toFixed(1) : '0.0';

  const startDate = installationData.startDate
    ? new Date(installationData.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const endDate = installationData.endDate
    ? new Date(installationData.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '—';
  const reportDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const breakdownRows = VARIANCE_CATEGORIES.map((cat) => {
    const estimated = num(installationData[cat.estimatedField]);
    const actual = calculateActual(cat, costs, techExpenses);
    const variance = estimated - actual;
    return { ...cat, estimated, actual, variance };
  });

  let totalEstimated = 0;
  let totalActual = 0;
  for (const row of breakdownRows) {
    if (row.type === 'currency') {
      totalEstimated += row.estimated;
      totalActual += row.actual;
    }
  }

  const formatVal = (v: number, type: 'currency' | 'hours') => (type === 'hours' ? `${fmtNum(v)} hrs` : fmt(v));
  const varColor = (v: number) => (v > 0 ? '#27ae60' : v < 0 ? '#c0392b' : '#666');

  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const w = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(44, 62, 80);
  doc.text('TISCHLER UND SOHN', w / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  doc.setTextColor(127, 140, 141);
  doc.text('End of Project Final Report', w / 2, y, { align: 'center' });
  y += 4;
  doc.text(reportDate, w / 2, y, { align: 'center' });
  y += 2;
  doc.setDrawColor(218, 41, 28);
  doc.setLineWidth(0.5);
  doc.line(20, y, w - 20, y);
  y += 8;

  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text('Project Information', 20, y);
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const projectName = installationData.installationName || '—';
  doc.text(`Project: ${projectName}`, 20, y); y += 5;
  doc.text(`Start Date: ${startDate}`, 20, y);
  doc.text(`End Date: ${endDate}`, w / 2, y); y += 8;

  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text('Financial Summary', 20, y); y += 6;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.text('Budget / Sales Price:', 20, y);
  doc.text(fmt(budget), w - 20, y, { align: 'right' }); y += 5;
  doc.text('Actual Cost:', 20, y);
  doc.text(fmt(actualCost), w - 20, y, { align: 'right' }); y += 5;
  const profitR = isProfitable ? 39 : 192;
  const profitG = isProfitable ? 174 : 57;
  const profitB = isProfitable ? 96 : 43;
  doc.setTextColor(profitR, profitG, profitB);
  doc.setFont('helvetica', 'bold');
  doc.text(`${isProfitable ? 'Profit' : 'Loss'}:`, 20, y);
  doc.text(`${isProfitable ? '+' : ''}${fmt(profit)} (${profitPct}%)`, w - 20, y, { align: 'right' });
  y += 10;
  doc.setFont('helvetica', 'normal');

  doc.setFontSize(12);
  doc.setTextColor(44, 62, 80);
  doc.text('Cost Breakdown', 20, y); y += 6;

  doc.setFillColor(44, 62, 80);
  doc.rect(20, y, w - 40, 6, 'F');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('Category', 22, y + 4);
  doc.text('Estimated', 95, y + 4, { align: 'right' });
  doc.text('Actual', 130, y + 4, { align: 'right' });
  doc.text('Variance', w - 22, y + 4, { align: 'right' });
  y += 8;

  doc.setFontSize(8);
  for (const row of breakdownRows) {
    if (y > 270) { doc.addPage(); y = 20; }
    if (row.isSubcategory) {
      doc.setFillColor(244, 247, 251);
      doc.rect(20, y - 3, w - 40, 5, 'F');
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text(`  ↳ ${row.label}`, 22, y);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(row.label, 22, y);
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(formatVal(row.estimated, row.type), 95, y, { align: 'right' });
    doc.text(formatVal(row.actual, row.type), 130, y, { align: 'right' });
    const vc = varColor(row.variance);
    doc.setTextColor(vc === '#27ae60' ? 39 : vc === '#c0392b' ? 192 : 100, vc === '#27ae60' ? 174 : vc === '#c0392b' ? 57 : 100, vc === '#27ae60' ? 96 : vc === '#c0392b' ? 43 : 100);
    doc.text(`${row.variance > 0 ? '+' : ''}${formatVal(row.variance, row.type)}`, w - 22, y, { align: 'right' });
    y += 5;
  }

  y += 1;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, y - 3, w - 20, y - 3);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(44, 62, 80);
  doc.text('Total Cost', 22, y);
  doc.text(fmt(totalEstimated), 95, y, { align: 'right' });
  doc.text(fmt(totalActual), 130, y, { align: 'right' });
  const tv = totalEstimated - totalActual;
  doc.setTextColor(tv >= 0 ? 39 : 192, tv >= 0 ? 174 : 57, tv >= 0 ? 96 : 43);
  doc.text(`${tv > 0 ? '+' : ''}${fmt(tv)}`, w - 22, y, { align: 'right' });

  y = 285;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text('Tischler und Sohn | Confidential', w / 2, y, { align: 'center' });

  return {
    blob: doc.output('blob'),
    filename: `Installation_Report_${safeFilename(projectName)}.pdf`,
  };
}
