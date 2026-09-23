/**
 * Server-side PDFKit renderer for the AutoCad widget's fastener/screw
 * schedule. Header carries the Tischler logo + "Project Mgr" in the top
 * left, "Project Name" in the top right — everything else (project manager
 * name resolution, project name) is resolved client-side by the widget
 * before it POSTs here, same as every other list-widget PDF in this repo.
 *
 * Logo asset lives next to this file in dev; the build script
 * (apps/api/package.json) copies it to dist/tischler-logo.png so
 * `import.meta.url`-relative resolution keeps working in the esbuild bundle
 * (same pattern as dade-impact-sheet.ts / glass-sheets.ts).
 */
import PDFDocument from 'pdfkit';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const LOGO_PATH = join(dirname(fileURLToPath(import.meta.url)), 'tischler-logo.png');

export interface AutoCadRow {
  fastener?: unknown;
  totalQty?: unknown;
}

interface Column {
  key: keyof AutoCadRow;
  label: string;
  width: number;
}

const COLUMNS: Column[] = [
  { key: 'fastener', label: 'Fastener', width: 260 },
  { key: 'totalQty', label: 'Total QTY', width: 80 },
];

const ROW_HEIGHT = 15;
const HEADER_ROW_HEIGHT = 18;
const HEADER_BLOCK_HEIGHT = 54;
const FONT_SIZE = 8;

const BORDER_COLOR = '#cbd5e1';
const HEADER_FILL = '#f3f4f6';
const ZEBRA_FILL = '#f9fafb';
const TEXT_COLOR = '#374151';
const TITLE_COLOR = '#1e3a5f';

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

function cellRect(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, fill?: string): void {
  doc.lineWidth(0.4);
  if (fill) {
    doc.rect(x, y, w, h).fillAndStroke(fill, BORDER_COLOR);
  } else {
    doc.rect(x, y, w, h).strokeColor(BORDER_COLOR).stroke();
  }
}

function cellText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, h: number, opts: { bold?: boolean } = {}): void {
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(FONT_SIZE).fillColor(TEXT_COLOR);
  const innerW = Math.max(1, w - 4);
  const textHeight = doc.heightOfString(text, { width: innerW });
  const ty = y + Math.max(1, (h - textHeight) / 2);
  doc.text(text, x + 2, ty, { width: innerW, lineBreak: true });
}

function measuredTextHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
  doc.font('Helvetica').fontSize(FONT_SIZE);
  return doc.heightOfString(text, { width: Math.max(1, width - 4) });
}

/** Logo + "Project Mgr" top-left, "Project Name" top-right. Returns the y
 * just below the header block, where the title/table should start. */
function drawHeaderBlock(doc: PDFKit.PDFDocument, projectName: string, projectManager: string): number {
  const { left, top, right } = doc.page.margins;
  const usableWidth = doc.page.width - left - right;

  let logoWidth = 0;
  if (existsSync(LOGO_PATH)) {
    logoWidth = 90;
    doc.image(LOGO_PATH, left, top, { width: logoWidth });
  }

  if (projectManager) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(TITLE_COLOR);
    doc.text(`Project Mgr: ${projectManager}`, left, top + 42, { width: 220 });
  }

  doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
  doc.text(`Project Name: ${projectName}`, left, top, { width: usableWidth, align: 'right' });

  return top + HEADER_BLOCK_HEIGHT;
}

function drawTitle(doc: PDFKit.PDFDocument, y: number, rowCount: number): number {
  const { left } = doc.page.margins;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
  doc.text('AutoCad — Fastener Count', left, y);
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text(`${rowCount} row${rowCount === 1 ? '' : 's'}`, left, doc.y);
  return doc.y + 6;
}

function scaledColumns(usableWidth: number): Array<Column & { width: number }> {
  const naturalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const scale = usableWidth / naturalWidth;
  return COLUMNS.map((c) => ({ ...c, width: c.width * scale }));
}

function drawHeader(doc: PDFKit.PDFDocument, columns: Array<Column & { width: number }>, x0: number, y0: number): number {
  let x = x0;
  for (const col of columns) {
    cellRect(doc, x, y0, col.width, HEADER_ROW_HEIGHT, HEADER_FILL);
    cellText(doc, col.label, x, y0, col.width, HEADER_ROW_HEIGHT, { bold: true });
    x += col.width;
  }
  return y0 + HEADER_ROW_HEIGHT;
}

function rowHeightFor(doc: PDFKit.PDFDocument, columns: Array<Column & { width: number }>, row: AutoCadRow): number {
  let height = ROW_HEIGHT;
  for (const col of columns) {
    const needed = measuredTextHeight(doc, formatCell(row[col.key]), col.width) + 4;
    if (needed > height) height = needed;
  }
  return height;
}

function drawDataRow(doc: PDFKit.PDFDocument, columns: Array<Column & { width: number }>, row: AutoCadRow, rowIndex: number, x0: number, y: number, height: number): void {
  const zebra = rowIndex % 2 === 1 ? ZEBRA_FILL : undefined;
  let x = x0;
  for (const col of columns) {
    cellRect(doc, x, y, col.width, height, zebra);
    cellText(doc, formatCell(row[col.key]), x, y, col.width, height);
    x += col.width;
  }
}

export async function renderAutoCadPDF(projectName: string, projectManager: string, rows: AutoCadRow[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 28, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = doc.page.height - doc.page.margins.bottom;
      const columns = scaledColumns(usableWidth);
      const left = doc.page.margins.left;

      let y = drawHeaderBlock(doc, projectName, projectManager);
      y = drawTitle(doc, y, rows.length);
      y = drawHeader(doc, columns, left, y);

      if (rows.length === 0) {
        cellRect(doc, left, y, usableWidth, ROW_HEIGHT * 2);
        cellText(doc, 'No rows found.', left, y, usableWidth, ROW_HEIGHT * 2);
      }

      rows.forEach((row, i) => {
        const height = rowHeightFor(doc, columns, row);
        if (y + height > bottom) {
          doc.addPage();
          y = drawHeaderBlock(doc, projectName, projectManager);
          y = drawTitle(doc, y, rows.length);
          y = drawHeader(doc, columns, left, y);
        }
        drawDataRow(doc, columns, row, i, left, y, height);
        y += height;
      });

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#9ca3af')
          .text(`Page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 8, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
            height: 20,
            align: 'right',
            lineBreak: false,
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
