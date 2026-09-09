/**
 * Shared PDF generator for the Project List / Project List (Vertical Page)
 * widgets — both define the same field groups/keys, just rendered
 * differently on screen, so they share this one print output.
 */

export interface ProjectListPdfField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'checkbox' | 'select';
}
export interface ProjectListPdfColumn {
  title: string;
  fields: ProjectListPdfField[];
}
export interface ProjectListPdfGroup {
  title: string;
  columns: ProjectListPdfColumn[];
}

const NAVY = [30, 58, 95] as const;
const RED = [218, 41, 28] as const;
const TEXT = [31, 41, 55] as const;
const MUTED = [107, 114, 128] as const;
const LINE = [222, 226, 231] as const;
const PAGE_MARGIN = 16;
const PAGE_TOP = 18;
const PAGE_BOTTOM = 17;

function formatValue(field: ProjectListPdfField, raw: unknown): string {
  if (field.type === 'checkbox') return raw ? 'Yes' : 'No';
  if (field.type === 'date' && raw) {
    const match = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[2]}-${match[3]}-${match[1]}`;
  }
  if (raw === undefined || raw === null || raw === '') return '-';
  return String(raw);
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'ProjectList';
}

export async function generateProjectListPdf(params: {
  title: string;
  projectName: string;
  projectNumber?: string;
  groups: ProjectListPdfGroup[];
  values: Record<string, unknown>;
}): Promise<{ blob: Blob; filename: string }> {
  const { title, projectName, projectNumber, groups, values } = params;
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let cursorY = PAGE_TOP;

  const drawPageHeader = () => {
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('TISCHLER', PAGE_MARGIN, PAGE_TOP);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.8);
    doc.line(PAGE_MARGIN, PAGE_TOP + 3, pageWidth - PAGE_MARGIN, PAGE_TOP + 3);
    cursorY = PAGE_TOP + 10;
  };

  const addPage = () => {
    doc.addPage();
    drawPageHeader();
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height > pageHeight - PAGE_BOTTOM) addPage();
  };

  const CARD_GAP = 5;
  const CARD_WIDTH = (contentWidth - CARD_GAP) / 2;
  const CARD_HEADER_HEIGHT = 8;

  // Column titles duplicate each field's own label for the common
  // single-field case (e.g. column "TUS Order #" -> field "TUS Order #"),
  // and compound columns already bake their context into each field's own
  // label (e.g. "Change Order — Row 1") — so a group's fields are flattened
  // into one single-column list per card, matching the widget's own
  // one-field-per-row layout inside each "Order Info"/"Product Type" panel.
  const measureFieldHeight = (field: ProjectListPdfField, width: number): number => {
    const value = formatValue(field, values[field.key]);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(value, width - 6) as string[];
    return Math.max(11, 6 + lines.length * 4.2);
  };

  const measureCardHeight = (fields: ProjectListPdfField[], width: number): number => {
    let height = CARD_HEADER_HEIGHT;
    for (const field of fields) height += measureFieldHeight(field, width);
    return height;
  };

  const drawCard = (x: number, y: number, width: number, label: string, fields: ProjectListPdfField[]) => {
    const height = measureCardHeight(fields, width);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.rect(x, y, width, height);

    doc.setFillColor(242, 244, 247);
    doc.rect(x, y, width, CARD_HEADER_HEIGHT, 'F');
    doc.setTextColor(...TEXT);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x + 3, y + 5.5);

    let rowY = y + CARD_HEADER_HEIGHT;
    fields.forEach((field, index) => {
      const rowHeight = measureFieldHeight(field, width);
      const value = formatValue(field, values[field.key]);
      const lines = doc.splitTextToSize(value, width - 6) as string[];

      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(field.label.toUpperCase(), x + 3, rowY + 3.5);
      doc.setTextColor(...TEXT);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.text(lines, x + 3, rowY + 8.5);

      if (index < fields.length - 1) {
        doc.setDrawColor(...LINE);
        doc.setLineWidth(0.2);
        doc.line(x, rowY + rowHeight, x + width, rowY + rowHeight);
      }
      rowY += rowHeight;
    });
  };

  drawPageHeader();
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PROJECT', PAGE_MARGIN, cursorY);
  cursorY += 6;
  doc.setTextColor(...TEXT);
  doc.setFontSize(18);
  const heading = projectNumber ? `${projectNumber} (${projectName || 'Untitled'})` : (projectName || 'Untitled');
  doc.text(doc.splitTextToSize(`${heading} - ${title}`, contentWidth), PAGE_MARGIN, cursorY);
  cursorY += 11;
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString()}`, PAGE_MARGIN, cursorY);
  cursorY += 7;

  // Only groups with at least one populated field are shown, then paired
  // left/right exactly like the widget's own `grid-cols-2` layout (which
  // fills left-to-right, top-to-bottom in declaration order).
  const populatedGroups = groups
    .map((group) => ({ label: group.title, fields: group.columns.flatMap((column) => column.fields) }))
    .filter((group) => group.fields.some((field) => {
      const raw = values[field.key];
      return raw !== undefined && raw !== null && raw !== '' && raw !== false;
    }));

  for (let index = 0; index < populatedGroups.length; index += 2) {
    const left = populatedGroups[index]!;
    const right = populatedGroups[index + 1];
    const leftHeight = measureCardHeight(left.fields, CARD_WIDTH);
    const rightHeight = right ? measureCardHeight(right.fields, CARD_WIDTH) : 0;
    ensureSpace(Math.max(leftHeight, rightHeight));

    drawCard(PAGE_MARGIN, cursorY, CARD_WIDTH, left.label, left.fields);
    if (right) drawCard(PAGE_MARGIN + CARD_WIDTH + CARD_GAP, cursorY, CARD_WIDTH, right.label, right.fields);

    cursorY += Math.max(leftHeight, rightHeight) + CARD_GAP;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN, pageHeight - 12, pageWidth - PAGE_MARGIN, pageHeight - 12);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Project List Report', PAGE_MARGIN, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 7, { align: 'right' });
  }

  return {
    blob: doc.output('blob'),
    filename: `${safeFilename(heading)}_${safeFilename(title)}.pdf`,
  };
}
