/**
 * Server-side PDF renderer for the Proposal Builder using PDFKit.
 *
 * Consumes the output of `assembleProposal` from `@crm/proposal-assembly` and
 * emits a PDF binary. Supports inline bold/italic and bulleted/numbered lists
 * inside block bodies (via the html-to-runs walker).
 *
 * Phase 2 — accepts a BrandResources blob to override the default colors,
 * use a brand logo in the letterhead, and use a brand font for the closing
 * signature line. Anything not provided falls back to the Tischler defaults.
 */

import PDFDocument from 'pdfkit';
import type { ProposalAssemblyResult, SpecPresetData } from '@crm/proposal-assembly';
import { htmlToBlocks, type Block, type StyledRun } from './html-to-runs.js';

// ── Default brand constants ─────────────────────────────────────────

const DEFAULT_NAVY = '#1e3a5f';
const DEFAULT_RED = '#da291c';
const TEXT = '#1e1e1e';
const MUTED = '#505050';
const FAINT = '#808080';

const FONT_REGULAR = 'Helvetica';
const FONT_BOLD = 'Helvetica-Bold';
const FONT_ITALIC = 'Helvetica-Oblique';
const FONT_BOLD_ITALIC = 'Helvetica-BoldOblique';

const PAGE_MARGIN = 56; // ≈ 0.78"
const BODY_FONT_SIZE = 10;
const SECTION_HEADING_SIZE = 12;
const FOOTER_SIZE = 7;

// ── Brand resources, supplied per-render by the proposal-pdf route ──

export interface BrandResources {
  /** Hex string overriding the default navy used for headings/titles. */
  accentColor?: string;
  /** Hex string overriding the default red used for the letterhead rule + base bid line. */
  emphasisColor?: string;
  /** Raw bytes + mime for the letterhead image. */
  letterhead?: {
    bytes: Buffer;
    mimeType: string;
  };
  /** Font for the signature line in the closing. PDFKit registers the bytes
   *  under `family`; the renderer references it by that family name. */
  signatureFont?: {
    bytes: Buffer;
    family: string;
  };
}

interface BrandContext {
  navy: string;
  red: string;
  text: string;
  muted: string;
  faint: string;
  signatureFontFamily: string | null;
}

// ── Public API ──────────────────────────────────────────────────────

export async function renderProposalPDF(
  result: ProposalAssemblyResult,
  brand: BrandResources = {},
): Promise<Buffer> {
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

  // Register the signature font into THIS document so the renderer can use it
  // by name in `doc.font(...)`. PDFKit embeds it in the produced PDF so the
  // text renders correctly on any viewer.
  let signatureFontFamily: string | null = null;
  if (brand.signatureFont) {
    try {
      doc.registerFont(brand.signatureFont.family, brand.signatureFont.bytes);
      signatureFontFamily = brand.signatureFont.family;
    } catch {
      // Bad font bytes: silently fall back to Helvetica for the signature.
      signatureFontFamily = null;
    }
  }

  const ctx: BrandContext = {
    navy: normalizeHex(brand.accentColor) ?? DEFAULT_NAVY,
    red: normalizeHex(brand.emphasisColor) ?? DEFAULT_RED,
    text: TEXT,
    muted: MUTED,
    faint: FAINT,
    signatureFontFamily,
  };

  const constants = result.sections.CONSTANT ?? [];
  const specs = result.sections.SPECIFICATION ?? [];
  const options = result.sections.OPTION ?? [];
  const exclusions = result.sections.EXCLUSION ?? [];
  const installation = result.sections.INSTALLATION ?? [];

  const closingPresets = constants.filter((p) => isClosing(p));
  const introPresets = constants.filter((p) => !isClosing(p));

  drawLetterhead(doc, ctx, brand.letterhead);
  drawIntro(doc, introPresets);
  drawSpecifications(doc, specs, ctx);
  drawPricing(doc, result, ctx);
  drawOptions(doc, options, result, ctx);
  drawExclusions(doc, exclusions, ctx);
  drawClosing(doc, closingPresets, result, ctx);

  if (result.pdfData.hasInstallation) {
    doc.addPage();
    drawInstallationAppendix(doc, installation, result, ctx, brand.letterhead);
  }

  drawFooter(doc, ctx);

  doc.end();
  return done;
}

// ── Layout primitives ───────────────────────────────────────────────

function drawLetterhead(
  doc: PDFKit.PDFDocument,
  ctx: BrandContext,
  letterhead: BrandResources['letterhead'],
): void {
  // If a brand letterhead image is configured, draw it at the top — replacing
  // the text wordmark. Fits within the page width minus margins, scaled by
  // height to keep aspect ratio. Falls back to the text wordmark when no
  // logo is set.
  if (letterhead) {
    try {
      const maxWidth = doc.page.width - 2 * PAGE_MARGIN;
      // `fit` with a maxWidth scales to the available content area while
      // preserving aspect ratio. Default x-position with explicit PAGE_MARGIN
      // keeps the image aligned to the left edge of the body column.
      doc.image(letterhead.bytes, PAGE_MARGIN, doc.y, { fit: [maxWidth, 70] });
      doc.moveDown(5); // approximate the space the image took up
    } catch {
      // Fall through to text wordmark on any image-decode failure.
      drawTextWordmark(doc, ctx);
    }
  } else {
    drawTextWordmark(doc, ctx);
  }

  doc
    .moveDown(0.5)
    .strokeColor(ctx.red)
    .lineWidth(2)
    .moveTo(PAGE_MARGIN, doc.y)
    .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
    .stroke();
  doc.moveDown(1);
  doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
}

function drawTextWordmark(doc: PDFKit.PDFDocument, ctx: BrandContext): void {
  doc.fillColor(ctx.navy).font(FONT_BOLD).fontSize(20).text('TISCHLER UND SOHN', { lineGap: 2 });
  doc.fillColor(ctx.muted).font(FONT_REGULAR).fontSize(8).text('European Wood Windows & Doors');
}

function drawIntro(doc: PDFKit.PDFDocument, presets: SpecPresetData[]): void {
  if (presets.length === 0) return;
  for (const preset of presets) {
    drawRichBody(doc, preset.body ?? '', { topGap: 0.4 });
  }
}

function drawSpecifications(
  doc: PDFKit.PDFDocument,
  presets: SpecPresetData[],
  ctx: BrandContext,
): void {
  if (presets.length === 0) return;
  doc.moveDown(0.6);

  presets.forEach((preset, idx) => {
    doc.moveDown(0.4);
    doc.fillColor(ctx.navy).font(FONT_BOLD).fontSize(BODY_FONT_SIZE);
    const indexLabel = `(${idx + 1})`;
    doc.text(indexLabel, { continued: true, indent: 0 });
    doc.text(`  ${preset.title}`);

    if (preset.body && preset.body.trim()) {
      doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
      drawRichBody(doc, preset.body, { topGap: 0.1, indent: 18 });
    }
  });
}

function drawPricing(
  doc: PDFKit.PDFDocument,
  result: ProposalAssemblyResult,
  ctx: BrandContext,
): void {
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
    .fillColor(ctx.navy)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('PRICING', { lineGap: 2 });

  doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  for (const [label, price] of rows) {
    drawKeyValueRow(doc, label, price);
  }

  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(0.2);
  doc.fillColor(ctx.navy).font(FONT_BOLD).fontSize(BODY_FONT_SIZE + 1);
  drawKeyValueRow(doc, 'BASE BID PRICE', pdfData.grandTotal);
  doc.moveDown(0.2);
  drawHorizontalLine(doc);
  doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
}

function drawOptions(
  doc: PDFKit.PDFDocument,
  optionPresets: SpecPresetData[],
  result: ProposalAssemblyResult,
  ctx: BrandContext,
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
    .fillColor(ctx.navy)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('ADDITIONS OR DEDUCTIONS TO OUR BASE BID', { lineGap: 2 });

  doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  for (const [label, price] of addOnRows) {
    drawKeyValueRow(doc, `•  ${label}`, price);
  }

  for (const preset of optionPresets) {
    doc.moveDown(0.4);
    doc.fillColor(ctx.navy).font(FONT_BOLD).fontSize(BODY_FONT_SIZE).text(preset.title);
    if (preset.body && preset.body.trim()) {
      doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
      drawRichBody(doc, preset.body, { topGap: 0.1 });
    }
  }
}

function drawExclusions(
  doc: PDFKit.PDFDocument,
  presets: SpecPresetData[],
  ctx: BrandContext,
): void {
  if (presets.length === 0) return;
  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);
  doc
    .fillColor(ctx.navy)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('Our Base Bid does not include:', { lineGap: 2 });

  doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
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
  ctx: BrandContext,
): void {
  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);

  for (const preset of closingPresets) {
    drawRichBody(doc, preset.body ?? '', { topGap: 0.2 });
  }

  doc.moveDown(0.8).fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE).text('Sincerely,');

  const { salesman, estimator } = result.pdfData;

  // If we have a brand signature font + a salesman name, render the salesman's
  // name in that font (large, like a hand signature). Otherwise fall back to
  // the company line in bold navy. In both cases the typed name (Mr./title)
  // follows below.
  if (ctx.signatureFontFamily && salesman) {
    doc.moveDown(0.6).fillColor(ctx.navy).font(ctx.signatureFontFamily).fontSize(24).text(salesman);
    doc.fillColor(ctx.muted).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE - 1).text(salesman);
  } else {
    doc.moveDown(0.8).fillColor(ctx.navy).font(FONT_BOLD).fontSize(BODY_FONT_SIZE).text('Tischler und Sohn');
    if (salesman) {
      doc.fillColor(ctx.muted).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE - 1).text(salesman);
    }
  }

  if (estimator && estimator !== salesman) {
    doc.fillColor(ctx.muted).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE - 1).text(`Estimator: ${estimator}`);
  }
}

function drawInstallationAppendix(
  doc: PDFKit.PDFDocument,
  presets: SpecPresetData[],
  result: ProposalAssemblyResult,
  ctx: BrandContext,
  letterhead: BrandResources['letterhead'],
): void {
  drawLetterhead(doc, ctx, letterhead);
  doc
    .fillColor(ctx.navy)
    .font(FONT_BOLD)
    .fontSize(SECTION_HEADING_SIZE)
    .text('INSTALLATION', { lineGap: 2 });

  doc.fillColor(ctx.text).font(FONT_REGULAR).fontSize(BODY_FONT_SIZE);
  drawKeyValueRow(doc, 'Installation Cost:', result.pdfData.installationPrice, { bold: true });
  doc.moveDown(0.3);
  drawHorizontalLine(doc);

  for (const preset of presets) {
    doc.moveDown(0.4);
    doc.fillColor(ctx.navy).font(FONT_BOLD).text(preset.title);
    if (preset.body && preset.body.trim()) {
      doc.fillColor(ctx.text).font(FONT_REGULAR);
      drawRichBody(doc, preset.body, { topGap: 0.05, indent: 12 });
    }
  }
}

function drawFooter(doc: PDFKit.PDFDocument, ctx: BrandContext): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_MARGIN + 16;
    doc
      .fillColor(ctx.faint)
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

function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}
