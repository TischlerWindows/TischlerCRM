/**
 * Generic column-driven PDFKit renderer, shared by all 4 CAD Index List
 * report types (Installation Completion Sign Off, Pre-Installation Survey
 * List, Installation Progress List, Final Adjustment Check List) — the
 * column set differs per report, so the frontend sends its own column
 * definitions rather than this file hardcoding 4 near-duplicate layouts.
 * Checked cells draw a plain "X" (ASCII), not a unicode checkmark — PDFKit's
 * standard Helvetica font uses WinAnsi encoding, which doesn't reliably
 * include glyphs like ✓ (see repo memory frontend-pdf-quirks.md).
 */
import PDFDocument from 'pdfkit';

export interface CadIndexColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'checkbox';
}

const ROW_HEIGHT = 15;
const HEADER_HEIGHT = 60;
const TITLE_HEIGHT = 24;
const FONT_SIZE = 7;
const HEADER_FONT_SIZE = 7;

const BORDER_COLOR = '#cbd5e1';
const HEADER_FILL = '#f3f4f6';
const ZEBRA_FILL = '#f9fafb';
const TEXT_COLOR = '#374151';
const TITLE_COLOR = '#1e3a5f';

const TEXT_COLUMN_WIDTH = 70;
const CHECKBOX_COLUMN_WIDTH = 34;

function baseWidth(column: CadIndexColumn): number {
  if (column.type === 'checkbox') return CHECKBOX_COLUMN_WIDTH;
  if (column.key === 'remarks') return 150;
  return TEXT_COLUMN_WIDTH;
}

function scaledColumns(columns: CadIndexColumn[], usableWidth: number): Array<CadIndexColumn & { width: number }> {
  const withWidths = columns.map((c) => ({ ...c, width: baseWidth(c) }));
  const naturalWidth = withWidths.reduce((sum, c) => sum + c.width, 0);
  const scale = usableWidth / naturalWidth;
  return withWidths.map((c) => ({ ...c, width: c.width * scale }));
}

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

function cellText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fontSize?: number; bold?: boolean; color?: string; align?: 'left' | 'center' } = {},
): void {
  const fontSize = opts.fontSize ?? FONT_SIZE;
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(opts.color ?? TEXT_COLOR);
  const innerW = Math.max(1, w - 4);
  const align = opts.align ?? 'left';
  const textHeight = doc.heightOfString(text, { width: innerW, align });
  const ty = y + Math.max(1, (h - textHeight) / 2);
  doc.text(text, x + 2, ty, { width: innerW, align, lineBreak: true });
}

function measuredTextHeight(doc: PDFKit.PDFDocument, text: string, width: number): number {
  doc.font('Helvetica').fontSize(FONT_SIZE);
  const innerW = Math.max(1, width - 4);
  return doc.heightOfString(text, { width: innerW, align: 'left' });
}

function cellTextRotated(doc: PDFKit.PDFDocument, text: string, x: number, y: number, w: number, h: number): void {
  doc.font('Helvetica-Bold').fontSize(HEADER_FONT_SIZE).fillColor(TEXT_COLOR);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const runLength = Math.max(1, h - 4);
  doc.save();
  doc.rotate(-90, { origin: [cx, cy] });
  doc.text(text, cx - runLength / 2, cy - HEADER_FONT_SIZE / 2, {
    width: runLength,
    align: 'center',
    lineBreak: false,
    ellipsis: true,
  });
  doc.restore();
}

function drawTitle(doc: PDFKit.PDFDocument, title: string, projectName: string, rowCount: number): void {
  const { left, top } = doc.page.margins;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
  doc.text(`${title} — ${projectName}`, left, top, { continued: false });
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text(`${rowCount} row${rowCount === 1 ? '' : 's'}`, left, doc.y);
  doc.y = top + TITLE_HEIGHT;
}

function drawHeader(doc: PDFKit.PDFDocument, columns: Array<CadIndexColumn & { width: number }>, x0: number, y0: number): number {
  let x = x0;
  for (const col of columns) {
    cellRect(doc, x, y0, col.width, HEADER_HEIGHT, HEADER_FILL);
    if (col.type === 'checkbox') {
      cellTextRotated(doc, col.label, x, y0, col.width, HEADER_HEIGHT);
    } else {
      cellText(doc, col.label, x, y0, col.width, HEADER_HEIGHT, { bold: true, fontSize: HEADER_FONT_SIZE });
    }
    x += col.width;
  }
  return y0 + HEADER_HEIGHT;
}

function rowHeightFor(doc: PDFKit.PDFDocument, columns: Array<CadIndexColumn & { width: number }>, row: Record<string, unknown>): number {
  let height = ROW_HEIGHT;
  for (const col of columns) {
    if (col.type === 'checkbox') continue;
    const needed = measuredTextHeight(doc, formatCell(row[col.key]), col.width) + 4;
    if (needed > height) height = needed;
  }
  return height;
}

function drawDataRow(
  doc: PDFKit.PDFDocument,
  columns: Array<CadIndexColumn & { width: number }>,
  row: Record<string, unknown>,
  rowIndex: number,
  x0: number,
  y: number,
  height: number,
): void {
  const zebra = rowIndex % 2 === 1 ? ZEBRA_FILL : undefined;
  let x = x0;
  for (const col of columns) {
    cellRect(doc, x, y, col.width, height, zebra);
    if (col.type === 'checkbox') {
      if (row[col.key]) cellText(doc, 'X', x, y, col.width, height, { bold: true, align: 'center' });
    } else {
      cellText(doc, formatCell(row[col.key]), x, y, col.width, height);
    }
    x += col.width;
  }
}

export async function renderCadIndexPDF(
  title: string,
  projectName: string,
  columns: CadIndexColumn[],
  rows: Array<Record<string, unknown>>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 28, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = doc.page.height - doc.page.margins.bottom;
      const scaled = scaledColumns(columns, usableWidth);
      const left = doc.page.margins.left;

      drawTitle(doc, title, projectName, rows.length);
      let y = drawHeader(doc, scaled, left, doc.y);

      if (rows.length === 0) {
        cellRect(doc, left, y, usableWidth, ROW_HEIGHT * 2);
        cellText(doc, 'No rows found.', left, y, usableWidth, ROW_HEIGHT * 2, { color: '#9ca3af' });
      }

      rows.forEach((row, i) => {
        const height = rowHeightFor(doc, scaled, row);
        if (y + height > bottom) {
          doc.addPage();
          drawTitle(doc, title, projectName, rows.length);
          y = drawHeader(doc, scaled, left, doc.y);
        }
        drawDataRow(doc, scaled, row, i, left, y, height);
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
