/**
 * Server-side PDFKit renderer for the "Project List Report" (the
 * spreadsheet-style aggregate view of every Project record). Mirrors the
 * column set defined in
 * apps/web/app/projects/_components/project-list-report-modal.tsx — keep
 * the two in sync when the Project List fields change.
 *
 * The report has ~35 columns, far more than fit on one landscape page at a
 * readable size, so columns are split into "page-groups" (like Excel print
 * areas): a handful of identity columns (Customer, TUS Order #, Factory)
 * repeat on every page-group, and the remaining columns are chunked to fit
 * the page width without splitting an umbrella-grouped set of sub-columns
 * (e.g. Shop Drawings' Set 1-4/Final/Install Set) across two page-groups.
 * Each page-group then paginates vertically through every project, never
 * splitting a single project's block of sub-rows across a page break.
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

const WIDE = 95;
const MEDIUM = 60;
const NARROW = 30;

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
  simple('tusOrderNumber', 'TUS Order #', MEDIUM),
  simple('factory', 'Factory', MEDIUM),
  simple('standardProductType', 'ST', NARROW, 'Product Type'),
  simple('dadeCountyProductType', 'DC', NARROW, 'Product Type'),
  simple('doubleHungProductType', 'DH', NARROW, 'Product Type'),
  simple('screenFlag', 'Screen', NARROW, 'Roll System'),
  simple('lutronFlag', 'Lutron', NARROW, 'Roll System'),
  simple('checkFlag', 'Check', NARROW, 'Roll System'),
  simple('tischlerPM', 'Tischler PM', WIDE),
  simple('factoryPM', 'Factory PM', WIDE),
  simple('projectSalesman', 'Salesman', WIDE),
  simple('projectLocation', 'Location', WIDE),
  simple('woodSpecies', 'Wood Species', WIDE),
  simple('dcSilicone', 'DC Silicone', MEDIUM),
  simple('solarControl', 'Solar Ctrl', MEDIUM),
  simple('finishColor', 'Finish Color', WIDE),
  stacked('changeOrder', 'Change Order in Estim. / To Client', 4, MEDIUM),
  stacked('set1', 'Set 1', 5, NARROW, 'Shop Drawings'),
  stacked('set2', 'Set 2', 5, NARROW, 'Shop Drawings'),
  stacked('set3', 'Set 3', 5, NARROW, 'Shop Drawings'),
  stacked('set4', 'Set 4', 5, NARROW, 'Shop Drawings'),
  stacked('finalSet', 'Final', 5, NARROW, 'Shop Drawings'),
  stacked('installSet', 'Install Set', 5, NARROW, 'Shop Drawings'),
  stacked('jobStatusOrderDate', 'Job Status / Order Date', 3, MEDIUM),
  simple('onHoldUnits', 'On-Hold Units', MEDIUM),
  simple('customHardware', 'Custom Hardware', MEDIUM),
  stacked('factoryOC', 'Factory O.C.', 2, MEDIUM),
  stacked('installationMaterial', 'Installation Material', 2, MEDIUM),
  stacked('installationInstruction', 'Installation Instruction', 3, MEDIUM),
  stacked('shippingWeek', 'Shipping Week', 5, MEDIUM),
  stacked('estimatedDeliveryWeek', 'Estimated Delivery Wk', 5, MEDIUM),
  stacked('loadingListRF', 'RF', 5, NARROW, 'Loading List'),
  stacked('loadingListRS', 'RS', 5, NARROW, 'Loading List'),
  stacked('loadingListOF', 'OF', 5, NARROW, 'Loading List'),
  simple('completionSignOff', 'Completion Sign-off', MEDIUM),
];

/** Customer, TUS Order #, Factory — repeated as the first columns of every page-group. */
const FROZEN_COUNT = 3;

const ROW_HEIGHT = 13;
const HEADER_ROW1_HEIGHT = 14;
const HEADER_ROW2_HEIGHT = 26;
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

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Y' : '';
  return String(value);
}

/** Same rule as the web report: the highest Row index across all stacked
 * columns that actually has a value, at least 1. */
function subRowCountFor(project: Record<string, unknown>): number {
  let max = 1;
  for (const col of COLUMNS) {
    if (col.kind !== 'stacked') continue;
    for (let n = col.rowCount; n >= 1; n--) {
      const v = project[`${col.keyPrefix}Row${n}`];
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

/** Splits the non-frozen columns into page-groups that fit `usableWidth`
 * once the frozen columns' width is reserved, never splitting an
 * umbrella-grouped set of sub-columns across two page-groups. */
function buildPageGroups(usableWidth: number): Column[][] {
  const frozen = COLUMNS.slice(0, FROZEN_COUNT);
  const rest = COLUMNS.slice(FROZEN_COUNT);
  const frozenWidth = frozen.reduce((sum, c) => sum + c.width, 0);
  const budget = usableWidth - frozenWidth;

  const restGroups = headerGroupsFor(rest);
  const pageGroups: Column[][] = [];
  let current: Column[] = [];
  let currentWidth = 0;
  for (const group of restGroups) {
    const groupWidth = group.columns.reduce((sum, c) => sum + c.width, 0);
    if (current.length > 0 && currentWidth + groupWidth > budget) {
      pageGroups.push(current);
      current = [];
      currentWidth = 0;
    }
    current.push(...group.columns);
    currentWidth += groupWidth;
  }
  if (current.length > 0) pageGroups.push(current);
  return pageGroups.map(cols => [...frozen, ...cols]);
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

function drawTitle(
  doc: PDFKit.PDFDocument,
  groupIndex: number,
  groupCount: number,
  projectCount: number,
): void {
  const { left, top } = doc.page.margins;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(TITLE_COLOR);
  doc.text(`Project List Report — ${projectCount} project${projectCount === 1 ? '' : 's'}`, left, top, {
    continued: false,
  });
  doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  doc.text(
    groupCount > 1 ? `Columns ${groupIndex + 1} of ${groupCount}` : '',
    left,
    doc.y,
  );
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
        cellText(doc, col.label, sx, y0 + HEADER_ROW1_HEIGHT, col.width, HEADER_ROW2_HEIGHT, {
          bold: true,
          fontSize: HEADER_FONT_SIZE,
        });
        sx += col.width;
      }
    } else {
      const col = group.columns[0]!;
      cellRect(doc, x, y0, col.width, HEADER_HEIGHT, HEADER_FILL);
      cellText(doc, col.label, x, y0, col.width, HEADER_HEIGHT, {
        bold: true,
        fontSize: HEADER_FONT_SIZE,
      });
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
        const value = ri < column.rowCount ? project[`${column.keyPrefix}Row${ri + 1}`] : undefined;
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
      const pageGroups = buildPageGroups(usableWidth);

      pageGroups.forEach((columns, gi) => {
        if (gi > 0) doc.addPage();
        drawTitle(doc, gi, pageGroups.length, projects.length);
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
            drawTitle(doc, gi, pageGroups.length, projects.length);
            y = drawHeader(doc, columns, doc.page.margins.left, doc.y);
          }
          y = drawProjectBlock(doc, columns, project, pi, doc.page.margins.left, y, subRows);
        });
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
            align: 'right',
          });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
