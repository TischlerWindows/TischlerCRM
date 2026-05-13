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
import {
  resolveRulesForPage,
  inferBlockType,
  type BlockType,
  type PageLogoRule,
  type LetterheadConfig,
  type PricingTableConfig,
  type BaseBidLineConfig,
  type AdditionsTableConfig,
  type ExclusionsHeaderConfig,
  type ClosingSignatureConfig,
  type InstallationHeaderConfig,
  type FooterConfig,
} from '@crm/types';
import { htmlToBlocks, type Block, type StyledRun } from './html-to-runs.js';

// ── Default brand constants (match the Tischler brand guide 2025) ───

const DEFAULT_NAVY = '#151f6d'; // brand guide: Pantone 2756 C
const DEFAULT_RED = '#da291c'; // brand guide: Pantone 485 C
const TEXT = '#1e1e1e';
const MUTED = '#505050';
const FAINT = '#808080';

// Built-in PDFKit fonts, used as fallbacks when no brand font is set.
const FALLBACK_REGULAR = 'Helvetica';
const FALLBACK_BOLD = 'Helvetica-Bold';
const FALLBACK_ITALIC = 'Helvetica-Oblique';
const FALLBACK_BOLD_ITALIC = 'Helvetica-BoldOblique';

const PAGE_MARGIN = 56; // ≈ 0.78"
const BODY_FONT_SIZE = 10;
const SECTION_HEADING_SIZE = 12;
const FOOTER_SIZE = 7;

// ── Brand resources, supplied per-render by the proposal-pdf route ──
//
// One font per role matches the Tischler brand guide:
//   - title    → wordmark / big headers (brand guide: Helvetica Neue Bold Condensed)
//   - subtitle → tagline under wordmark (brand guide: ITC Fenice Regular)
//   - heading  → section headings, spec titles (brand guide: Aileron Heavy)
//   - body     → paragraph text (brand guide: Aileron Regular)
//   - signature→ the salesman's name in closing (script/cursive font)
//
// All are optional. Anything unset falls back to a Helvetica variant.

export interface BrandFontFile {
  bytes: Buffer;
  /** Family name PDFKit registers under; the renderer references it by name. */
  family: string;
}

/**
 * One per-page logo paint instruction. The route resolves a `PageLogoRule`
 * to a `PageLogoFile` (rule + decoded bytes) before passing it in. A rule
 * whose logo can no longer be found in the DB is filtered out upstream.
 */
export interface PageLogoFile {
  rule: PageLogoRule;
  bytes: Buffer;
  mimeType: string;
}

export interface BrandResources {
  /** Hex string overriding the default navy used for headings/titles. */
  accentColor?: string;
  /** Hex string overriding the default red used for the letterhead rule + base bid line. */
  emphasisColor?: string;
  /** Per-page logo rules + their decoded image bytes. */
  pageLogos?: PageLogoFile[];
  /** Salesman signature font (script). */
  signatureFont?: BrandFontFile;
  /** Wordmark / big-headline font. */
  titleFont?: BrandFontFile;
  /** Subtitle font (tagline under wordmark). */
  subtitleFont?: BrandFontFile;
  /** Section-heading / spec-title bold font. */
  headingFont?: BrandFontFile;
  /** Body-paragraph regular font. */
  bodyFont?: BrandFontFile;
}

interface FontMap {
  regular: string;     // body text
  bold: string;        // headings, bold inline runs
  italic: string;      // italic inline runs (always Helvetica-Oblique — no brand italic)
  boldItalic: string;  // bold-italic inline runs
  title: string;       // letterhead wordmark
  subtitle: string;    // letterhead tagline
  signature: string | null; // salesman signature; null = use the company-line fallback
}

interface BrandContext {
  navy: string;
  red: string;
  text: string;
  muted: string;
  faint: string;
  fonts: FontMap;
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

  // Register each brand font into THIS document under a stable internal key
  // so the renderer can reference them by name in `doc.font(...)`. PDFKit
  // embeds the bytes into the produced PDF so the text renders correctly on
  // every viewer. Each role registers independently — if any font fails to
  // decode, that ONE role falls back to Helvetica; the rest still work.
  const register = (file: BrandFontFile | undefined, key: string): string | null => {
    if (!file) return null;
    try {
      doc.registerFont(key, file.bytes);
      return key;
    } catch {
      return null;
    }
  };
  const signatureFamily = register(brand.signatureFont, '__brand_signature__');
  const titleFamily     = register(brand.titleFont, '__brand_title__');
  const subtitleFamily  = register(brand.subtitleFont, '__brand_subtitle__');
  const headingFamily   = register(brand.headingFont, '__brand_heading__');
  const bodyFamily      = register(brand.bodyFont, '__brand_body__');

  const fonts: FontMap = {
    regular: bodyFamily ?? FALLBACK_REGULAR,
    bold: headingFamily ?? FALLBACK_BOLD,
    italic: FALLBACK_ITALIC,
    boldItalic: FALLBACK_BOLD_ITALIC,
    title: titleFamily ?? headingFamily ?? FALLBACK_BOLD,
    subtitle: subtitleFamily ?? bodyFamily ?? FALLBACK_REGULAR,
    signature: signatureFamily,
  };

  const ctx: BrandContext = {
    navy: normalizeHex(brand.accentColor) ?? DEFAULT_NAVY,
    red: normalizeHex(brand.emphasisColor) ?? DEFAULT_RED,
    text: TEXT,
    muted: MUTED,
    faint: FAINT,
    fonts,
  };

  // ── In-order block dispatch ─────────────────────────────────────
  // Each preset declares (or implicitly inherits via section) a BlockType.
  // The renderer walks the resolved presets in declaration order and
  // dispatches to per-type drawers — there's no global section grouping.
  //
  // Two counters live alongside the loop:
  //   - specCounter: running (1)(2)(3) prefix for SPECIFICATION_ITEM blocks
  //   - footerOverride: latest FOOTER block's config, applied in post-pass
  let specCounter = 0;
  let footerOverride: FooterConfig | null = null;
  let letterheadDrawn = false;

  for (const ob of result.orderedBlocks) {
    const preset = ob.preset;
    const type: BlockType = (preset.blockType as BlockType | null) ??
      inferBlockType(preset.section, preset.title);
    const config = (preset.config ?? {}) as Record<string, unknown>;

    switch (type) {
      case 'LETTERHEAD':
        drawLetterheadBlock(doc, ctx, config as LetterheadConfig);
        letterheadDrawn = true;
        break;
      case 'FREE_TEXT':
        drawFreeTextBlock(doc, preset, ctx);
        break;
      case 'SPECIFICATION_ITEM':
        specCounter += 1;
        drawSpecificationItem(doc, preset, specCounter, ctx);
        break;
      case 'OPTION_ITEM':
        drawOptionItem(doc, preset, ctx);
        break;
      case 'EXCLUSION_ITEM':
        drawExclusionItem(doc, preset, ctx);
        break;
      case 'INSTALLATION_ITEM':
        drawInstallationItem(doc, preset, ctx);
        break;
      case 'PRICING_TABLE':
        drawPricingTableBlock(doc, config as PricingTableConfig, result, ctx);
        break;
      case 'BASE_BID_LINE':
        drawBaseBidBlock(doc, config as BaseBidLineConfig, result, ctx);
        break;
      case 'ADDITIONS_TABLE':
        drawAdditionsBlock(doc, config as AdditionsTableConfig, result, ctx);
        break;
      case 'EXCLUSIONS_HEADER':
        drawExclusionsHeaderBlock(doc, config as ExclusionsHeaderConfig, ctx);
        break;
      case 'CLOSING_SIGNATURE':
        drawClosingSignatureBlock(doc, config as ClosingSignatureConfig, result, ctx);
        break;
      case 'PAGE_BREAK':
        doc.addPage();
        break;
      case 'INSTALLATION_HEADER':
        drawInstallationHeaderBlock(doc, config as InstallationHeaderConfig, result, ctx);
        break;
      case 'FOOTER':
        footerOverride = config as FooterConfig;
        break;
    }
  }

  // Post-pass: paint per-page logos now that total page count is known.
  // Page-1 logo painting requires the renderer to have left a header
  // band at the top of the page — done by LETTERHEAD blocks. If no
  // letterhead block existed, page 1 starts at the page margin and logo
  // overlays may bleed into content. That's fine — admins who want logos
  // up top should include a LETTERHEAD block.
  void letterheadDrawn;
  drawPageLogos(doc, ctx, brand.pageLogos ?? []);
  drawFooter(doc, ctx, footerOverride);

  doc.end();
  return done;
}

// ── Layout primitives ───────────────────────────────────────────────

/**
 * Post-pass — switches to each buffered page in turn and paints any
 * matching per-page logo rules. Runs after all content is laid out so
 * total page count is known and "last"/"rest" selectors resolve.
 *
 * When zero rules match page 1, falls back to the text wordmark so the
 * letterhead area is never blank for templates with no logos configured.
 */
function drawPageLogos(
  doc: PDFKit.PDFDocument,
  ctx: BrandContext,
  pageLogos: PageLogoFile[],
): void {
  const range = doc.bufferedPageRange();
  const totalPages = range.count;
  const rules = pageLogos.map((p) => p.rule);
  const byId = new Map(pageLogos.map((p) => [p.rule.id, p]));

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(range.start + i);
    const pageNumber = i + 1;
    const matched = resolveRulesForPage(rules, pageNumber, totalPages);

    if (matched.length === 0) continue;

    for (const rule of matched) {
      const file = byId.get(rule.id);
      if (!file) continue;
      try {
        const maxWidth = rule.maxWidthPt;
        const maxHeight = rule.maxHeightPt;
        const x =
          rule.alignment === 'left'
            ? PAGE_MARGIN
            : rule.alignment === 'right'
              ? doc.page.width - PAGE_MARGIN - maxWidth
              : (doc.page.width - maxWidth) / 2;
        const y =
          rule.position === 'header'
            ? PAGE_MARGIN
            : doc.page.height - PAGE_MARGIN - maxHeight - 20;
        doc.image(file.bytes, x, y, { fit: [maxWidth, maxHeight] });
      } catch {
        // Skip a broken logo — don't fail the whole PDF.
      }
    }
  }
}

// ── Per-block drawers ───────────────────────────────────────────────
//
// Each function corresponds to a BlockType. The orchestration loop in
// renderProposalPDF picks one based on the preset's blockType (or the
// section-based inference for legacy data) and passes the type-specific
// config. All space management (moveDown / horizontal rules) lives
// inside the drawer so blocks can be reordered freely.

function drawLetterheadBlock(
  doc: PDFKit.PDFDocument,
  ctx: BrandContext,
  config: LetterheadConfig,
): void {
  // Reserve ~70pt of vertical space — page-logo post-pass paints into it.
  // When no first-page logo rule matches, we draw the wordmark fallback
  // inline (overlaps the reserved band but only one of the two ever
  // renders text).
  const wordmark = config.wordmarkText ?? 'TISCHLER UND SOHN';
  const tagline = config.taglineText ?? 'European Wood Windows & Doors';
  const showRule = config.showRule !== false;

  doc.fillColor(ctx.navy).font(ctx.fonts.title).fontSize(20).text(wordmark, { lineGap: 2 });
  doc.fillColor(ctx.muted).font(ctx.fonts.subtitle).fontSize(8).text(tagline);

  if (showRule) {
    doc.moveDown(0.5)
      .strokeColor(ctx.red)
      .lineWidth(2)
      .moveTo(PAGE_MARGIN, doc.y)
      .lineTo(doc.page.width - PAGE_MARGIN, doc.y)
      .stroke();
    doc.moveDown(1);
  }
  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
}

function drawFreeTextBlock(
  doc: PDFKit.PDFDocument,
  preset: SpecPresetData,
  ctx: BrandContext,
): void {
  if (preset.title && preset.title.trim()) {
    doc.moveDown(0.4);
    doc.fillColor(ctx.navy).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE).text(preset.title);
  }
  if (preset.body && preset.body.trim()) {
    doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
    drawRichBody(doc, preset.body, ctx, { topGap: preset.title ? 0.1 : 0.4 });
  }
}

function drawSpecificationItem(
  doc: PDFKit.PDFDocument,
  preset: SpecPresetData,
  number: number,
  ctx: BrandContext,
): void {
  doc.moveDown(0.4);
  doc.fillColor(ctx.navy).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE);
  doc.text(`(${number})`, { continued: true, indent: 0 });
  doc.text(`  ${preset.title}`);

  if (preset.body && preset.body.trim()) {
    doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
    drawRichBody(doc, preset.body, ctx, { topGap: 0.1, indent: 18 });
  }
}

function drawOptionItem(
  doc: PDFKit.PDFDocument,
  preset: SpecPresetData,
  ctx: BrandContext,
): void {
  doc.moveDown(0.4);
  doc.fillColor(ctx.navy).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE).text(preset.title);
  if (preset.body && preset.body.trim()) {
    doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
    drawRichBody(doc, preset.body, ctx, { topGap: 0.1 });
  }
}

function drawExclusionItem(
  doc: PDFKit.PDFDocument,
  preset: SpecPresetData,
  ctx: BrandContext,
): void {
  doc.moveDown(0.2);
  doc.fillColor(ctx.text).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE).text(`•  ${preset.title}`);
  if (preset.body && preset.body.trim()) {
    doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
    drawRichBody(doc, preset.body, ctx, { topGap: 0.05, indent: 12 });
  }
}

function drawInstallationItem(
  doc: PDFKit.PDFDocument,
  preset: SpecPresetData,
  ctx: BrandContext,
): void {
  doc.moveDown(0.4);
  doc.fillColor(ctx.navy).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE).text(preset.title);
  if (preset.body && preset.body.trim()) {
    doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
    drawRichBody(doc, preset.body, ctx, { topGap: 0.05, indent: 12 });
  }
}

function drawPricingTableBlock(
  doc: PDFKit.PDFDocument,
  config: PricingTableConfig,
  result: ProposalAssemblyResult,
  ctx: BrandContext,
): void {
  const { pdfData } = result;
  const heading = config.heading ?? 'PRICING';
  const rowLabels = config.rowLabels ?? {};
  const hide = config.hide ?? {};

  const rows: Array<[string, string]> = [];
  if (pdfData.hasEuroWindows && !hide.euroWindows) {
    rows.push([rowLabels.euroWindows ?? 'Euro Windows', pdfData.euroWindowsPrice]);
  }
  if (pdfData.hasDoubleHung && !hide.doubleHung) {
    rows.push([rowLabels.doubleHung ?? 'Double Hung Windows', pdfData.doubleHungPrice]);
  }
  if (pdfData.hasEuroDoors && !hide.euroDoors) {
    rows.push([rowLabels.euroDoors ?? 'Euro Doors', pdfData.euroDoorsPrice]);
  }

  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);
  doc
    .fillColor(ctx.navy)
    .font(ctx.fonts.bold)
    .fontSize(SECTION_HEADING_SIZE)
    .text(heading, { lineGap: 2 });

  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
  for (const [label, price] of rows) {
    drawKeyValueRow(doc, ctx, label, price);
  }
}

function drawBaseBidBlock(
  doc: PDFKit.PDFDocument,
  config: BaseBidLineConfig,
  result: ProposalAssemblyResult,
  ctx: BrandContext,
): void {
  const label = config.label ?? 'BASE BID PRICE';
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
  doc.moveDown(0.2);
  doc.fillColor(ctx.navy).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE + 1);
  drawKeyValueRow(doc, ctx, label, result.pdfData.grandTotal);
  doc.moveDown(0.2);
  drawHorizontalLine(doc);
  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
}

function drawAdditionsBlock(
  doc: PDFKit.PDFDocument,
  config: AdditionsTableConfig,
  result: ProposalAssemblyResult,
  ctx: BrandContext,
): void {
  const { pdfData } = result;
  const heading = config.heading ?? 'ADDITIONS OR DEDUCTIONS TO OUR BASE BID';
  const rowLabels = config.rowLabels ?? {};
  const hide = config.hide ?? {};

  const addOnRows: Array<[string, string]> = [];
  if (pdfData.hasWindowScreens && !hide.windowScreens) {
    addOnRows.push([
      rowLabels.windowScreens ?? `Window Screens (${pdfData.windowScreensQty})`,
      pdfData.windowScreensPrice,
    ]);
  }
  if (pdfData.hasDoorScreenSash && !hide.doorScreenSash) {
    addOnRows.push([
      rowLabels.doorScreenSash ?? `Door Screen Sash (${pdfData.doorScreenSashQty})`,
      pdfData.doorScreenSashPrice,
    ]);
  }
  if (pdfData.hasEntryDoor && !hide.entryDoor) {
    addOnRows.push([
      rowLabels.entryDoor ?? `Entry Door (${pdfData.entryDoorQty})`,
      pdfData.entryDoorPrice,
    ]);
  }
  if (pdfData.hasJambExtensions && !hide.jambExtensions) {
    addOnRows.push([
      rowLabels.jambExtensions ?? 'Jamb Extensions',
      pdfData.jambExtensionsPrice,
    ]);
  }
  if (pdfData.hasMagneticContacts && !hide.magneticContacts) {
    addOnRows.push([
      rowLabels.magneticContacts ?? `Magnetic Alarm Contacts (${pdfData.magneticContactQty})`,
      pdfData.magneticContactPrice,
    ]);
  }
  if (pdfData.hasFinalFinish && !hide.finalFinish) {
    addOnRows.push([rowLabels.finalFinish ?? 'Final Finish', pdfData.finalFinishPrice]);
  }

  doc.moveDown(0.8);
  doc
    .fillColor(ctx.navy)
    .font(ctx.fonts.bold)
    .fontSize(SECTION_HEADING_SIZE)
    .text(heading, { lineGap: 2 });

  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
  for (const [label, price] of addOnRows) {
    drawKeyValueRow(doc, ctx, `•  ${label}`, price);
  }
}

function drawExclusionsHeaderBlock(
  doc: PDFKit.PDFDocument,
  config: ExclusionsHeaderConfig,
  ctx: BrandContext,
): void {
  const heading = config.heading ?? 'Our Base Bid does not include:';
  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);
  doc
    .fillColor(ctx.navy)
    .font(ctx.fonts.bold)
    .fontSize(SECTION_HEADING_SIZE)
    .text(heading, { lineGap: 2 });
  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
}

function drawClosingSignatureBlock(
  doc: PDFKit.PDFDocument,
  config: ClosingSignatureConfig,
  result: ProposalAssemblyResult,
  ctx: BrandContext,
): void {
  const closingText = config.closingText ?? 'Sincerely,';
  const companyLine = config.companyLine ?? 'Tischler und Sohn';
  const useSignatureFont = config.useSignatureFont !== false;
  const showEstimator = config.showEstimator !== false;

  doc.moveDown(0.8);
  drawHorizontalLine(doc);
  doc.moveDown(0.3);

  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE).text(closingText);

  const { salesman, estimator } = result.pdfData;

  if (useSignatureFont && ctx.fonts.signature && salesman) {
    doc.moveDown(0.6).fillColor(ctx.navy).font(ctx.fonts.signature).fontSize(24).text(salesman);
    doc.fillColor(ctx.muted).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE - 1).text(salesman);
  } else {
    doc.moveDown(0.8).fillColor(ctx.navy).font(ctx.fonts.bold).fontSize(BODY_FONT_SIZE).text(companyLine);
    if (salesman) {
      doc.fillColor(ctx.muted).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE - 1).text(salesman);
    }
  }

  if (showEstimator && estimator && estimator !== salesman) {
    doc.fillColor(ctx.muted).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE - 1).text(`Estimator: ${estimator}`);
  }
}

function drawInstallationHeaderBlock(
  doc: PDFKit.PDFDocument,
  config: InstallationHeaderConfig,
  result: ProposalAssemblyResult,
  ctx: BrandContext,
): void {
  const heading = config.heading ?? 'INSTALLATION';
  const costLabel = config.costLabel ?? 'Installation Cost:';

  doc
    .fillColor(ctx.navy)
    .font(ctx.fonts.bold)
    .fontSize(SECTION_HEADING_SIZE)
    .text(heading, { lineGap: 2 });

  doc.fillColor(ctx.text).font(ctx.fonts.regular).fontSize(BODY_FONT_SIZE);
  drawKeyValueRow(doc, ctx, costLabel, result.pdfData.installationPrice, { bold: true });
  doc.moveDown(0.3);
  drawHorizontalLine(doc);
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  ctx: BrandContext,
  override: FooterConfig | null,
): void {
  const text = override?.text ?? 'Tischler und Sohn  |  Confidential';
  const hidePageNumbers = override?.hidePageNumbers === true;

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_MARGIN + 16;
    doc
      .fillColor(ctx.faint)
      .font(ctx.fonts.regular)
      .fontSize(FOOTER_SIZE)
      .text(text, PAGE_MARGIN, y, {
        width: doc.page.width - 2 * PAGE_MARGIN,
        align: 'center',
      });
    if (!hidePageNumbers) {
      doc.text(`Page ${i + 1} of ${range.count}`, doc.page.width - PAGE_MARGIN - 60, y, {
        width: 60,
        align: 'right',
      });
    }
  }
}

// ── Rich-text body rendering ────────────────────────────────────────

interface RichOpts {
  topGap?: number; // doc.moveDown(...) before drawing
  indent?: number; // left indent in pt
}

function drawRichBody(
  doc: PDFKit.PDFDocument,
  html: string,
  ctx: BrandContext,
  opts: RichOpts = {},
): void {
  if (opts.topGap) doc.moveDown(opts.topGap);
  const indent = opts.indent ?? 0;
  const blocks = htmlToBlocks(html);

  for (const block of blocks) {
    drawBlock(doc, block, ctx, indent);
  }
}

function drawBlock(doc: PDFKit.PDFDocument, block: Block, ctx: BrandContext, indent: number): void {
  if (block.kind === 'paragraph') {
    drawStyledRuns(doc, block.runs, ctx, { indent, lineGap: 1 });
    return;
  }

  if (block.kind === 'bullet') {
    drawStyledRuns(doc, [{ text: '•  ', bold: false, italic: false }, ...block.runs], ctx, {
      indent,
      lineGap: 1,
    });
    return;
  }

  if (block.kind === 'number') {
    drawStyledRuns(
      doc,
      [{ text: `${block.index}.  `, bold: false, italic: false }, ...block.runs],
      ctx,
      { indent, lineGap: 1 },
    );
  }
}

function drawStyledRuns(
  doc: PDFKit.PDFDocument,
  runs: StyledRun[],
  ctx: BrandContext,
  opts: { indent: number; lineGap: number },
): void {
  if (runs.length === 0) {
    doc.text(' ', { indent: opts.indent });
    return;
  }
  const startX = PAGE_MARGIN + opts.indent;
  runs.forEach((run, i) => {
    const isLast = i === runs.length - 1;
    doc.font(fontFor(run, ctx.fonts));
    doc.text(run.text, { continued: !isLast, indent: i === 0 ? opts.indent : 0 });
    // Subsequent runs continue from where the last one stopped; no need to
    // explicitly set x. PDFKit handles the wrap.
    void startX; // referenced for clarity, intentionally unused
  });
}

function fontFor(run: StyledRun, fonts: FontMap): string {
  if (run.bold && run.italic) return fonts.boldItalic;
  if (run.bold) return fonts.bold;
  if (run.italic) return fonts.italic;
  return fonts.regular;
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
  ctx: BrandContext,
  label: string,
  value: string,
  opts: { bold?: boolean } = {},
): void {
  const usable = doc.page.width - 2 * PAGE_MARGIN;
  doc.font(opts.bold ? ctx.fonts.bold : ctx.fonts.regular);
  const y = doc.y;
  doc.text(label, PAGE_MARGIN, y, { continued: false, width: usable * 0.7 });
  doc.text(value, PAGE_MARGIN + usable * 0.7, y, {
    width: usable * 0.3,
    align: 'right',
  });
}

function normalizeHex(input: string | undefined | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}
