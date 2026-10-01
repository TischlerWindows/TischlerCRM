import PDFDocument from 'pdfkit';

interface TransmittalPdfData {
  date: string;
  submittedFor: string;
  to: string;
  attn: string;
  re: string;
  submittedBy: string;
  deliveryVia: string;
  rows: Array<{ qty: string; description: string; code: string }>;
  approvalInstructions: string;
  remarks: string;
  copiesTo: string;
  signature: string;
}

const LEFT = 72;
const RIGHT = 540;
const WIDTH = RIGHT - LEFT;
const SUBMITTED_FOR = ['Approval', 'Your Information', 'Your Action', 'Your Review', 'Return of Goods'];
const DELIVERY_METHODS = ['Messenger', 'Overnight', '2nd Day Air', 'UPS Ground', 'U.S. Postal Service'];

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
  doc.font('Times-Bold').fontSize(10);
  rule(doc, LEFT, y, RIGHT);
  doc.text('Qty.', LEFT + 6, y + 7, { width: 45 });
  doc.text('Description', LEFT + 64, y + 7, { width: 297 });
  doc.text('Code', RIGHT - 90, y + 7, { width: 84 });
  rule(doc, LEFT, y + 25, RIGHT);
  return y + 25;
}

export function renderTransmittalPDF(data: TransmittalPdfData, projectName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 36, bottom: 36, left: LEFT, right: LEFT }, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Times-Bold').fontSize(15).text('TRANSMITTAL', LEFT, 74, { width: 260 });
    doc.font('Times-Roman').fontSize(10).text('DATE:', 382, 40, { width: 48 });
    doc.text(data.date, 427, 40, { width: 113 });
    rule(doc, 425, 54, RIGHT);
    doc.font('Times-Bold').fontSize(10).text('SUBMITTED FOR:', 382, 70, { width: 158 });
    SUBMITTED_FOR.forEach((option, index) => check(doc, option, data.submittedFor === option, 393, 88 + index * 17));

    doc.font('Times-Roman').fontSize(10);
    const toHeight = Math.max(36, doc.heightOfString(data.to, { width: 208 }) + 10);
    let leftY = field(doc, 'To:', data.to, LEFT, 112, 290, toHeight);
    leftY = field(doc, 'Attn:', data.attn, LEFT, leftY, 290);
    leftY = field(doc, 'Re:', data.re || projectName, LEFT, leftY, 290);
    leftY = field(doc, 'Submitted by:', data.submittedBy, LEFT, leftY, 290);

    doc.font('Times-Bold').fontSize(10).text('Delivery Via:', 382, 190, { width: 155 });
    DELIVERY_METHODS.forEach((option, index) => check(doc, option, data.deliveryVia === option, 393, 207 + index * 17));

    let y = tableHeader(doc, Math.max(305, leftY + 18));
    const rows = data.rows.length ? data.rows : [{ qty: '', description: '', code: '' }];
    rows.forEach(row => {
      const rowHeight = Math.max(28, doc.font('Times-Roman').fontSize(10).heightOfString(row.description, { width: 286 }) + 12);
      if (y + rowHeight > 635) {
        doc.addPage();
        doc.font('Times-Bold').fontSize(11).text('TRANSMITTAL - continued', LEFT, 44, { width: WIDTH });
        y = tableHeader(doc, 76);
      }
      doc.font('Times-Roman').fontSize(10).text(row.qty, LEFT + 6, y + 6, { width: 45, height: rowHeight - 8, ellipsis: true });
      doc.text(row.description, LEFT + 64, y + 6, { width: 286, height: rowHeight - 8, ellipsis: true });
      doc.text(row.code, RIGHT - 90, y + 6, { width: 84, height: rowHeight - 8, ellipsis: true });
      y += rowHeight;
      rule(doc, LEFT, y, RIGHT);
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

    doc.end();
  });
}