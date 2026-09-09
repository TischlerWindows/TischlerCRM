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

  const drawGroupHeading = (label: string) => {
    ensureSpace(16);
    cursorY += 3;
    doc.setFillColor(...NAVY);
    doc.rect(PAGE_MARGIN, cursorY, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), PAGE_MARGIN + 3, cursorY + 6.5);
    // Clearance below the bar generous enough for a field label's ascenders
    // to never visually collide with the bar's bottom edge.
    cursorY += 15;
  };

  // Column titles duplicate each field's own label for the common
  // single-field case (e.g. column "TUS Order #" -> field "TUS Order #"),
  // and compound columns already bake their context into each field's own
  // label (e.g. "Change Order — Row 1") — so columns are flattened into one
  // field list per group instead of a separate title + fields.
  const drawFieldRows = (fields: ProjectListPdfField[]) => {
    const gap = 5;
    const columnWidth = (contentWidth - gap) / 2;
    for (let index = 0; index < fields.length; index += 2) {
      const pair = fields.slice(index, index + 2);
      const cells = pair.map((field) => {
        const value = formatValue(field, values[field.key]);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        return { field, value, lines: doc.splitTextToSize(value, columnWidth - 4) as string[] };
      });
      const rowHeight = Math.max(11, ...cells.map((cell) => 6 + cell.lines.length * 4.2));
      ensureSpace(rowHeight + 1);

      cells.forEach((cell, columnIndex) => {
        const x = PAGE_MARGIN + columnIndex * (columnWidth + gap);
        doc.setTextColor(...MUTED);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.text(cell.field.label.toUpperCase(), x, cursorY + 3);
        doc.setTextColor(...TEXT);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.text(cell.lines, x, cursorY + 8);
      });

      doc.setDrawColor(...LINE);
      doc.setLineWidth(0.2);
      doc.line(PAGE_MARGIN, cursorY + rowHeight, pageWidth - PAGE_MARGIN, cursorY + rowHeight);
      cursorY += rowHeight + 1;
    }
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

  for (const group of groups) {
    const fields = group.columns.flatMap((column) => column.fields);
    const hasAnyValue = fields.some((field) => {
      const raw = values[field.key];
      return raw !== undefined && raw !== null && raw !== '' && raw !== false;
    });
    if (!hasAnyValue) continue;
    drawGroupHeading(group.title);
    drawFieldRows(fields);
    cursorY += 3;
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
