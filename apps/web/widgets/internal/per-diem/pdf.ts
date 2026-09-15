import { openPdfPreview } from '@/lib/pdf-preview'
import type { RecordData } from '@/lib/records-service'

const NAVY = [30, 58, 95] as const
const RED = [218, 41, 28] as const
const TEXT = [31, 41, 55] as const
const MUTED = [107, 114, 128] as const
const LINE = [218, 223, 229] as const
const PAGE_MARGIN = 10
const HEADER_HEIGHT = 12

const COLUMNS = [
  { key: 'serviceTechPerDiem', label: 'Service Tech Per Diem', width: 45 },
  { key: 'perDiemAmount', label: 'Per Diem Amount', width: 32 },
  { key: 'perDiemNotes', label: 'Notes', width: 120 },
  { key: 'perDiemStartDate', label: 'Start Date', width: 28 },
  { key: 'perDiemEndDate', label: 'End Date', width: 28 },
] as const

function formatValue(key: string, raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '-'
  if (key === 'perDiemStartDate' || key === 'perDiemEndDate') {
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[2]}/${match[3]}/${match[1]}`
  }
  if (key === 'perDiemAmount') return `$${Number(raw).toFixed(2)}`
  return String(raw)
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return safe || 'Per_Diem'
}

export async function generatePerDiemPdf({
  rows,
  workOrderName,
  workOrderNumber,
  previewWindow,
}: {
  rows: RecordData[]
  workOrderName: string
  workOrderNumber?: string
  previewWindow: Window | null
}): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - PAGE_MARGIN * 2
  const tableWidth = COLUMNS.reduce((sum, column) => sum + column.width, 0)
  const scale = Math.min(1, contentWidth / tableWidth)
  const scaledColumns = COLUMNS.map((column) => ({ ...column, width: column.width * scale }))
  const title = workOrderNumber
    ? `${workOrderNumber} (${workOrderName || 'Untitled'}) - Per Diem`
    : `${workOrderName || 'Work Order'} - Per Diem`
  const filename = `${safeFilename(title)}.pdf`
  let cursorY = 0

  const drawHeader = () => {
    doc.setTextColor(...NAVY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('TISCHLER', PAGE_MARGIN, 13)
    doc.setDrawColor(...RED)
    doc.setLineWidth(0.7)
    doc.line(PAGE_MARGIN, 16, pageWidth - PAGE_MARGIN, 16)
    doc.setTextColor(...MUTED)
    doc.setFontSize(7)
    doc.text('WORK ORDER', PAGE_MARGIN, 24)
    doc.setTextColor(...TEXT)
    doc.setFontSize(14)
    doc.text(title, PAGE_MARGIN, 31)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`Generated ${new Date().toLocaleString()}`, pageWidth - PAGE_MARGIN, 31, { align: 'right' })
    cursorY = 38
  }

  const drawTableHeader = () => {
    doc.setFillColor(...NAVY)
    doc.rect(PAGE_MARGIN, cursorY, contentWidth, HEADER_HEIGHT, 'F')
    let x = PAGE_MARGIN
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.3)
    for (const column of scaledColumns) {
      doc.text(column.label, x + 1.5, cursorY + 4.5, { maxWidth: column.width - 3 })
      x += column.width
    }
    cursorY += HEADER_HEIGHT
  }

  drawHeader()
  drawTableHeader()

  for (const [rowIndex, row] of rows.entries()) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    const linesByColumn = scaledColumns.map((column) =>
      doc.splitTextToSize(formatValue(column.key, row.data?.[column.key]), column.width - 3) as string[],
    )
    const rowHeight = Math.max(10, ...linesByColumn.map((lines) => lines.length * 3.1 + 4))
    if (cursorY + rowHeight > pageHeight - 14) {
      doc.addPage()
      drawHeader()
      drawTableHeader()
    }

    doc.setFillColor(rowIndex % 2 === 0 ? 255 : 248, rowIndex % 2 === 0 ? 255 : 249, rowIndex % 2 === 0 ? 255 : 251)
    doc.rect(PAGE_MARGIN, cursorY, contentWidth, rowHeight, 'F')
    let x = PAGE_MARGIN
    linesByColumn.forEach((lines, columnIndex) => {
      const column = scaledColumns[columnIndex]!
      doc.setTextColor(...TEXT)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.text(lines, x + 1.5, cursorY + 4.2, { maxWidth: column.width - 3 })
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.15)
      doc.line(x + column.width, cursorY, x + column.width, cursorY + rowHeight)
      x += column.width
    })
    doc.setDrawColor(...LINE)
    doc.line(PAGE_MARGIN, cursorY + rowHeight, pageWidth - PAGE_MARGIN, cursorY + rowHeight)
    cursorY += rowHeight
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.2)
    doc.line(PAGE_MARGIN, pageHeight - 9, pageWidth - PAGE_MARGIN, pageHeight - 9)
    doc.setTextColor(...MUTED)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text('Per Diem Report', PAGE_MARGIN, pageHeight - 5)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 5, { align: 'right' })
  }

  doc.setProperties({ title, subject: 'Per Diem Report', author: 'Tischler und Sohn' })
  await openPdfPreview(previewWindow, doc.output('blob'), filename)
}