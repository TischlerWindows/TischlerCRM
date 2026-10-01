import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

interface TransmittalPdfData {
  date: string;
  submittedFor: string;
  to: string;
  attn: string;
  re: string;
  submittedBy: string;
  deliveryVia: string | string[];
  rows: Array<{ qty: string; description: string; code: string }>;
  approvalInstructions: string;
  remarks: string;
  copiesTo: string;
  signature: string;
}

const LEFT = 72;
const RIGHT = 540;
const WIDTH = RIGHT - LEFT;
const QTY_WIDTH = 56;
const DESCRIPTION_WIDTH = 306;
const CODE_WIDTH = WIDTH - QTY_WIDTH - DESCRIPTION_WIDTH;
const TABLE_GRID = [LEFT, LEFT + QTY_WIDTH, LEFT + QTY_WIDTH + DESCRIPTION_WIDTH, RIGHT];
const TABLE_HEADER_COLOR = '#1e3a5f';
const SUBMITTED_FOR = ['Approval', 'Your Information', 'Your Action', 'Your Review', 'Return of Goods'];
const DELIVERY_METHODS = ['Messenger', 'Overnight', '2nd Day Air', 'UPS Ground', 'U.S. Postal Service'];
const ASSET_DIR = dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = [
  join(ASSET_DIR, 'factory-order-logo.png'),
  join(ASSET_DIR, '../factory-order-spec-pdf/tischler-logo.png'),
  join(ASSET_DIR, 'tischler-logo.png'),
].find(existsSync);
const T_MARK_PATH = [
  join(ASSET_DIR, 'factory-order-t-logo.png'),
  join(ASSET_DIR, '../factory-order-spec-pdf/tischler-t-logo.png'),
  join(ASSET_DIR, 'tischler-t-logo.png'),
].find(existsSync);

function rule(doc: PDFKit.PDFDocument, x1: number, y: number, x2: number): void {
  doc.strokeColor('#444444').lineWidth(0.5).moveTo(x1, y).lineTo(x2, y).stroke();
}

function field(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number, height = 18): number {
  doc.font('Times-Bold').fontSize(10).text(label, x, y, { width: 82, lineBreak: false });
  doc.font('Times-Roman').fontSize(10).text(value, x + 82, y, { width: width - 82, height, ellipsis: true });
  rule(doc, x + 80, y + height + 2, x + width);
  return y + height + 8;
}

function check(doc: PDFKit.PDFDocument, text: string, selected: boolean, x: number, y: number): void {
  doc.rect(x, y + 1, 9, 9).strokeColor('#333333').lineWidth(0.6).stroke();
  if (selected) doc.font('Times-Bold').fontSize(10).text('X', x + 1, y + 1, { lineBreak: false });
  doc.font('Times-Roman').fontSize(9).text(text, x + 15, y, { width: 125, lineBreak: false });
}

function tableHeader(doc: PDFKit.PDFDocument, y: number): number {
  const height = 26;
  doc.save().fillColor(TABLE_HEADER_COLOR).rect(LEFT, y, WIDTH, height).fill().restore();
  doc.fillColor('#ffffff').font('Times-Bold').fontSize(10);
  doc.text('Qty.', TABLE_GRID[0]! + 6, y + 8, { width: QTY_WIDTH - 12, lineBreak: false });
  doc.text('Description', TABLE_GRID[1]! + 6, y + 8, { width: DESCRIPTION_WIDTH - 12, lineBreak: false });
  doc.text('Code', TABLE_GRID[2]! + 6, y + 8, { width: CODE_WIDTH - 12, lineBreak: false });
  doc.fillColor('#000000');
  doc.strokeColor('#94a3b8').lineWidth(0.6);
  TABLE_GRID.forEach(x => doc.moveTo(x, y).lineTo(x, y + height).stroke());
  rule(doc, LEFT, y, RIGHT);
  rule(doc, LEFT, y + height, RIGHT);
  return y + height;
}

function drawBranding(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index++) {
    doc.switchToPage(range.start + index);
    const savedBottom = doc.page.margins.bottom;
    const savedTop = doc.page.margins.top;
    const savedX = doc.x;
    const savedY = doc.y;
    doc.page.margins.bottom = 0;
    doc.page.margins.top = 0;

    if (index === 0 && LOGO_PATH) {
      doc.image(LOGO_PATH, (doc.page.width - 180) / 2, 12, {
        fit: [180, 54], align: 'center', valign: 'center',
      });
    }
    if (T_MARK_PATH) {
      doc.image(T_MARK_PATH, 12, doc.page.height - 66, {
        fit: [58, 58], valign: 'bottom',
      });
    }

    const footerY = doc.page.height - 34;
    doc.font('Helvetica').fontSize(6).fillColor('#6b7280')
      .text('Tischler und Sohn  |  Confidential', LEFT, footerY, {
        width: WIDTH, align: 'center', lineBreak: false,
      });
    doc.text(`Page ${index + 1} of ${range.count}`, doc.page.width - LEFT - 70, footerY, {
      width: 70, align: 'right', lineBreak: false,
    });

    doc.page.margins.bottom = savedBottom;
    doc.page.margins.top = savedTop;
    doc.x = savedX;
    doc.y = savedY;
  }
}

export function renderTransmittalPDF(data: TransmittalPdfData, projectName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 36, bottom: 36, left: LEFT, right: LEFT }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const output = Buffer.allocUnsafe(chunks.reduce((size, chunk) => size + chunk.length, 0));
      let offset = 0;
      for (const chunk of chunks) {
        output.set(chunk, offset);
        offset += chunk.length;
      }
      resolve(output);
    });
    doc.on('error', reject);

    doc.font('Times-Bold').fontSize(15).text('TRANSMITTAL', LEFT, 74, { width: 260 });
    doc.font('Times-Roman').fontSize(10).text('DATE:', 420, 40, { width: 43 });
    doc.text(data.date, 465, 40, { width: 75 });
    rule(doc, 463, 54, RIGHT);
    doc.font('Times-Bold').fontSize(10).text('SUBMITTED FOR:', 382, 70, { width: 158 });
    SUBMITTED_FOR.forEach((option, index) => check(doc, option, data.submittedFor === option, 393, 88 + index * 17));

    doc.font('Times-Roman').fontSize(10);
    const toHeight = Math.max(36, doc.heightOfString(data.to, { width: 208 }) + 10);
    let leftY = field(doc, 'To:', data.to, LEFT, 112, 290, toHeight);
    leftY = field(doc, 'Attn:', data.attn, LEFT, leftY, 290);
    leftY = field(doc, 'Re:', data.re || projectName, LEFT, leftY, 290);
    leftY = field(doc, 'Submitted by:', data.submittedBy, LEFT, leftY, 290);

    doc.font('Times-Bold').fontSize(10).text('Delivery Via:', 382, 190, { width: 155 });
    DELIVERY_METHODS.forEach((option, index) => {
      const selected = Array.isArray(data.deliveryVia)
        ? data.deliveryVia.includes(option)
        : data.deliveryVia === option;
      check(doc, option, selected, 393, 207 + index * 17);
    });

    let y = tableHeader(doc, Math.max(305, leftY + 18));
    const rows = data.rows.length ? data.rows : [{ qty: '', description: '', code: '' }];
    rows.forEach(row => {
      const rowHeight = Math.min(120, Math.max(30, doc.font('Times-Roman').fontSize(10).heightOfString(row.description, { width: DESCRIPTION_WIDTH - 12 }) + 12));
      if (y + rowHeight > 635) {
        doc.addPage();
        doc.font('Times-Bold').fontSize(11).text('TRANSMITTAL - continued', LEFT, 44, { width: WIDTH });
        y = tableHeader(doc, 76);
      }
      doc.strokeColor('#cbd5e1').lineWidth(0.5);
      TABLE_GRID.slice(0, -1).forEach((x, index) => {
        const cellWidth = TABLE_GRID[index + 1]! - x;
        doc.rect(x, y, cellWidth, rowHeight).stroke();
      });
      doc.font('Times-Roman').fontSize(10).fillColor('#111827');
      doc.text(row.qty, TABLE_GRID[0]! + 6, y + 6, { width: QTY_WIDTH - 12, height: rowHeight - 8, ellipsis: true });
      doc.text(row.description, TABLE_GRID[1]! + 6, y + 6, { width: DESCRIPTION_WIDTH - 12, height: rowHeight - 8, ellipsis: true });
      doc.text(row.code, TABLE_GRID[2]! + 6, y + 6, { width: CODE_WIDTH - 12, height: rowHeight - 8, ellipsis: true });
      y += rowHeight;
    });

    const noteHeight = Math.max(28, doc.font('Times-Roman').fontSize(10).heightOfString(data.approvalInstructions, { width: WIDTH }) + 8);
    const remarksHeight = Math.max(55, doc.heightOfString(data.remarks, { width: WIDTH - 72 }) + 20);
    if (y + noteHeight + remarksHeight + 78 > 750) {
      doc.addPage();
      y = 54;
    } else {
      y += 14;
    }
    doc.font('Times-Roman').fontSize(10).text(data.approvalInstructions, LEFT, y, { width: WIDTH });
    y += noteHeight;
    doc.font('Times-Bold').fontSize(10).text('Remarks:', LEFT, y, { width: 66 });
    doc.font('Times-Roman').text(data.remarks, LEFT + 67, y, { width: WIDTH - 72, height: remarksHeight - 8, ellipsis: true });
    y += remarksHeight;
    rule(doc, LEFT, y, RIGHT);
    doc.font('Times-Bold').fontSize(10).text('Copies to:', LEFT, y + 12, { width: 70 });
    doc.font('Times-Roman').text(data.copiesTo, LEFT + 72, y + 12, { width: 230 });
    doc.text('Thank you,', 397, y + 12, { width: 143 });
    doc.text(data.signature, 397, y + 33, { width: 143 });

    drawBranding(doc);
    doc.end();
  });
}