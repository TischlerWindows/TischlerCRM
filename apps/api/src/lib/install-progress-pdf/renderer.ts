/**
 * Server-side PDFKit renderer for the "Install Progress Report" widget
 * (apps/web/widgets/internal/install-progress-report/index.tsx). Unlike the
 * on-screen widget's CSS-driven print pagination (a fixed guess of rows per
 * printed page), this renderer paginates for real: rows are drawn until they
 * no longer fit the remaining page height, a "Subtotal (this page)" row is
 * drawn for whatever landed on that page, then a new page starts — so
 * subtotals always line up with the actual page break.
 *
 * Progress-stage columns are dynamic (see StageColumn) — checked cells draw
 * a plain "X" (ASCII, not a unicode checkmark glyph: PDFKit's standard
 * Helvetica font uses WinAnsi encoding, which doesn't reliably include
 * symbols like ✓ — see repo memory frontend-pdf-quirks.md).
 */
import PDFDocument from 'pdfkit';

export interface StageColumn {
  key: string;
  label: string;
}

export interface InstallProgressRow {
  [key: string]: unknown;
  page?: unknown;
  unitType?: unknown;
  code?: unknown;
  openingNumber?: unknown;
  location?: unknown;
  remarks?: unknown;
  sequence?: unknown;
  stages: Record<string, boolean>;
}

interface Column {
  key: string;
  label: string;
  width: number;
  rotated?: boolean;
  align?: 'left' | 'center';
}

const LEADING_COLUMNS_BASE: Column[] = [
  { key: 'page', label: 'Shop Drawing Page', width: 85, align: 'left' },
  { key: 'unitType', label: 'Unit', width: 55, align: 'left' },
  { key: 'code', label: 'Code', width: 55, align: 'left' },
  { key: 'openingNumber', label: 'Opening #', width: 60, align: 'left' },
  { key: 'location', label: 'Location', width: 90, align: 'left' },
];

const TRAILING_COLUMNS_BASE: Column[] = [
  { key: 'remarks', label: 'Remarks', width: 150, align: 'left' },
  { key: 'sequence', label: 'Sequence', width: 55, align: 'left' },
];

const STAGE_COLUMN_WIDTH = 26;

const ROW_HEIGHT = 15;
const HEADER_HEIGHT = 60;
const TITLE_HEIGHT = 24;
const FONT_SIZE = 7;
const HEADER_FONT_SIZE = 7;

const BORDER_COLOR = '#cbd5e1';
const HEADER_FILL = '#f3f4f6';
const ZEBRA_FILL = '#f9fafb';
const SUBTOTAL_FILL = '#fef3c7';
const GRAND_TOTAL_FILL = '#e0f2fe';
const TEXT_COLOR = '#374151';
const TITLE_COLOR = '#1e3a5f';

function buildColumns(stageColumns: StageColumn[]): Column[] {
  return [
    ...LEADING_COLUMNS_BASE,
    ...stageColumns.map((c): Column => ({ key: `stage_${c.key}`, label: c.label, width: STAGE_COLUMN_WIDTH, rotated: true, align: 'center' })),
    ...TRAILING_COLUMNS_BASE,
  ];
}

/** Scales every column's base width so the whole table exactly fills
 * `usableWidth` (matches the same technique in project-list-pdf/renderer.ts). */
function scaledColumns(columns: Column[], usableWidth: number): Column[] {
  const naturalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const scale = usableWidth / naturalWidth;
  return columns.map((c) => ({ ...c, width: c.width * scale }));
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

function measuredTextHeight(doc: PDFKit.PDFDocument, text: string, width: number, fontSize: number = FONT_SIZE): number {
  doc.font('Helvetica').fontSize(fontSize);
  const innerW = Math.max(1, width - 4);
  return doc.heightOfString(text, { width: innerW, align: 'left' });
}

function cellTextRotated(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { fontSize?: number; bold?: boolean; color?: string } = {},
): void {
  const fontSize = opts.fontSize ?? FONT_SIZE;
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(opts.color ?? TEXT_COLOR);
  const cx = x + w / 2;
  const cy = y + h / 2;
  const runLength = Math.max(1, h - 4);
  doc.save();
  doc.rotate(-90, { origin: [cx, cy] });
  doc.text(text, cx - runLength / 2, cy - fontSize / 2, {
    width: runLength,
    align: 'center',
    lineBreak: false,
    ellipsis: true,
  });
  doc.restore();
}

function drawTitle(doc: PDFKit.PDFDocument, installationName: string, rowCount: number): void {
  const { left, top } = doc.page.margins;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
  doc.text(`Install Progress Report — ${installationName}`, left, top, { continued: false });
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text(`${rowCount} row${rowCount === 1 ? '' : 's'}`, left, doc.y);
  doc.y = top + TITLE_HEIGHT;
}

function drawHeader(doc: PDFKit.PDFDocument, columns: Column[], x0: number, y0: number): number {
  let x = x0;
  for (const col of columns) {
    cellRect(doc, x, y0, col.width, HEADER_HEIGHT, HEADER_FILL);
    if (col.rotated) {
      cellTextRotated(doc, col.label, x, y0, col.width, HEADER_HEIGHT, { bold: true, fontSize: HEADER_FONT_SIZE });
    } else {
      cellText(doc, col.label, x, y0, col.width, HEADER_HEIGHT, { bold: true, fontSize: HEADER_FONT_SIZE });
    }
    x += col.width;
  }
  return y0 + HEADER_HEIGHT;
}

function rowHeightFor(doc: PDFKit.PDFDocument, columns: Column[], row: InstallProgressRow): number {
  let height = ROW_HEIGHT;
  for (const col of columns) {
    if (col.key.startsWith('stage_')) continue;
    const needed = measuredTextHeight(doc, formatCell(row[col.key]), col.width) + 4;
    if (needed > height) height = needed;
  }
  return height;
}

function drawDataRow(
  doc: PDFKit.PDFDocument,
  columns: Column[],
  row: InstallProgressRow,
  rowIndex: number,
  x0: number,
  y: number,
  height: number,
): void {
  const zebra = rowIndex % 2 === 1 ? ZEBRA_FILL : undefined;
  let x = x0;
  for (const col of columns) {
    cellRect(doc, x, y, col.width, height, zebra);
    if (col.key.startsWith('stage_')) {
      const stageKey = col.key.slice('stage_'.length);
      if (row.stages[stageKey]) {
        cellText(doc, 'X', x, y, col.width, height, { bold: true, align: 'center' });
      }
    } else {
      cellText(doc, formatCell(row[col.key]), x, y, col.width, height, { align: col.align });
    }
    x += col.width;
  }
}

function stageCount(rows: InstallProgressRow[], key: string): number {
  return rows.filter((r) => !!r.stages[key]).length;
}

function drawSubtotalRow(
  doc: PDFKit.PDFDocument,
  columns: Column[],
  pageRows: InstallProgressRow[],
  x0: number,
  y: number,
  label: string,
): number {
  const height = ROW_HEIGHT;
  let x = x0;
  let labelDrawn = false;
  for (const col of columns) {
    cellRect(doc, x, y, col.width, height, SUBTOTAL_FILL);
    if (col.key.startsWith('stage_')) {
      const stageKey = col.key.slice('stage_'.length);
      cellText(doc, `${stageCount(pageRows, stageKey)}/${pageRows.length}`, x, y, col.width, height, { bold: true, align: 'center', fontSize: 6.5 });
    } else if (!labelDrawn) {
      cellText(doc, label, x, y, col.width, height, { bold: true, align: 'left' });
      labelDrawn = true;
    }
    x += col.width;
  }
  return y + height;
}

function drawGrandTotalRow(doc: PDFKit.PDFDocument, columns: Column[], rows: InstallProgressRow[], x0: number, y: number): number {
  const height = ROW_HEIGHT + 4;
  let x = x0;
  let labelDrawn = false;
  for (const col of columns) {
    cellRect(doc, x, y, col.width, height, GRAND_TOTAL_FILL);
    if (col.key.startsWith('stage_')) {
      const stageKey = col.key.slice('stage_'.length);
      cellText(doc, `${stageCount(rows, stageKey)}/${rows.length}`, x, y, col.width, height, { bold: true, align: 'center' });
    } else if (!labelDrawn) {
      cellText(doc, 'GRAND TOTAL', x, y, col.width, height, { bold: true, align: 'left' });
      labelDrawn = true;
    }
    x += col.width;
  }
  return y + height;
}

export async function renderInstallProgressPDF(
  installationName: string,
  stageColumns: StageColumn[],
  rows: InstallProgressRow[],
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
      const columns = scaledColumns(buildColumns(stageColumns), usableWidth);
      const left = doc.page.margins.left;

      drawTitle(doc, installationName, rows.length);
      let y = drawHeader(doc, columns, left, doc.y);

      if (rows.length === 0) {
        cellRect(doc, left, y, usableWidth, ROW_HEIGHT * 2);
        cellText(doc, 'No rows found.', left, y, usableWidth, ROW_HEIGHT * 2, { color: '#9ca3af' });
      }

      let pageRows: InstallProgressRow[] = [];
      rows.forEach((row, i) => {
        const height = rowHeightFor(doc, columns, row);
        // Reserve room for this row's subtotal row too, so we never draw a
        // row right at the bottom with no space left for its page's subtotal.
        if (y + height + ROW_HEIGHT > bottom) {
          y = drawSubtotalRow(doc, columns, pageRows, left, y, 'Subtotal (this page):');
          pageRows = [];
          doc.addPage();
          drawTitle(doc, installationName, rows.length);
          y = drawHeader(doc, columns, left, doc.y);
        }
        drawDataRow(doc, columns, row, i, left, y, height);
        y += height;
        pageRows.push(row);
      });

      if (pageRows.length > 0) {
        y = drawSubtotalRow(doc, columns, pageRows, left, y, 'Subtotal (this page):');
      }
      if (rows.length > 0) {
        if (y + ROW_HEIGHT + 4 > bottom) {
          doc.addPage();
          drawTitle(doc, installationName, rows.length);
          y = drawHeader(doc, columns, left, doc.y);
        }
        y = drawGrandTotalRow(doc, columns, rows, left, y);
      }

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
