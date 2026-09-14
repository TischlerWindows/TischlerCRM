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
  { key: 'itemNumber', label: '#', width: 10 },
  { key: 'techName', label: 'Tech\nName', width: 22 },
  { key: 'location', label: 'Location', width: 23 },
  { key: 'unit', label: 'Unit', width: 16 },
  { key: 'elevationPageNumber', label: 'EP#', width: 13 },
  { key: 'descriptionOfWork', label: 'Description', width: 68 },
  { key: 'specialEquipmentNeeded', label: 'Special Equipment', width: 36 },
  { key: 'materialInWH', label: 'Material in\nWH', width: 22 },
  { key: 'materialToOrder', label: 'Material to\nOrder', width: 25 },
  { key: 'estimateOfIndividualHours', label: 'Hours', width: 14 },
  { key: 'estimateOfMen', label: 'Men', width: 13 },
  { key: 'totalEstimateOfHours', label: 'Total', width: 14 },
] as const

function formatValue(key: string, raw: unknown): string {
  if (key === 'clientApproved') return raw ? 'Yes' : 'No'
  if (key === 'serviceDate' && raw) {
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[2]}/${match[3]}/${match[1]}`
  }
  if (raw === undefined || raw === null || raw === '') return '-'
  return String(raw)
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
  return safe || 'Punch_List'
}

export async function generatePunchListPdf({
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
  let cursorY = 0

  const title = workOrderNumber
    ? `${workOrderNumber} (${workOrderName || 'Untitled'}) - Punch List`
    : `${workOrderName || 'Work Order'} - Punch List`
  const filename = `${safeFilename(title)}.pdf`

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

  const addPage = () => {
    doc.addPage()
    drawHeader()
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
      addPage()
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
    doc.text('Punch List Report', PAGE_MARGIN, pageHeight - 5)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 5, { align: 'right' })
  }

  doc.setProperties({ title, subject: 'Punch List Report', author: 'Tischler und Sohn' })
  await openPdfPreview(previewWindow, doc.output('blob'), filename)
}
