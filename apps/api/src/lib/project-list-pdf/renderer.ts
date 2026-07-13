/**
 * Server-side PDFKit renderer for the "Project List Report" (the
 * spreadsheet-style aggregate view of every Project record). Mirrors the
 * column set defined in
 * apps/web/app/projects/_components/project-list-report-modal.tsx — keep
 * the two in sync when the Project List fields change.
 *
 * All ~36 columns render on one landscape page: every standalone column
 * header except "Customer" is rotated 90° (matching the web report's
 * VERTICAL_HEADER_STYLE), which frees up enough horizontal space for every
 * column to fit at once instead of needing to paginate horizontally.
 * Columns still paginate vertically through every project, never splitting
 * a single project's block of sub-rows across a page break.
 */
import PDFDocument from 'pdfkit';

interface SimpleColumn {
  kind: 'simple';
  key: string;
  label: string;
  width: number;
  umbrella?: string;
}
interface StackedColumn {
  kind: 'stacked';
  keyPrefix: string;
  label: string;
  rowCount: number;
  width: number;
  umbrella?: string;
}
type Column = SimpleColumn | StackedColumn;
interface HeaderGroup {
  umbrella: string | null;
  columns: Column[];
}

// "Customer" is the only column whose header reads normally (horizontally),
// so it keeps a wide base width; every other column's header is rotated
// (see isRotatedHeader below), so they only need to be wide enough for
// their (short) data values, not their label.
const WIDE = 70;
const NARROW = 16;
const ROTATED = 20;

const simple = (key: string, label: string, width: number, umbrella?: string): SimpleColumn => ({
  kind: 'simple',
  key,
  label,
  width,
  umbrella,
});
const stacked = (
  keyPrefix: string,
  label: string,
  rowCount: number,
  width: number,
  umbrella?: string,
): StackedColumn => ({ kind: 'stacked', keyPrefix, label, rowCount, width, umbrella });

// Mirrors COLUMNS in project-list-report-modal.tsx (labels + field keys),
// with an added `width` per column since the PDF has no scroll/auto-layout.
const COLUMNS: Column[] = [
  simple('projectName', 'Customer', WIDE),
  simple('tusOrderNumber', 'TUS Order #', ROTATED),
  simple('factory', 'Factory', ROTATED),
  simple('standardProductType', 'ST', NARROW, 'Product Type'),
  simple('dadeCountyProductType', 'DC', NARROW, 'Product Type'),
  simple('doubleHungProductType', 'DH', NARROW, 'Product Type'),
  simple('screenFlag', 'Screen', NARROW, 'Roll System'),
  simple('lutronFlag', 'Lutron', NARROW, 'Roll System'),
  simple('checkFlag', 'Check', NARROW, 'Roll System'),
  simple('tischlerPM', 'Tischler PM', ROTATED),
  simple('factoryPM', 'Factory PM', ROTATED),
  simple('projectSalesman', 'Salesman', ROTATED),
  simple('projectLocation', 'Location', ROTATED),
  simple('woodSpecies', 'Wood Species', ROTATED),
  simple('dcSilicone', 'DC Silicone', ROTATED),
  simple('solarControl', 'Solar Ctrl', ROTATED),
  simple('finishColor', 'Finish Color', ROTATED),
  stacked('changeOrder', 'Change Order in Estim. / To Client', 5, ROTATED),
  stacked('set1', 'Set 1', 5, NARROW, 'Shop Drawings'),
  stacked('set2', 'Set 2', 5, NARROW, 'Shop Drawings'),
  stacked('set3', 'Set 3', 5, NARROW, 'Shop Drawings'),
  stacked('set4', 'Set 4', 5, NARROW, 'Shop Drawings'),
  stacked('finalSet', 'Final', 5, NARROW, 'Shop Drawings'),
  stacked('installSet', 'Install Set', 5, NARROW, 'Shop Drawings'),
  stacked('jobStatusOrderDate', 'Job Status / Order Date', 3, ROTATED),
  simple('onHoldUnits', 'On-Hold Units', ROTATED),
  simple('customHardware', 'Custom Hardware', ROTATED),
  stacked('factoryOC', 'Factory O.C.', 2, ROTATED),
  stacked('installationMaterial', 'Installation Material', 2, ROTATED),
  stacked('installationInstruction', 'Installation Instruction', 3, ROTATED),
  stacked('shippingWeek', 'Shipping Week', 5, ROTATED),
  stacked('estimatedDeliveryWeek', 'Estimated Delivery Wk', 5, ROTATED),
  stacked('loadingListRF', 'RF', 5, NARROW, 'Loading List'),
  stacked('loadingListRS', 'RS', 5, NARROW, 'Loading List'),
  stacked('loadingListOF', 'OF', 5, NARROW, 'Loading List'),
  simple('completionSignOff', 'Completion Sign-off', ROTATED),
];

const ROW_HEIGHT = 13;
const HEADER_ROW1_HEIGHT = 14;
const HEADER_ROW2_HEIGHT = 34;
const HEADER_HEIGHT = HEADER_ROW1_HEIGHT + HEADER_ROW2_HEIGHT;
const TITLE_HEIGHT = 22;
const FONT_SIZE = 6.5;
const HEADER_FONT_SIZE = 6.5;

const BORDER_COLOR = '#cbd5e1';
const HEADER_FILL = '#f3f4f6';
const ZEBRA_FILL = '#f9fafb';
const TEXT_COLOR = '#374151';
const TITLE_COLOR = '#1e3a5f';

function columnKey(column: Column): string {
  return column.kind === 'simple' ? column.key : column.keyPrefix;
}

/** "Customer" is the only standalone column whose header reads normally
 * (horizontally); every other standalone column is rotated to save
 * horizontal space — matches the web report's VERTICAL_HEADER_STYLE.
 * Umbrella-grouped sub-columns (ST/DC/DH, Set 1-6, RF/RS/OF, ...) are
 * handled separately in drawHeader and always stay horizontal. */
function isRotatedHeader(column: Column): boolean {
  return columnKey(column) !== 'projectName';
}

/** Screen/Lutron/Check (the "Roll System" umbrella's sub-headers) also
 * rotate, matching the web report; other umbrella sub-headers (ST/DC/DH,
 * Set 1-6, RF/RS/OF) stay horizontal. */
function isRotatedSubHeader(column: Column): boolean {
  return ['screenFlag', 'lutronFlag', 'checkFlag'].includes(columnKey(column));
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Y' : '';
  return String(value);
}

/** Change Order's 5 rows are fixed sheet row identities (2 Shop Drawing
 * Submission rows, then CO Down/Out/Back) that auto-fill in the Project List
 * widget when a project has no saved override. Mirrored here (and in the web
 * report modal) so the PDF shows the same values instead of blank dashes. */
const CHANGE_ORDER_ROW_DEFAULTS = ['Shop Dwg Subm', 'Shop Dwg Subm', 'CO Down', 'CO Out', 'CO Back'];

function changeOrderCellValue(project: Record<string, unknown>, rowIndex: number): unknown {
  const raw = project[`changeOrderRow${rowIndex + 1}`];
  return raw !== null && raw !== undefined && raw !== '' ? raw : CHANGE_ORDER_ROW_DEFAULTS[rowIndex];
}

/** Same rule as the web report: the highest Row index across all stacked
 * columns that actually has a value, at least 1. */
function subRowCountFor(project: Record<string, unknown>): number {
  let max = 1;
  for (const col of COLUMNS) {
    if (col.kind !== 'stacked') continue;
    for (let n = col.rowCount; n >= 1; n--) {
      const v = col.keyPrefix === 'changeOrder' ? changeOrderCellValue(project, n - 1) : project[`${col.keyPrefix}Row${n}`];
      if (v !== null && v !== undefined && v !== '') {
        if (n > max) max = n;
        break;
      }
    }
  }
  return max;
}

function headerGroupsFor(columns: Column[]): HeaderGroup[] {
  const groups: HeaderGroup[] = [];
  for (const column of columns) {
    const prev = groups[groups.length - 1];
    if (column.umbrella && prev?.umbrella === column.umbrella) {
      prev.columns.push(column);
    } else {
      groups.push({ umbrella: column.umbrella ?? null, columns: [column] });
    }
  }
  return groups;
}

/** Scales every column's base width so the whole table (all columns, on one
 * page) exactly fills `usableWidth` instead of leaving space unused or
 * overflowing the page. */
function scaledColumns(usableWidth: number): Column[] {
  const naturalWidth = COLUMNS.reduce((sum, c) => sum + c.width, 0);
  const scale = usableWidth / naturalWidth;
  return COLUMNS.map(c => ({ ...c, width: c.width * scale }));
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
  opts: { fontSize?: number; bold?: boolean; color?: string } = {},
): void {
  const fontSize = opts.fontSize ?? FONT_SIZE;
  doc.font(opts.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize).fillColor(opts.color ?? TEXT_COLOR);
  const innerW = Math.max(1, w - 4);
  const textHeight = doc.heightOfString(text, { width: innerW, align: 'center' });
  const ty = y + Math.max(1, (h - textHeight) / 2);
  doc.text(text, x + 2, ty, { width: innerW, align: 'center', lineBreak: true });
}

/** Draws `text` rotated 90° (reading bottom-to-top) centered within the
 * (x, y, w, h) cell — used for standalone header columns to save
 * horizontal space, matching the web report's rotated headers. */
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
  // The text's reading-direction run becomes vertical after rotation, so its
  // available length is the cell's height (not its width).
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

function drawTitle(doc: PDFKit.PDFDocument, projectCount: number): void {
  const { left, top } = doc.page.margins;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
  doc.text(`Project List Report — ${projectCount} project${projectCount === 1 ? '' : 's'}`, left, top, {
    continued: false,
  });
  doc.y = top + TITLE_HEIGHT;
}

/** Draws the two-row header (umbrella row + sub-heading row) for one
 * page-group of columns, starting at (x0, y0). Returns the y just below it. */
function drawHeader(doc: PDFKit.PDFDocument, columns: Column[], x0: number, y0: number): number {
  const groups = headerGroupsFor(columns);
  let x = x0;
  for (const group of groups) {
    const groupWidth = group.columns.reduce((sum, c) => sum + c.width, 0);
    if (group.umbrella) {
      cellRect(doc, x, y0, groupWidth, HEADER_ROW1_HEIGHT, HEADER_FILL);
      cellText(doc, group.umbrella, x, y0, groupWidth, HEADER_ROW1_HEIGHT, {
        bold: true,
        fontSize: HEADER_FONT_SIZE,
      });
      let sx = x;
      for (const col of group.columns) {
        cellRect(doc, sx, y0 + HEADER_ROW1_HEIGHT, col.width, HEADER_ROW2_HEIGHT, HEADER_FILL);
        if (isRotatedSubHeader(col)) {
          cellTextRotated(doc, col.label, sx, y0 + HEADER_ROW1_HEIGHT, col.width, HEADER_ROW2_HEIGHT, {
            bold: true,
            fontSize: HEADER_FONT_SIZE,
          });
        } else {
          cellText(doc, col.label, sx, y0 + HEADER_ROW1_HEIGHT, col.width, HEADER_ROW2_HEIGHT, {
            bold: true,
            fontSize: HEADER_FONT_SIZE,
          });
        }
        sx += col.width;
      }
    } else {
      const col = group.columns[0]!;
      cellRect(doc, x, y0, col.width, HEADER_HEIGHT, HEADER_FILL);
      if (isRotatedHeader(col)) {
        cellTextRotated(doc, col.label, x, y0, col.width, HEADER_HEIGHT, {
          bold: true,
          fontSize: HEADER_FONT_SIZE,
        });
      } else {
        cellText(doc, col.label, x, y0, col.width, HEADER_HEIGHT, {
          bold: true,
          fontSize: HEADER_FONT_SIZE,
        });
      }
    }
    x += groupWidth;
  }
  return y0 + HEADER_HEIGHT;
}

/** Draws one project's block of sub-rows (simple columns visually merged
 * down the whole block, stacked columns showing one value per sub-row). */
function drawProjectBlock(
  doc: PDFKit.PDFDocument,
  columns: Column[],
  project: Record<string, unknown>,
  projectIndex: number,
  x0: number,
  y0: number,
  subRows: number,
): number {
  const zebra = projectIndex % 2 === 1 ? ZEBRA_FILL : undefined;
  const blockHeight = subRows * ROW_HEIGHT;

  let x = x0;
  for (const column of columns) {
    if (column.kind === 'simple') {
      cellRect(doc, x, y0, column.width, blockHeight, zebra);
      cellText(doc, formatCell(project[column.key]), x, y0, column.width, blockHeight);
    } else {
      for (let ri = 0; ri < subRows; ri++) {
        const value = ri < column.rowCount
          ? (column.keyPrefix === 'changeOrder' ? changeOrderCellValue(project, ri) : project[`${column.keyPrefix}Row${ri + 1}`])
          : undefined;
        cellRect(doc, x, y0 + ri * ROW_HEIGHT, column.width, ROW_HEIGHT, zebra);
        cellText(doc, formatCell(value), x, y0 + ri * ROW_HEIGHT, column.width, ROW_HEIGHT);
      }
    }
    x += column.width;
  }

  // Slightly heavier rule under the whole block to mark the project boundary.
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  doc.lineWidth(1).strokeColor('#9ca3af').moveTo(x0, y0 + blockHeight).lineTo(x0 + totalWidth, y0 + blockHeight).stroke();

  return y0 + blockHeight;
}

export async function renderProjectListPDF(projects: Array<Record<string, unknown>>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', layout: 'landscape', margin: 28, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = doc.page.height - doc.page.margins.bottom;
      const columns = scaledColumns(usableWidth);

      drawTitle(doc, projects.length);
      let y = drawHeader(doc, columns, doc.page.margins.left, doc.y);

      if (projects.length === 0) {
        cellRect(doc, doc.page.margins.left, y, usableWidth, ROW_HEIGHT * 2, undefined);
        cellText(doc, 'No projects found.', doc.page.margins.left, y, usableWidth, ROW_HEIGHT * 2, {
          color: '#9ca3af',
        });
      }

      projects.forEach((project, pi) => {
        const subRows = subRowCountFor(project);
        const blockHeight = subRows * ROW_HEIGHT;
        if (y + blockHeight > bottom) {
          doc.addPage();
          drawTitle(doc, projects.length);
          y = drawHeader(doc, columns, doc.page.margins.left, doc.y);
        }
        y = drawProjectBlock(doc, columns, project, pi, doc.page.margins.left, y, subRows);
      });

      // Footer page numbers across every buffered page.
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
