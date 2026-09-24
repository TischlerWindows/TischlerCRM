/**
 * Server-side PDFKit renderer for the Project record's "Generate Master
 * Contact Sheet" button (apps/web/lib/master-contact-sheet.ts +
 * apps/web/components/record-detail/record-actions.tsx) — a form-style (not
 * tabular) printable project contact directory. Portrait, section header
 * bars + two-column label/value rows, auto-paginating when a page fills up.
 * Section/field content is fully driven by what the frontend sends so this
 * file has no per-section hardcoding beyond the visual layout.
 */
import PDFDocument from 'pdfkit';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const LOGO_PATH = join(dirname(fileURLToPath(import.meta.url)), 'tischler-logo.png');

export interface ContactSheetField {
  label: string;
  type: 'text' | 'phone' | 'email' | 'checkbox';
  value: unknown;
}

export interface ContactSheetSection {
  title: string;
  fields: ContactSheetField[];
}

const TITLE_COLOR = '#1e3a5f';
const SECTION_FILL = '#1e3a5f';
const BORDER_COLOR = '#cbd5e1';
const LABEL_COLOR = '#6b7280';
const VALUE_COLOR = '#111827';
const FONT_SIZE = 9;
const SECTION_HEADER_HEIGHT = 18;
const ROW_HEIGHT = 15;
const SECTION_GAP = 10;
const COLUMN_GAP = 16;

function formatValue(field: ContactSheetField): string {
  if (field.type === 'checkbox') return field.value ? 'Yes' : 'No';
  if (field.value === null || field.value === undefined || field.value === '') return '\u2014';
  return String(field.value);
}

function drawLogoHeader(doc: PDFKit.PDFDocument, projectName: string): number {
  const { left, top, right } = doc.page.margins;
  const usableWidth = doc.page.width - left - right;
  if (existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, left, top, { width: 100 });
  }
  doc.font('Helvetica-Bold').fontSize(14).fillColor(TITLE_COLOR);
  doc.text('Master Contact Sheet', left, top, { width: usableWidth, align: 'right' });
  doc.font('Helvetica').fontSize(10).fillColor(LABEL_COLOR);
  doc.text(projectName, left, doc.y, { width: usableWidth, align: 'right' });
  return top + 60;
}

/** Draws one section (header bar + its field rows) starting at (x, y) with
 * the given width. Returns the y just below it. */
function drawSection(doc: PDFKit.PDFDocument, section: ContactSheetSection, x: number, y: number, width: number): number {
  doc.rect(x, y, width, SECTION_HEADER_HEIGHT).fill(SECTION_FILL);
  doc.font('Helvetica-Bold').fontSize(FONT_SIZE).fillColor('#ffffff');
  doc.text(section.title, x + 4, y + 4, { width: width - 8 });
  let rowY = y + SECTION_HEADER_HEIGHT;

  const labelWidth = width * 0.38;
  const valueWidth = width - labelWidth - 8;
  for (const field of section.fields) {
    doc.font('Helvetica').fontSize(FONT_SIZE).fillColor(LABEL_COLOR);
    doc.text(field.label, x + 4, rowY + 4, { width: labelWidth - 4 });
    doc.font('Helvetica').fontSize(FONT_SIZE).fillColor(VALUE_COLOR);
    doc.text(formatValue(field), x + 4 + labelWidth, rowY + 4, { width: valueWidth });
    doc.lineWidth(0.4).strokeColor(BORDER_COLOR);
    doc.moveTo(x, rowY + ROW_HEIGHT).lineTo(x + width, rowY + ROW_HEIGHT).stroke();
    rowY += ROW_HEIGHT;
  }
  doc.lineWidth(0.6).strokeColor(BORDER_COLOR).rect(x, y, width, rowY - y).stroke();
  return rowY;
}

function sectionHeight(section: ContactSheetSection): number {
  return SECTION_HEADER_HEIGHT + section.fields.length * ROW_HEIGHT;
}

export async function renderMasterContactSheetPDF(projectName: string, sections: ContactSheetSection[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', layout: 'portrait', margin: 36, bufferPages: true });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = doc.page.height - doc.page.margins.bottom;
      const colWidth = (usableWidth - COLUMN_GAP) / 2;

      let y = drawLogoHeader(doc, projectName);
      // Two side-by-side columns of stacked sections — each column tracks
      // its own running y independently so a short right column doesn't
      // wait on a taller left column before starting its next section.
      let colY = [y, y];
      let col = 0;

      for (const section of sections) {
        const height = sectionHeight(section);
        if (colY[col]! + height > bottom) {
          if (col === 0) {
            col = 1;
          } else {
            doc.addPage();
            y = drawLogoHeader(doc, projectName);
            colY = [y, y];
            col = 0;
          }
        }
        const x = left + col * (colWidth + COLUMN_GAP);
        colY[col] = drawSection(doc, section, x, colY[col]!, colWidth) + SECTION_GAP;
      }

      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#9ca3af')
          .text(`Page ${i + 1} of ${range.count}`, doc.page.margins.left, doc.page.height - doc.page.margins.bottom + 12, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
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
