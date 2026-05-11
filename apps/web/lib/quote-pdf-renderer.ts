/**
 * Proposal PDF Renderer
 *
 * Generates a professional proposal PDF using jsPDF.
 * The proposal follows the Tischler und Sohn format with:
 *   1. Letterhead + date + addressee + salutation + opening
 *   2. Numbered specifications
 *   3. Category pricing breakdown + BASE BID PRICE
 *   4. Options + Exclusions + closing
 *   5. Installation page (conditional)
 */

import type { SpecPresetData } from './quote-conditions';

// ── Types ──────────────────────────────────────────────────────────

export interface QuotePDFData {
  // People
  contactName: string;
  contactSalutation: string; // "Mr." or "Ms."
  contactLastName: string;
  companyName: string;
  companyAddress: string;

  // Project
  projectName: string;
  projectNumber: string;
  plansDated: string; // formatted date string
  jobType: string;
  address: string;
  salesman: string;
  estimator: string;

  // Materials
  glassType: string;
  woodType: string;
  finishType: string;
  sdlType: string;
  spacerBarColors: string;

  // Presets (already filtered and token-resolved)
  constantPresets?: SpecPresetData[];
  specPresets: SpecPresetData[];
  optionPresets: SpecPresetData[];
  exclusionPresets: SpecPresetData[];
  installationPresets: SpecPresetData[];

  // Pricing
  euroWindowsPrice: string; // formatted dollar string
  doubleHungPrice: string;
  euroDoorsPrice: string;
  grandTotal: string;
  hasEuroWindows: boolean;
  hasDoubleHung: boolean;
  hasEuroDoors: boolean;

  // Add-on pricing
  windowScreensPrice: string;
  windowScreensQty: string;
  doorScreenSashPrice: string;
  doorScreenSashQty: string;
  entryDoorPrice: string;
  entryDoorQty: string;
  jambExtensionsPrice: string;
  magneticContactPrice: string;
  magneticContactQty: string;
  finalFinishPrice: string;
  installationPrice: string;

  // Flags
  hasInstallation: boolean;
  hasMagneticContacts: boolean;
  hasFinalFinish: boolean;
  hasWindowScreens: boolean;
  hasDoorScreenSash: boolean;
  hasEntryDoor: boolean;
  hasJambExtensions: boolean;
}

// ── Brand constants ────────────────────────────────────────────────

const NAVY: [number, number, number] = [30, 58, 95];
const RED: [number, number, number] = [218, 41, 28];
const DARK: [number, number, number] = [30, 30, 30];
const GRAY50: [number, number, number] = [80, 80, 80];
const GRAY80: [number, number, number] = [128, 128, 128];
const GRAY_LINE: [number, number, number] = [200, 200, 200];

const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;

// ── Helpers ────────────────────────────────────────────────────────

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch('/tces-logo.png');
    const blob = await res.blob();
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function todayFormatted(): string {
  return new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// ── Main renderer ──────────────────────────────────────────────────

export async function generateQuotePDF(
  data: QuotePDFData,
  mode: 'download' | 'preview' = 'download',
  previewWindow?: Window | null
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const logoDataUrl = await loadLogo();

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pw = doc.internal.pageSize.getWidth(); // 215.9mm
  const ph = doc.internal.pageSize.getHeight(); // 279.4mm
  const contentWidth = pw - MARGIN_LEFT - MARGIN_RIGHT;
  const maxY = ph - 18; // leave room for footer

  let y = 0;
  const constantPresets = data.constantPresets ?? [];
  const closingConstant = constantPresets.filter((preset) =>
    /closing|signature|sincerely/i.test(preset.title)
  );
  const introConstant = constantPresets.filter((preset) =>
    !closingConstant.some((closing) => closing.id === preset.id)
  );

  // ── Drawing helpers (scoped to this doc) ──────────────────────

  const ensureSpace = (needed: number) => {
    if (y + needed > maxY) {
      addPage();
    }
  };

  const addPage = () => {
    doc.addPage();
    y = 20;
  };

  const drawPageFooter = () => {
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...GRAY80);
      doc.text('Tischler und Sohn  |  Confidential', pw / 2, ph - 8, { align: 'center' });
      doc.text(`Page ${i} of ${totalPages}`, pw - MARGIN_RIGHT, ph - 8, { align: 'right' });
    }
  };

  const drawRedLine = (yPos: number) => {
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_LEFT, yPos, pw - MARGIN_RIGHT, yPos);
  };

  const drawGrayLine = (yPos: number) => {
    doc.setDrawColor(...GRAY_LINE);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, yPos, pw - MARGIN_RIGHT, yPos);
  };

  /**
   * Write wrapped text and return the new Y position.
   * Handles page breaks automatically.
   */
  const writeText = (
    text: string,
    x: number,
    startY: number,
    opts?: {
      fontSize?: number;
      fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
      color?: [number, number, number];
      maxWidth?: number;
      lineHeight?: number;
    }
  ): number => {
    const fontSize = opts?.fontSize ?? 9;
    const fontStyle = opts?.fontStyle ?? 'normal';
    const color = opts?.color ?? DARK;
    const maxW = opts?.maxWidth ?? contentWidth;
    const lineH = opts?.lineHeight ?? fontSize * 0.45;

    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);

    const lines: string[] = text.split('\n').flatMap((seg) =>
      doc.splitTextToSize(seg, maxW) as string[]
    );

    let cy = startY;
    for (const line of lines) {
      if (cy + lineH > maxY) {
        addPage();
        cy = y;
      }
      doc.text(line, x, cy);
      cy += lineH;
    }
    return cy;
  };

  // ════════════════════════════════════════════════════════════════
  // PAGE 1: Letterhead + Opening
  // ════════════════════════════════════════════════════════════════

  // Letterhead
  y = 15;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', MARGIN_LEFT, y - 3, 16, 16);
  }
  const logoOffset = logoDataUrl ? 40 : MARGIN_LEFT;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text('TISCHLER UND SOHN', logoOffset, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY50);
  doc.text('European Wood Windows & Doors', logoOffset, y + 10);
  y += 18;
  drawRedLine(y);
  y += 8;

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(todayFormatted(), MARGIN_LEFT, y);
  y += 10;

  // Addressee block
  const addressLines = [
    data.contactName,
    data.companyName,
    data.companyAddress,
  ].filter(Boolean);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  for (const line of addressLines) {
    // Split long address lines
    const wrapped = doc.splitTextToSize(line, contentWidth) as string[];
    for (const wl of wrapped) {
      doc.text(wl, MARGIN_LEFT, y);
      y += 5;
    }
  }
  y += 5;

  // Salutation
  const greeting = data.contactSalutation && data.contactLastName
    ? `Dear ${data.contactSalutation} ${data.contactLastName}:`
    : data.contactLastName
      ? `Dear ${data.contactLastName}:`
      : 'Dear Sir or Madam:';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text(greeting, MARGIN_LEFT, y);
  y += 8;

  // Intro constant — all text comes from editable CONSTANT presets.
  // If none exist, the opening section is simply skipped (no hardcoded fallback).
  for (const preset of introConstant) {
    y = writeText(preset.body, MARGIN_LEFT, y, { fontSize: 10 });
    y += 4;
  }
  if (introConstant.length > 0) y += 2;

  // ════════════════════════════════════════════════════════════════
  // NUMBERED SPECIFICATIONS
  // ════════════════════════════════════════════════════════════════

  for (let i = 0; i < data.specPresets.length; i++) {
    const preset = data.specPresets[i];
    const specNum = `${i + 1}.`;
    const specTitle = preset.title;
    const specBody = preset.body;

    // Estimate how much space this spec needs (title + at least 2 body lines)
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const bodyLines = specBody.split('\n').flatMap((seg) =>
      doc.splitTextToSize(seg, contentWidth - 10) as string[]
    );
    const neededHeight = 6 + bodyLines.length * 3.8;

    // Ensure title + at least first few body lines stay together on same page
    const minKeepTogether = Math.min(neededHeight, 6 + Math.min(bodyLines.length, 3) * 3.8);
    ensureSpace(minKeepTogether);

    // Spec number + title (bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(specNum, MARGIN_LEFT, y);
    doc.text(specTitle, MARGIN_LEFT + 8, y);
    y += 4;

    // Spec body
    y = writeText(specBody, MARGIN_LEFT + 8, y, {
      fontSize: 9,
      color: DARK,
      maxWidth: contentWidth - 10,
      lineHeight: 3.8,
    });
    y += 3;
  }

  // ════════════════════════════════════════════════════════════════
  // CATEGORY PRICING BREAKDOWN
  // ════════════════════════════════════════════════════════════════

  y += 4;
  ensureSpace(40);

  // Pricing section header
  drawGrayLine(y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text('PRICING', MARGIN_LEFT, y);
  y += 6;

  // Category pricing lines
  const pricingRows: [string, string][] = [];
  if (data.hasEuroWindows) pricingRows.push(['Euro Windows', data.euroWindowsPrice]);
  if (data.hasDoubleHung) pricingRows.push(['Double Hung Windows', data.doubleHungPrice]);
  if (data.hasEuroDoors) pricingRows.push(['Euro Doors', data.euroDoorsPrice]);

  for (const [label, price] of pricingRows) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text(label, MARGIN_LEFT + 5, y);
    doc.text(price, pw - MARGIN_RIGHT, y, { align: 'right' });
    y += 5.5;
  }

  // Grand total line
  y += 2;
  drawGrayLine(y);
  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text('BASE BID PRICE', MARGIN_LEFT + 5, y);
  doc.text(data.grandTotal, pw - MARGIN_RIGHT, y, { align: 'right' });
  y += 3;
  drawGrayLine(y);
  y += 8;

  // ════════════════════════════════════════════════════════════════
  // OPTIONS SECTION
  // ════════════════════════════════════════════════════════════════

  const hasAnyOptions = data.optionPresets.length > 0 ||
    data.hasWindowScreens || data.hasDoorScreenSash || data.hasEntryDoor ||
    data.hasJambExtensions || data.hasMagneticContacts || data.hasFinalFinish;

  if (hasAnyOptions) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text('ADDITIONS OR DEDUCTIONS TO OUR BASE BID', MARGIN_LEFT, y);
    y += 6;

    // Add-on pricing items
    const addOnRows: [string, string][] = [];
    if (data.hasWindowScreens) addOnRows.push([`Window Screens (${data.windowScreensQty})`, data.windowScreensPrice]);
    if (data.hasDoorScreenSash) addOnRows.push([`Door Screen Sash (${data.doorScreenSashQty})`, data.doorScreenSashPrice]);
    if (data.hasEntryDoor) addOnRows.push([`Entry Door (${data.entryDoorQty})`, data.entryDoorPrice]);
    if (data.hasJambExtensions) addOnRows.push(['Jamb Extensions', data.jambExtensionsPrice]);
    if (data.hasMagneticContacts) addOnRows.push([`Magnetic Alarm Contacts (${data.magneticContactQty})`, data.magneticContactPrice]);
    if (data.hasFinalFinish) addOnRows.push(['Final Finish', data.finalFinishPrice]);

    for (const [label, price] of addOnRows) {
      ensureSpace(6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(...DARK);
      doc.text(`•  ${label}`, MARGIN_LEFT + 5, y);
      doc.text(price, pw - MARGIN_RIGHT, y, { align: 'right' });
      y += 5.5;
    }

    // Option presets (additional text)
    for (const preset of data.optionPresets) {
      y += 2;
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(preset.title, MARGIN_LEFT + 5, y);
      y += 4;
      y = writeText(preset.body, MARGIN_LEFT + 5, y, {
        fontSize: 9,
        maxWidth: contentWidth - 10,
        lineHeight: 3.8,
      });
      y += 2;
    }

    y += 4;
  }

  // ════════════════════════════════════════════════════════════════
  // EXCLUSIONS
  // ════════════════════════════════════════════════════════════════

  if (data.exclusionPresets.length > 0) {
    ensureSpace(20);
    drawGrayLine(y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...NAVY);
    doc.text('Our Base Bid does not include:', MARGIN_LEFT, y);
    y += 6;

    for (const preset of data.exclusionPresets) {
      ensureSpace(10);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);

      // If there's body text, show title + body; otherwise just title as bullet
      if (preset.body.trim()) {
        doc.setFont('helvetica', 'bold');
        doc.text(`•  ${preset.title}`, MARGIN_LEFT + 5, y);
        y += 4;
        doc.setFont('helvetica', 'normal');
        y = writeText(preset.body, MARGIN_LEFT + 10, y, {
          fontSize: 9,
          maxWidth: contentWidth - 15,
          lineHeight: 3.8,
        });
      } else {
        doc.text(`•  ${preset.title}`, MARGIN_LEFT + 5, y);
      }
      y += 4;
    }
    y += 4;
  }

  // ════════════════════════════════════════════════════════════════
  // CLOSING + SIGNATURE
  // ════════════════════════════════════════════════════════════════

  ensureSpace(40);
  drawGrayLine(y);
  y += 6;

  // Closing constant — all text comes from editable CONSTANT presets.
  for (const preset of closingConstant) {
    y = writeText(preset.body, MARGIN_LEFT, y, { fontSize: 10 });
    y += 4;
  }
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...DARK);
  doc.text('Sincerely,', MARGIN_LEFT, y);
  y += 12;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text('Tischler und Sohn', MARGIN_LEFT, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY50);
  if (data.salesman) {
    doc.text(data.salesman, MARGIN_LEFT, y);
    y += 4;
  }
  if (data.estimator && data.estimator !== data.salesman) {
    doc.text(`Estimator: ${data.estimator}`, MARGIN_LEFT, y);
    y += 4;
  }

  // ════════════════════════════════════════════════════════════════
  // PAGE: INSTALLATION (conditional)
  // ════════════════════════════════════════════════════════════════

  if (data.hasInstallation) {
    addPage();

    // Mini letterhead on installation page
    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', MARGIN_LEFT, 10, 12, 12);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...NAVY);
    doc.text('TISCHLER UND SOHN', logoDataUrl ? 36 : MARGIN_LEFT, 18);
    y = 24;
    drawRedLine(y);
    y += 8;

    // Installation header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text('INSTALLATION', MARGIN_LEFT, y);
    y += 6;

    // Installation price
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...DARK);
    doc.text('Installation Cost:', MARGIN_LEFT + 5, y);
    doc.setFont('helvetica', 'bold');
    doc.text(data.installationPrice, pw - MARGIN_RIGHT, y, { align: 'right' });
    y += 8;

    drawGrayLine(y);
    y += 6;

    // Installation presets
    for (const preset of data.installationPresets) {
      ensureSpace(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      doc.text(preset.title, MARGIN_LEFT, y);
      y += 4;

      if (preset.body.trim()) {
        y = writeText(preset.body, MARGIN_LEFT + 5, y, {
          fontSize: 9,
          maxWidth: contentWidth - 5,
          lineHeight: 3.8,
        });
      }
      y += 4;
    }
  }

  // ── Add page footers to all pages ──
  drawPageFooter();

  // ── Output ──
  const filename = `${data.projectName || 'Proposal'} - Proposal.pdf`;

  if (mode === 'preview' && previewWindow) {
    const blobUrl = doc.output('bloburl');
    previewWindow.location.href = blobUrl.toString();
  } else {
    doc.save(filename);
  }
}

export const generateProposalPDF = generateQuotePDF;

// ── Template Preview ──────────────────────────────────────────────

/**
 * Generate a "template preview" PDF that shows the full quote layout
 * with raw {{token}} placeholders instead of resolved data.
 *
 * All active presets are included (conditions are ignored) so the user
 * can see every possible section and how the final PDF will look.
 */
export async function generateTemplatePreviewPDF(
  presets: SpecPresetData[],
  previewWindow?: Window | null
): Promise<void> {
  // Separate presets by section (include ALL active, ignore conditions)
  const active = presets.filter((p) => p.isActive).sort((a, b) => a.order - b.order);
  const constant = active.filter((p) => p.section === 'CONSTANT');
  const specs = active.filter((p) => p.section === 'SPECIFICATION');
  const options = active.filter((p) => p.section === 'OPTION');
  const exclusions = active.filter((p) => p.section === 'EXCLUSION');
  const installation = active.filter((p) => p.section === 'INSTALLATION');

  // Build mock data with {{token}} names as values
  const mockData: QuotePDFData = {
    contactName: '{{contactName}}',
    contactSalutation: '{{contactSalutation}}',
    contactLastName: '{{contactLastName}}',
    companyName: '{{companyName}}',
    companyAddress: '{{companyAddress}}',

    projectName: '{{projectName}}',
    projectNumber: '{{projectNumber}}',
    plansDated: '{{plansDated}}',
    jobType: '{{jobType}}',
    address: '{{address}}',
    salesman: '{{salesman}}',
    estimator: '{{estimator}}',

    glassType: '{{glassType}}',
    woodType: '{{woodType}}',
    finishType: '{{finishType}}',
    sdlType: '{{sdlType}}',
    spacerBarColors: '{{spacerBarColors}}',

    // Presets — body text still has raw {{tokens}} since we don't resolve
    constantPresets: constant,
    specPresets: specs,
    optionPresets: options,
    exclusionPresets: exclusions,
    installationPresets: installation,

    // Mock pricing with placeholder labels
    euroWindowsPrice: '$XX,XXX.00',
    doubleHungPrice: '$XX,XXX.00',
    euroDoorsPrice: '$XX,XXX.00',
    grandTotal: '$XXX,XXX.00',
    hasEuroWindows: true,
    hasDoubleHung: true,
    hasEuroDoors: true,

    windowScreensPrice: '$X,XXX.00',
    windowScreensQty: 'XX',
    doorScreenSashPrice: '$X,XXX.00',
    doorScreenSashQty: 'XX',
    entryDoorPrice: '$X,XXX.00',
    entryDoorQty: 'XX',
    jambExtensionsPrice: '$X,XXX.00',
    magneticContactPrice: '$X,XXX.00',
    magneticContactQty: 'XX',
    finalFinishPrice: '$X,XXX.00',
    installationPrice: '$XX,XXX.00',

    // Show all sections in preview
    hasInstallation: installation.length > 0,
    hasMagneticContacts: true,
    hasFinalFinish: true,
    hasWindowScreens: true,
    hasDoorScreenSash: true,
    hasEntryDoor: true,
    hasJambExtensions: true,
  };

  await generateQuotePDF(mockData, 'preview', previewWindow);
}
