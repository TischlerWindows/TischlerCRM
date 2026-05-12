/**
 * Server-side PDF renderer for the Proposal Builder using PDFKit.
 *
 * Consumes the output of `assembleProposal` from `@crm/proposal-assembly` and
 * emits a PDF binary. Supports inline bold/italic and bulleted/numbered lists
 * inside block bodies (via the html-to-runs walker).
 *
 * The layout mirrors the in-browser preview in spirit but is intentionally
 * simpler than the legacy jsPDF renderer — Phase 3 focuses on the rich-text
 * pipeline; layout polish lands in a follow-up.
 */

import PDFDocument from 'pdfkit';
import type { ProposalAssemblyResult, SpecPresetData } from '@crm/proposal-assembly';
import { htmlToBlocks, type Block, type StyledRun } from './html-to-runs.js';

// ── Brand constants (match the in-browser preview) ──────────────────

const NAVY: PDFKit.Mixins.ColorValue = '#1e3a5f';
const RED: PDFKit.Mixins.ColorValue = '#da291c';
const TEXT: PDFKit.Mixins.ColorValue = '#1e1e1e';
const MUTED: PDFKit.Mixins.ColorValue = '#505050';
const FAINT: PDFKit.Mixins.ColorValue = '#808080';

const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const FONT_BOLD_ITALIC = 'Helvetica-BoldOblique';

const PAGE_MARGIN = 56; // ≈ 0.78"
const BODY_FONT_SIZE = 10;
const SECTION_HEADING_SIZE = 12;
const FOOTER_SIZE = 7;

// ── Public API ──────────────────────────────────────────────────────

export async function renderProposalPDF(result: ProposalAssemblyResult): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    // Required so drawFooter() can iterate all pages via bufferedPageRange()/switchToPage().
    bufferPages: true,
    info: {
      Title: result.pdfData.projectName ? `${result.pdfData.projectName} — Proposal` : 'Tischler Proposal',
      Author: 'Tischler und Sohn',
    },
  });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const constants = result.sections.CONSTANT ?? [];
  const specs = result.sections.SPECIFICATION ?? [];
  const options = result.sections.OPTION ?? [];
  const exclusions = result.sections.EXCLUSION ?? [];
  const installation = result.sections.INSTALLATION ?? [];

  const closingPresets = constants.filter((p) => isClosing(p));
  const introPresets = constants.filter((p) => !isClosing(p));

  drawLetterhead(doc);
  drawIntro(doc, introPresets);
  drawSpecifications(doc, specs);
  drawPricing(doc, result);
  drawOptions(doc, options, result);
  drawExclusions(doc, exclusions);
  drawClosing(doc, closingPresets, result);

  if (result.pdfData.hasInstallation) {
    doc.addPage();
    drawInstallationAppendix(doc, installation, result);
  }

  drawFooter(doc);

  doc.end();
  return done;
}

// ── Layout primitives ───────────────────────────────────────────────

function drawLetterhead(doc: PDFKit.PDFDocument): void {
  // Header band: company name on the left, red rule below.
  // Logo intentionally omitted in this phase — would require asset loading.
  doc.fillColor(NAVY).font(FONT_BOLD).fontSize(20).text('TISCHLER UND SOHN', { lineGap: 2 });
  doc.fillColor(MUTED).font(FONT_REGULAR).fontSize(8).text('European Wood Windows & Doors');
  doc
    .moveDown(0.5)
    .strokeColor(RED)
    .lineWidth(2)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .stroke();
  doc.moveDown(1);
  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
}

function drawIntro(doc: PDFKit.PDFDocument, presets: SpecPresetData[]): void {
  if (presets.length === 0) return;
  for (const preset of presets) {
    drawRichBody(doc, preset.body ?? '', { topGap: 0.4 });
  }
}

function drawSpecifications(doc: PDFKit.PDFDocument, presets: SpecPresetData[]): void {
  if (presets.length === 0) return;
  doc.moveDown(0.6);

  presets.forEach((preset, idx) => {
    doc.moveDown(0.4);
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(BODY_FONT_SIZE);
    // Reference proposals use "(1) Title" with parens — looks more proposal-y
    // than "1. Title".
    const indexLabel = `(${idx + 1})`;
    doc.text(indexLabel, { continued: true, indent: 0 });
    doc.text(`  ${preset.title}`);

    if (preset.body && preset.body.trim()) {
      doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
      drawRichBody(doc, preset.body, { topGap: 0.1, indent: 18 });
    }
  });
}

function drawPricing(doc: PDFKit.PDFDocument, result: ProposalAssemblyResult): void {
  const { pdfData } = result;
  const rows: Array<[string, string]> = [];
  if (pdfData.hasEuroWindows) rows.push(['Euro Windows', pdfData.euroWindowsPrice]);
  if (pdfData.hasDoubleHung) rows.push(['Double Hung Windows', pdfData.doubleHungPrice]);
  if (pdfData.hasEuroDoors) rows.push(['Euro Doors', pdfData.euroDoorsPrice]);

  if (rows.length === 0 && !pdfData.grandTotal) return;

  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);
  doc
    .fillColor(NAVY)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('PRICING', { lineGap: 2 });

  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  for (const [label, price] of rows) {
    drawKeyValueRow(doc, label, price);
  }

  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(0.2);
  doc.fillColor(NAVY).font(FONT_BOLD).fontSize(BODY_FONT_SIZE + 1);
  drawKeyValueRow(doc, 'BASE BID PRICE', pdfData.grandTotal);
  doc.moveDown(0.2);
  drawHorizontalLine(doc);
  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
}

function drawOptions(
  doc: PDFKit.PDFDocument,
  optionPresets: SpecPresetData[],
  result: ProposalAssemblyResult,
): void {
  const { pdfData } = result;
  const addOnRows: Array<[string, string]> = [];
  if (pdfData.hasWindowScreens) addOnRows.push([`Window Screens (${pdfData.windowScreensQty})`, pdfData.windowScreensPrice]);
  if (pdfData.hasDoorScreenSash) addOnRows.push([`Door Screen Sash (${pdfData.doorScreenSashQty})`, pdfData.doorScreenSashPrice]);
  if (pdfData.hasEntryDoor) addOnRows.push([`Entry Door (${pdfData.entryDoorQty})`, pdfData.entryDoorPrice]);
  if (pdfData.hasJambExtensions) addOnRows.push(['Jamb Extensions', pdfData.jambExtensionsPrice]);
  if (pdfData.hasMagneticContacts) addOnRows.push([`Magnetic Alarm Contacts (${pdfData.magneticContactQty})`, pdfData.magneticContactPrice]);
  if (pdfData.hasFinalFinish) addOnRows.push(['Final Finish', pdfData.finalFinishPrice]);

  if (optionPresets.length === 0 && addOnRows.length === 0) return;

  doc.moveDown(0.8);
  doc
    .fillColor(NAVY)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('ADDITIONS OR DEDUCTIONS TO OUR BASE BID', { lineGap: 2 });

  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  for (const [label, price] of addOnRows) {
    drawKeyValueRow(doc, `•  ${label}`, price);
  }

  for (const preset of optionPresets) {
    doc.moveDown(0.4);
    doc.fillColor(NAVY).font(FONT_BOLD).fontSize(BODY_FONT_SIZE).text(preset.title);
    if (preset.body && preset.body.trim()) {
      doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
      drawRichBody(doc, preset.body, { topGap: 0.1 });
    }
  }
}

function drawExclusions(doc: PDFKit.PDFDocument, presets: SpecPresetData[]): void {
  if (presets.length === 0) return;
  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);
  doc
    .fillColor(NAVY)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('Our Base Bid does not include:', { lineGap: 2 });

  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  for (const preset of presets) {
    doc.moveDown(0.2);
    doc.font(FONT_BOLD).text(`•  ${preset.title}`);
    if (preset.body && preset.body.trim()) {
      doc.font(FONT_REGULAR);
      drawRichBody(doc, preset.body, { topGap: 0.05, indent: 12 });
    }
  }
}

function drawClosing(
  doc: PDFKit.PDFDocument,
  closingPresets: SpecPresetData[],
  result: ProposalAssemblyResult,
): void {
  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);

  for (const preset of closingPresets) {
    drawRichBody(doc, preset.body ?? '', { topGap: 0.2 });
  }

  doc.moveDown(0.8).fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE).text('Sincerely,');
  doc.moveDown(0.8).fillColor(NAVY).font(FONT_BOLD).text('Tischler und Sohn');

  const { salesman, estimator } = result.pdfData;
  if (salesman) doc.fillColor(MUTED).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE - 1).text(salesman);
  if (estimator && estimator !== salesman) {
    doc.fillColor(MUTED).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE - 1).text(`Estimator: ${estimator}`);
  }
}

function drawInstallationAppendix(
  doc: PDFKit.PDFDocument,
  presets: SpecPresetData[],
  result: ProposalAssemblyResult,
): void {
  drawLetterhead(doc);
  doc
    .fillColor(NAVY)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('INSTALLATION', { lineGap: 2 });

  doc.fillColor(TEXT).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  drawKeyValueRow(doc, 'Installation Cost:', result.pdfData.installationPrice, { bold: true });
  doc.moveDown(0.3);
  drawHorizontalLine(doc);

  for (const preset of presets) {
    doc.moveDown(0.4);
    doc.fillColor(NAVY).font(FONT_BOLD).text(preset.title);
    if (preset.body && preset.body.trim()) {
      doc.fillColor(TEXT).font(FONT_REGULAR);
      drawRichBody(doc, preset.body, { topGap: 0.05, indent: 12 });
    }
  }
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_MARGIN + 16;
    doc
      .fillColor(FAINT)
      .font(FONT_REGULAR)
      .fontSize(FOOTER_SIZE)
      .text(`Tischler und Sohn  |  Confidential`, PAGE_MARGIN, y, {
        width: doc.page.width - 2 * PAGE_MARGIN,
        align: 'center',
      });
    doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 60, y, {
      width: 60,
      align: 'right',
    });
  }
}

// ── Rich-text body rendering ────────────────────────────────────────

interface RichOpts {
  topGap?: number; // doc.moveDown(...) before drawing
  indent?: number; // left indent in pt
}

function drawRichBody(doc: PDFKit.PDFDocument, html: string, opts: RichOpts = {}): void {
  if (opts.topGap) doc.moveDown(opts.topGap);
  const indent = opts.indent ?? 0;
  const blocks = htmlToBlocks(html);

  for (const block of blocks) {
    drawBlock(doc, block, indent);
  }
}

function drawBlock(doc: PDFKit.PDFDocument, block: Block, indent: number): void {
  if (block.kind === 'paragraph') {
    drawStyledRuns(doc, block.runs, { indent, lineGap: 1 });
    return;
  }

  if (block.kind === 'bullet') {
    drawStyledRuns(doc, [{ text: '•  ', bold: false, italic: false }, ...block.runs], {
      indent,
      lineGap: 1,
    });
    return;
  }

  if (block.kind === 'number') {
    drawStyledRuns(
      doc,
      [{ text: `${block.index}.  `, bold: false, italic: false }, ...block.runs],
      { indent, lineGap: 1 },
    );
  }
}

function drawStyledRuns(
  doc: PDFKit.PDFDocument,
  runs: StyledRun[],
  opts: { indent: number; lineGap: number },
): void {
  if (runs.length === 0) {
    doc.text(' ', { indent: opts.indent });
    return;
  }
  const startX = PAGE_MARGIN + opts.indent;
  runs.forEach((run, i) => {
    const isLast = i === runs.length - 1;
    doc.font(fontFor(run));
    doc.text(run.text, { continued: !isLast, indent: i === 0 ? opts.indent : 0 });
    // Subsequent runs continue from where the last one stopped; no need to
    // explicitly set x. PDFKit handles the wrap.
    void startX; // referenced for clarity, intentionally unused
  });
}

function fontFor(run: StyledRun): string {
  if (run.bold && run.italic) return FONT_BOLD_ITALIC;
  if (run.bold) return FONT_BOLD;
  if (run.italic) return FONT_ITALIC;
  return FONT_REGULAR;
}

// ── Small helpers ───────────────────────────────────────────────────

function drawHorizontalLine(doc: PDFKit.PDFDocument): void {
  doc
    .strokeColor('#C8C8C8')
    .lineWidth(0.5)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .stroke();
}

function drawKeyValueRow(
  doc: PDFKit.PDFDocument,
  label: string,
  value: string,
  opts: { bold?: boolean } = {},
): void {
  const usable = doc.page.width - 2 * PAGE_MARGIN;
  doc.font(opts.bold ? FONT_BOLD : FONT_REGULAR);
  const y = doc.y;
  doc.text(label, PAGE_MARGIN, y, { continued: false, width: usable * 0.7 });
  doc.text(value, PAGE_MARGIN + usable * 0.7, y, {
    width: usable * 0.3,
    align: 'right',
  });
}

function isClosing(preset: SpecPresetData): boolean {
  return /closing|signature|sincerely/i.test(preset.title);
}
