import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

interface MaterialRow {
  qty: string;
  units: string;
  description: string;
  screwSize: string;
  unitPrice: string;
}

interface InstallationMaterialData {
  template: string;
  date: string;
  factory: string;
  project: string;
  location: string;
  projectManager: string;
  attn: string;
  installationBy: string[];
  orderedFrom: string[];
  rows: MaterialRow[];
  signature: string;
  signatureDate: string;
}

const PAGE_LEFT = 24;
const PAGE_RIGHT = 588;
const CONTENT_WIDTH = PAGE_RIGHT - PAGE_LEFT;
const BOTTOM_LIMIT = 946;
interface MaterialColumn {
  key: 'qty' | 'units' | 'description' | 'screwSize' | 'unitPrice' | 'total';
  label: string;
  width: number;
}
const NAVY = '#1e3a5f';
const GRID = '#9ca3af';
const ASSET_DIR = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = [
  join(ASSET_DIR, 'factory-order-logo.png'),
  join(ASSET_DIR, '../factory-order-spec-pdf/tischler-logo.png'),
  join(ASSET_DIR, 'tischler-logo.png'),
].find(existsSync);

function textValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function materialTotal(row: MaterialRow): number {
  const quantity = Number(row.qty.replace(/,/g, '')) || 0;
  const price = Number(row.unitPrice.replace(/[$,€\s]/g, '')) || 0;
  return quantity * price;
}

function drawField(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number): void {
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#26374b').text(label, x, y + 3, { width: 88, lineBreak: false });
  doc.rect(x + 88, y, width - 88, 18).fillAndStroke('#f5f5f5', '#9ca3af');
  doc.font('Helvetica').fontSize(9).fillColor('#111827').text(value, x + 92, y + 4, { width: width - 96, height: 12, ellipsis: true });
}

function drawCheckbox(doc: PDFKit.PDFDocument, label: string, selected: boolean, x: number, y: number): void {
  doc.rect(x, y, 9, 9).lineWidth(0.8).strokeColor('#111827').stroke();
  if (selected) doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('X', x + 1, y - 1, { lineBreak: false });
  doc.font('Helvetica').fontSize(8).fillColor('#111827').text(label, x + 14, y - 1, { width: 140, lineBreak: false });
}

function columnsForTemplate(template: string, currencySymbol: string): MaterialColumn[] {
  const columns: MaterialColumn[] = template === 'US Supplied Inst.'
    ? [
        { key: 'qty', label: 'Qty.', width: 38 },
        { key: 'units', label: 'Units', width: 86 },
        { key: 'description', label: 'Description', width: 314 },
        { key: 'unitPrice', label: `Unit Price (${currencySymbol})`, width: 70 },
        { key: 'total', label: `TOTAL (${currencySymbol})`, width: 56 },
      ]
    : [
        { key: 'qty', label: 'Qty.', width: 38 },
        { key: 'units', label: 'Units', width: 42 },
        { key: 'description', label: 'Description', width: 278 },
        { key: 'screwSize', label: 'US Screw Size', width: 80 },
        { key: 'unitPrice', label: `Unit Price (${currencySymbol})`, width: 70 },
        { key: 'total', label: `TOTAL (${currencySymbol})`, width: 56 },
      ];
  return columns;
}

function columnPositions(columns: MaterialColumn[]): number[] {
  return columns.reduce<number[]>((positions, column, index) => {
    positions.push(index === 0 ? PAGE_LEFT : positions[index - 1]! + columns[index - 1]!.width);
    return positions;
  }, []);
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number, columns: MaterialColumn[], positions: number[]): number {
  const height = 21;
  columns.forEach((column, index) => {
    const x = positions[index]!;
    doc.rect(x, y, column.width, height).lineWidth(0.5).fillAndStroke(NAVY, GRID);
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#ffffff')
      .text(column.label, x + 3, y + 7, { width: column.width - 6, lineBreak: false, align: column.key === 'unitPrice' || column.key === 'total' ? 'right' : 'left' });
  });
  return y + height;
}

function drawRow(doc: PDFKit.PDFDocument, row: MaterialRow, y: number, height: number, columns: MaterialColumn[], positions: number[]): void {
  columns.forEach((column, index) => {
    const x = positions[index]!;
    const value = column.key === 'total'
      ? materialTotal(row) ? materialTotal(row).toFixed(2) : ''
      : row[column.key];
    const background = column.key === 'qty' ? '#fff200' : column.key === 'screwSize' ? '#e5e7eb' : column.key === 'total' ? '#f8c7ce' : '#ffffff';
    doc.rect(x, y, column.width, height).lineWidth(0.4).fillAndStroke(background, GRID);
    doc.font('Helvetica').fontSize(7).fillColor('#111827')
      .text(value, x + 3, y + 4, { width: column.width - 6, height: height - 6, ellipsis: true, align: column.key === 'unitPrice' || column.key === 'total' ? 'right' : 'left' });
  });
}

function drawBranding(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(range.start + index);
    const x = doc.x;
    const y = doc.y;
    const savedTop = doc.page.margins.top;
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.top = 0;
    doc.page.margins.bottom = 0;
    if (index === 0 && LOGO_PATH) {
      doc.image(LOGO_PATH, PAGE_RIGHT - 112, 34, { fit: [100, 70], align: 'center', valign: 'center' });
    }
    doc.font('Helvetica').fontSize(6).fillColor('#6b7280')
      .text('Tischler und Sohn  |  Installation Materials', PAGE_LEFT, 982, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
    doc.text(`Page ${index + 1} of ${range.count}`, PAGE_RIGHT - 55, 982, { width: 55, align: 'right', lineBreak: false });
    doc.page.margins.top = savedTop;
    doc.page.margins.bottom = savedBottom;
    doc.x = x;
    doc.y = y;
  }
}

export function renderInstallationMaterialPDF(data: InstallationMaterialData, projectName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LEGAL', margins: { top: 18, bottom: 48, left: PAGE_LEFT, right: PAGE_LEFT }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => {
      const output = Buffer.allocUnsafe(chunks.reduce((size, chunk) => size + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(output);
    });

    const title = `${data.template.toUpperCase()} INSTALLATION MATERIALS`;
    const currencySymbol = data.template === 'US Supplied Inst.' ? '$' : '€';
    const columns = columnsForTemplate(data.template, currencySymbol);
    const positions = columnPositions(columns);
    doc.rect(PAGE_LEFT, 16, CONTENT_WIDTH, 24).lineWidth(0.7).fillAndStroke('#ffffff', '#111827');
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(title, PAGE_LEFT + 5, 22, { width: 330, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(9).text('Date:', 394, 23, { width: 30, lineBreak: false });
    doc.font('Helvetica').fontSize(9).text(data.date, 430, 23, { width: 54, lineBreak: false });
    doc.moveTo(428, 38).lineTo(486, 38).strokeColor('#111827').lineWidth(0.5).stroke();

    const boxY = 50;
    const leftX = PAGE_LEFT;
    const leftWidth = 260;
    const centerX = 284;
    const centerWidth = 184;
    const rightX = 478;
    const rightWidth = PAGE_RIGHT - rightX;
    doc.rect(leftX, boxY, leftWidth, 110).lineWidth(0.7).strokeColor('#111827').stroke();
    doc.rect(centerX, boxY, centerWidth, 110).lineWidth(0.7).strokeColor('#111827').stroke();
    doc.rect(rightX, boxY, rightWidth, 110).lineWidth(0.7).strokeColor('#111827').stroke();
    drawField(doc, 'Factory', data.factory, leftX + 5, 56, leftWidth - 10);
    drawField(doc, 'Project', data.project || projectName, leftX + 5, 77, leftWidth - 10);
    drawField(doc, 'Location', data.location, leftX + 5, 98, leftWidth - 10);
    drawField(doc, 'Project Manager', data.projectManager, leftX + 5, 119, leftWidth - 10);
    drawField(doc, 'Attn.', data.attn, leftX + 5, 140, leftWidth - 10);

    doc.font('Helvetica-Bold').fontSize(8).fillColor('#111827').text('To be filled by Project Manager:', centerX + 7, 59, { width: centerWidth - 14 });
    data.installationBy.forEach((option, index) => drawCheckbox(doc, option, data.installationBy.includes(option), centerX + 12, 79 + index * 14));
    doc.font('Helvetica-Bold').fontSize(8).text('To be ordered from:', centerX + 7, 126, { width: centerWidth - 14 });
    const sourcePositions = [[centerX + 12, 142], [centerX + 96, 142], [centerX + 12, 155], [centerX + 96, 155]] as const;
    data.orderedFrom.forEach(option => {
      const normalizedOption = option === 'Korn' ? 'Tischler Fensterwerk' : option;
      const index = ['Tischler Fensterwerk', 'CT Warehouse', 'Other', 'FL Warehouse'].indexOf(normalizedOption);
      if (index >= 0) drawCheckbox(doc, option, true, sourcePositions[index]![0], sourcePositions[index]![1]);
    });
    if (LOGO_PATH) doc.image(LOGO_PATH, rightX + 3, boxY + 8, { fit: [rightWidth - 6, 94], align: 'center', valign: 'center' });

    let y = drawTableHeader(doc, 174, columns, positions);
    const sourceRows = data.rows.length ? data.rows : Array.from({ length: 44 }, () => ({ qty: '', units: '', description: '', screwSize: '', unitPrice: '' }));
    for (const row of sourceRows) {
      const rowHeight = 15;
      if (y + rowHeight > BOTTOM_LIMIT) {
        doc.addPage();
        y = 28;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(`${title} - continued`, PAGE_LEFT, y, { width: CONTENT_WIDTH });
        y += 21;
        y = drawTableHeader(doc, y, columns, positions);
      }
      drawRow(doc, row, y, rowHeight, columns, positions);
      y += rowHeight;
    }

    if (y + 55 > BOTTOM_LIMIT) {
      doc.addPage();
      y = 38;
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#111827').text(`${title} - continued`, PAGE_LEFT, y, { width: CONTENT_WIDTH });
      y += 22;
    }
    const total = sourceRows.reduce((sum, row) => sum + materialTotal(row), 0);
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(`TOTAL (${currencySymbol}): ${total.toFixed(2)}`, PAGE_RIGHT - 150, y + 5, { width: 145, align: 'right' });
    doc.moveTo(PAGE_LEFT, y + 25).lineTo(PAGE_RIGHT, y + 25).strokeColor('#111827').lineWidth(0.7).stroke();
    doc.font('Helvetica-Bold').fontSize(9).text('Factory: Please fill out price list, sign below, and return via fax to confirm order.', PAGE_LEFT, y + 34, { width: CONTENT_WIDTH });
    doc.font('Helvetica-Bold').fontSize(9).text('Signature:', PAGE_LEFT, y + 58, { width: 60 });
    doc.moveTo(PAGE_LEFT + 62, y + 73).lineTo(PAGE_LEFT + 260, y + 73).strokeColor('#111827').lineWidth(0.5).stroke();
    doc.font('Helvetica-Bold').fontSize(9).text('Date:', PAGE_LEFT + 330, y + 58, { width: 38 });
    doc.moveTo(PAGE_LEFT + 370, y + 73).lineTo(PAGE_LEFT + 525, y + 73).strokeColor('#111827').lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(9).text(data.signature, PAGE_LEFT + 64, y + 59, { width: 194, lineBreak: false });
    doc.text(data.signatureDate, PAGE_LEFT + 372, y + 59, { width: 150, lineBreak: false });

    drawBranding(doc);
    doc.end();
  });
}