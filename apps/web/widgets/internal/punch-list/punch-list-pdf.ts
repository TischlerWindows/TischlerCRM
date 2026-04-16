export async function generatePunchListPdf(
  workOrderName: string,
  propertyAddress: string,
  items: Array<{
    itemNumber: number
    location: string
    description: string
    techName: string
    status: string
    estimatedHours: number
    estimatedMen: number
    serviceDate: string
  }>
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const w = doc.internal.pageSize.getWidth()
  let y = 20

  // Header
  doc.setFontSize(16)
  doc.setTextColor(39, 61, 92)
  doc.text('TISCHLER UND SOHN', w / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(12)
  doc.text('Punch List', w / 2, y, { align: 'center' })
  y += 8
  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Work Order: ${workOrderName}`, 15, y)
  y += 5
  if (propertyAddress) {
    doc.text(`Property: ${propertyAddress}`, 15, y)
    y += 5
  }
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, y)
  y += 10

  // Table header
  doc.setFillColor(39, 61, 92)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.rect(10, y, w - 20, 7, 'F')
  const cols = [10, 20, 50, 105, 135, 160, 178]
  doc.text('#', cols[0] + 2, y + 5)
  doc.text('Location', cols[1] + 2, y + 5)
  doc.text('Description', cols[2] + 2, y + 5)
  doc.text('Tech', cols[3] + 2, y + 5)
  doc.text('Status', cols[4] + 2, y + 5)
  doc.text('Hrs', cols[5] + 2, y + 5)
  doc.text('Men', cols[6] + 2, y + 5)
  y += 9

  // Table rows
  doc.setTextColor(40, 40, 40)
  for (const item of items) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(String(item.itemNumber || ''), cols[0] + 2, y)
    doc.text((item.location || '').substring(0, 25), cols[1] + 2, y)
    doc.text((item.description || '').substring(0, 45), cols[2] + 2, y)
    doc.text((item.techName || '').substring(0, 20), cols[3] + 2, y)
    doc.text(item.status || '', cols[4] + 2, y)
    doc.text(String(item.estimatedHours || ''), cols[5] + 2, y)
    doc.text(String(item.estimatedMen || ''), cols[6] + 2, y)
    y += 6
  }

  doc.save(`PunchList_${workOrderName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`)
}
