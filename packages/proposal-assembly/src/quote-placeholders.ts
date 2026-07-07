/**
 * Placeholder resolver for the Proposal Builder.
 *
 * Replaces {{token}} markers in preset body text with actual values
 * from the summary and optional contact data.
 */

import { NFRC_DATA } from './nfrc-data.js';

// ── Valid options per product type ────────────────────────────────
// Mirrors apps/web/lib/product-type-options.ts so stale saved values
// can be filtered before being rendered into the proposal.
function getValidOptionsForType(t: string): string[] {
  const lo = t.toLowerCase();
  if (lo === 'pivot' || lo === 'outswing pivot' || lo.includes('convert pivot')) {
    return ['Maco Instinct Motorized Locks'];
  }
  if (lo === 'inswing folding') return ['Threshold #6', 'Threshold #6C', 'Threshold ADA'];
  if (lo === 'outswing folding') return ['Threshold #7', 'Threshold #8', 'Threshold ADA'];
  if (lo.includes('folding')) {
    return lo.includes('inswing')
      ? ['Threshold #6', 'Threshold #6C', 'Threshold ADA']
      : ['Threshold #7', 'Threshold #8', 'Threshold ADA'];
  }
  if (lo === 'l&r d') return ['72mm Thick Sash', '90mm Thick Sash', 'Standard RH', 'SS RH'];
  if (lo.includes('inswing') && (lo.includes(' gd') || lo.includes(' dd') || lo.includes('house door'))) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'KFV RH', 'Siegenia RH', 'Threshold #6', 'Threshold #6C', 'Threshold ADA'];
  }
  if (lo.includes('outswing') && (lo.includes(' gd') || lo.includes(' dd') || lo.includes('house door'))) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'KFV RH', 'Siegenia RH', 'Threshold #7', 'Threshold #8', 'Threshold ADA'];
  }
  if (lo.includes('offset simulated') || lo.includes('offset french simulated')) {
    return ['72mm Thick Sash', '84mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('simulated dh') || lo.includes('simulated double hung')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('single hung') || lo.includes('double hung') || lo.includes('triple hung')) {
    return ['59mm Thick Sash', '72mm Thick Sash', '82mm Thick Sash', '90mm Thick Sash', 'Vent Locks'];
  }
  if (lo.includes('direct glaze')) return ['72mm Thick Sash', '90mm Thick Sash', 'Threshold to match'];
  if (lo.includes('fixed with sash')) {
    return ['59mm Thick Sash', '72mm Thick Sash', '82mm Thick Sash', '90mm Thick Sash', 'Threshold to match'];
  }
  if (lo.includes('tilt-in') || lo.includes('tilt in')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('inswing')) return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  if (lo.includes('outswing') || lo.includes('awning')) {
    return ['72mm Thick Sash', '90mm Thick Sash', 'Corrosion Resistance RH', 'Titan RH'];
  }
  if (lo.includes('lift') || lo.includes('roll')) return ['72mm Thick Sash', '90mm Thick Sash', 'Standard RH', 'SS RH'];
  return ['72mm Thick Sash', '90mm Thick Sash'];
}

// ── Types ──────────────────────────────────────────────────────────

/** Subset of Summary fields used for token resolution. */
export interface SummaryForPlaceholders {
  name: string;
  opportunityNumber: string;
  plansDated: string;
  jobType: string;
  glassType: string;
  glassTypeCustom?: string;
  hungType?: string;
  hungTypeCustom?: string;
  finish: string;
  sdl: string;
  sdlCustom?: string;
  spacerBarColors: string;
  spacerBarType: string;
  woodType: string;
  woodTypeCustom?: string;
  contactReceivingQuote: string;
  accountReceivingQuote: string;
  accountShippingAddress: string;
  address: string;
  salesman: string;
  estimator: string;
  contactEmail: string;
  contactPrimaryPhone: string;
  quoteType: string;
  quoteTotals: {
    euroWindows: { full: string; pct: string; final: string; finalAdj: string };
    doubleHung: { full: string; pct: string; final: string; finalAdj: string };
    euroDoors: { full: string; pct: string; final: string; finalAdj: string };
  };
  grandTotalAdjustment?: { full: string; pct: string; final: string; finalAdj: string };
  /** Multi-location jobs store their own quoteTotals per sub-location; the
   * top-level `quoteTotals` above is left blank/unused in that case. */
  hasMultipleLocations?: boolean;
  subLocations?: Array<{ quoteTotals?: SummaryForPlaceholders['quoteTotals'] }>;
  addOns: {
    windowScreens: { qty: string; final: string; [k: string]: unknown };
    doorScreenSash: { qty: string; final: string; [k: string]: unknown };
    entryDoor: { qty: string; final: string; [k: string]: unknown };
    jambExtensions: { final: string; [k: string]: unknown };
    magneticContact: { qty: string; final: string; [k: string]: unknown };
    finalFinish: { final: string; [k: string]: unknown };
    installation: { final: string; installationRows?: Array<{ label: string; price: string }>; [k: string]: unknown };
  };
}

/** Optional contact data fetched from the CRM Contact record. */
export interface ContactData {
  salutation?: string; // "Mr.", "Ms.", etc.
  lastName?: string;
}

// ── Formatting helpers ─────────────────────────────────────────────

/**
 * Format a whole-dollar string (e.g., "87600") to currency.
 * Returns "$87,600.00" or "$0.00" if invalid.
 */
export function formatDollar(value: string | undefined | null): string {
  if (!value) return '$0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Format an ISO date string (YYYY-MM-DD) or similar to a readable date.
 * Returns "August 15, 2025" format, or the original string if unparseable.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const d = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a phone number string (10 digits) to (XXX) XXX-XXXX.
 */
export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone; // Return as-is if not 10 digits
}

/** Convert a millimeter value to a fractional-inch string like 2-13/16" */
function mmToFractionalInches(mm: number): string {
  const totalInches = mm / 25.4;
  const wholeIn = Math.floor(totalInches);
  const sixteenth = Math.round((totalInches - wholeIn) * 16);
  const adjWhole = wholeIn + (sixteenth === 16 ? 1 : 0);
  const fracIndex = sixteenth === 16 ? 0 : sixteenth;
  const fracs = ['', '1/16', '1/8', '3/16', '1/4', '5/16', '3/8', '7/16', '1/2', '9/16', '5/8', '11/16', '3/4', '13/16', '7/8', '15/16'];
  const frac = fracs[fracIndex] ?? '';
  return frac ? `${adjWhole}-${frac}"` : `${adjWhole}"`;
}

/** Expand product type abbreviations to full names. */
function pluralizeTypeName(name: string): string {
  // Colon-separated compound names: pluralize the suffix only
  // e.g. "Fixed with Sash: Push Outswing" → "Fixed with Sash: Push Outswings"
  if (name.includes(':')) {
    const idx = name.indexOf(':');
    return `${name.slice(0, idx)}: ${pluralizeTypeName(name.slice(idx + 1).trim())}`;
  }
  // Strip trailing parenthetical before checking last word
  // e.g. "Offset Simulated Double Hung (2 Glass Fields)" → base + " Windows" + " (2 Glass Fields)"
  const parenMatch = name.match(/^(.*?)\s*(\(.*\))\s*$/);
  const base = parenMatch ? (parenMatch[1] ?? name).trimEnd() : name;
  const paren = parenMatch ? ` ${parenMatch[2]}` : '';

  // "Fixed with Sash" is always "Fixed with Sash Units" regardless of window/door context
  if (base === 'Fixed with Sash') return 'Fixed with Sash Units' + paren;

  const lastWord = base.split(/\s+/).pop() ?? '';
  // These last words simply take an 's'
  if (/^(Door|Outswing|Inswing|Window|Lock|Bolt)$/.test(lastWord)) return base + 's' + paren;
  // These last words indicate a window/door type — append "Windows"
  if (/^(Balance|Sash|Glaze|French|Tilt|Turn|Hung|Pivot|Folding|Awning|Chain|Tilt-in)$/i.test(lastWord)) {
    return base + ' Windows' + paren;
  }
  // Default: add s
  return base + 's' + paren;
}

function expandProductTypeName(name: string): string {
  const expanded = name
    .replace(/\bL&R D\b/g, 'Lift & Roll Door')
    .replace(/\bT & T\b/g, 'Turn & Tilt')
    .replace(/\bGD\b/g, 'Garden Door')
    .replace(/\bDD\b/g, 'Domestic Door')
    .replace(/\bDH\b/g, 'Double Hung');
  return pluralizeTypeName(expanded);
}

/** Format a single product type option, converting "XXmm Thick Sash" to fractional inches and expanding abbreviations. */
function formatProductTypeOption(opt: string): string {
  // Convert mm sash sizes to fractional inches
  const m = opt.match(/^(\d+(?:\.\d+)?)mm Thick Sash$/i);
  if (m && m[1]) return `${mmToFractionalInches(parseFloat(m[1]))} Thick Sash`;
  // Expand legacy short-form threshold labels saved before the full-name rename
  const thresholdAliases: Record<string, string> = {
    '#6': 'Threshold #6', '#6C': 'Threshold #6C',
    '#7': 'Threshold #7', '#8': 'Threshold #8',
    'ADA': 'Threshold ADA',
  };
  if (Object.prototype.hasOwnProperty.call(thresholdAliases, opt)) return thresholdAliases[opt]!;
  // Expand "SS" prefix → "Stainless Steel"
  let result = opt.replace(/\bSS\b/g, 'Stainless Steel');
  // Expand trailing " RH" → " Rough Hardware"
  result = result.replace(/\bRH\b/g, 'Rough Hardware');
  return result;
}

/**
 * Map a product type name to an NFRC lookup category key.
 * Returns null if no matching category is found.
 */
function getProductNfrcCategory(typeName: string): string | null {
  const lo = typeName.toLowerCase();
  // Lift & Roll Door / L&R D
  if (lo.includes('l&r') || (lo.includes('lift') && (lo.includes('roll') || lo.includes('rolling')))) return 'liftRollingDoor';
  // Tilt & Turn
  if (lo.includes('t & t') || (lo.includes('tilt') && lo.includes('turn')) || lo.includes('tilt and turn')) return 'isTiltAndTurn';
  // Inswing entry / French House Door
  if (lo.includes('inswing') && (lo.includes('house door') || lo.includes('french house'))) return 'isEntryDoor';
  // Outswing entry / French House Door
  if (lo.includes('outswing') && (lo.includes('house door') || lo.includes('french house'))) return 'osEntryDoor';
  // OS Casement: Push Outswing, Crank Outswing, Outswing French window (not door)
  if (lo.includes('push outswing') || lo.includes('crank outswing')) return 'osCasement';
  if (lo.includes('outswing') && lo.includes('french') && !lo.includes('house') && !lo.includes('door')) return 'osCasement';
  // Direct Glaze / Fixed with Sash (Fixed Simulation)
  if (lo.includes('direct glaze') || lo.includes('fixed with sash') || lo.includes('fixed sash')) return 'fixedSimulation';
  // Double Hung only (not single or triple hung)
  if (lo.includes('double hung') || /\bdh\b/.test(lo)) return 'doubleHung';
  return null;
}

/**
 * Parse the glass number prefix from a glassType string (e.g. "2 Standard Insulated..." → "2").
 * Returns null if the string doesn't start with a recognisable number.
 */
function parseGlassNum(glassType: string): string | null {
  const m = (glassType || '').match(/^(\d+(?:\.\d+)?)/);
  return m?.[1] ?? null;
}

/**
 * Return the jamb depth string for a given product type + sash thickness in mm.
 * Returns null if the depth is unknown or varies by sash configuration.
 */
function getJambDepth(typeName: string, sashMm: number): string | null {
  const lo = typeName.toLowerCase();
  // Triple hung — must be before generic "hung" check
  if (lo.includes('triple hung')) {
    if (sashMm === 65) return '10-9/16"';
    if (sashMm === 72) return '11-5/8"';
    return null;
  }
  // Single / Double hung
  if (lo.includes('hung')) {
    if (sashMm === 59) return '7"';
    if (sashMm === 61) return '7-3/16"';
    if (sashMm === 65) return '7-1/4"';
    if (sashMm === 72) return '8-1/16"';
    if (sashMm === 90) return '9-7/16"';
    return null;
  }
  // L&R D / Lift and Roll — jamb depth varies by sash configuration
  if (lo.includes('l&r') || (lo.includes('lift') && (lo.includes('roll') || lo.includes('rolling')))) {
    return 'Jamb depth varies depending upon sash configuration';
  }
  // Outswing folding
  if (lo.includes('outswing') && lo.includes('folding')) {
    if (sashMm === 72) return '4-3/16"';
    if (sashMm === 84) return '3-5/16"';
    return null;
  }
  // Outswing garden / domestic door
  if (lo.includes('outswing') && (lo.includes(' gd') || lo.includes('garden door') || lo.includes(' dd') || lo.includes('domestic') || lo.includes('house door') || lo.includes('french house'))) {
    if (sashMm === 72) return '4-3/16"';
    if (sashMm === 84 || sashMm === 92) return '3-1/8"';
    return null;
  }
  // Inswing garden / domestic door
  if (lo.includes('inswing') && (lo.includes(' gd') || lo.includes('garden door') || lo.includes(' dd') || lo.includes('domestic') || lo.includes('house door') || lo.includes('french house'))) {
    if (sashMm === 92) return '3-5/16"';
    return null; // 72mm rabbetted — not specified
  }
  // Generic outswing casements (push, crank, french window, etc.)
  if (lo.includes('outswing')) {
    if (sashMm === 72) return '4-3/16"';
    if (sashMm === 84) return '3-1/8"';
    return null;
  }
  // Inswing T&T / Tilt and Turn
  if (lo.includes('t & t') || lo.includes('tilt and turn') || lo.includes('tilt & turn') ||
      (lo.includes('tilt') && lo.includes('turn'))) {
    if (sashMm === 84) return '3-5/16"';
    return null; // 72mm rabbetted — not specified
  }
  // Fixed with Sash (flush profile)
  if (lo.includes('fixed with sash') || lo.includes('fixed sash')) {
    if (sashMm === 72) return '4-3/16"';
    return null;
  }
  // Pivot house door
  if (lo.includes('pivot') && (lo.includes('house') || lo.includes('door'))) {
    if (sashMm === 90) return '5-1/8"';
    return null;
  }
  return null;
}

/**
 * Build the bolded first-line string for a product type entry.
 * Only shows sash thickness and jamb depth — hardware/threshold options are
 * intentionally omitted from this section of the proposal.
 */
function buildFirstLine(typeName: string, rawOpts: string[]): string {
  const sashRe = /^\d+(\.\d+)?mm Thick Sash$/i;
  const sashOpt = rawOpts.find(o => sashRe.test(o));
  const sashMm = sashOpt ? parseFloat(sashOpt) : null;
  const jambDepth = sashMm !== null ? getJambDepth(typeName, sashMm) : null;

  const specParts: string[] = [];
  if (sashOpt) specParts.push(formatProductTypeOption(sashOpt));
  if (jambDepth) {
    // Fractional-inch value → "X" Jamb Depth"; full note → show as-is
    specParts.push(jambDepth.endsWith('"') ? `${jambDepth} Jamb Depth` : jambDepth);
  }

  const displayName = expandProductTypeName(typeName);
  return specParts.length > 0
    ? `<strong>${displayName}</strong> with ${specParts.join(', ')}`
    : `<strong>${displayName}</strong>`;
}

/**
 * Format NFRC data for a product type + glass type combination.
 * Returns multi-line HTML (using <br>) or null if no NFRC entry is found.
 */
function formatNfrcBlock(typeName: string, glassType: string, rawOpts: string[]): string | null {
  const cat = getProductNfrcCategory(typeName);
  if (!cat) return null;
  const gNum = parseGlassNum(glassType);
  if (!gNum) return null;
  const catData = NFRC_DATA[cat];
  if (!catData) return null;
  const entry = catData[gNum];
  if (!entry) return null;

  const firstLine = buildFirstLine(typeName, rawOpts);

  const ng = entry.noGrid;
  const gr = entry.grid;
  const hasGridData = gr.u !== '0.00' && gr.s !== 'N/A';

  const nfrcLines: string[] = [];
  if (hasGridData) {
    nfrcLines.push(`<li>&lt;1" Grid: U-Factor ${gr.u} / SHGC ${gr.s} | IGU: ${gr.igu} | Coating: ${gr.coat}</li>`);
  }
  nfrcLines.push(`<li>No Grid: U-Factor ${ng.u} / SHGC ${ng.s} | IGU: ${ng.igu} | Coating: ${ng.coat}</li>`);

  return `${firstLine}<br><strong>Product NFRC Values:</strong><ul style="margin:0;padding-left:1.25em">${nfrcLines.join('')}</ul>`;
}


// ── Token map builder ──────────────────────────────────────────────

/**
 * Return the effective `quoteTotals` for a summary, aggregating across
 * `subLocations` when the job has multiple locations.
 *
 * Multi-location jobs keep each location's totals in `subLocations[i].quoteTotals`
 * and leave the top-level `quoteTotals` unused — the Summary page UI aggregates
 * these on the fly for display, but that aggregate was never available to the
 * Proposal Builder, causing prices to show as $0.00 for multi-location jobs.
 */
export function getEffectiveQuoteTotals(
  summary: Pick<SummaryForPlaceholders, 'quoteTotals' | 'hasMultipleLocations' | 'subLocations'>
): SummaryForPlaceholders['quoteTotals'] {
  if (!summary.hasMultipleLocations || !summary.subLocations?.length) {
    return summary.quoteTotals;
  }
  const p = (v: string | undefined) => parseFloat(v || '0') || 0;
  const sumCat = (cat: 'euroWindows' | 'doubleHung' | 'euroDoors', f: 'full' | 'pct' | 'final' | 'finalAdj') =>
    summary.subLocations!.reduce((a, l) => a + p(l.quoteTotals?.[cat]?.[f]), 0).toString();
  return {
    euroWindows: { full: sumCat('euroWindows', 'full'), pct: sumCat('euroWindows', 'pct'), final: sumCat('euroWindows', 'final'), finalAdj: sumCat('euroWindows', 'finalAdj') },
    doubleHung: { full: sumCat('doubleHung', 'full'), pct: sumCat('doubleHung', 'pct'), final: sumCat('doubleHung', 'final'), finalAdj: sumCat('doubleHung', 'finalAdj') },
    euroDoors: { full: sumCat('euroDoors', 'full'), pct: sumCat('euroDoors', 'pct'), final: sumCat('euroDoors', 'final'), finalAdj: sumCat('euroDoors', 'finalAdj') },
  };
}

/**
 * Build a map of token names to resolved string values.
 *
 * Token names match the {{tokenName}} placeholders used in preset bodies.
 */
export function buildTokenMap(
  summary: SummaryForPlaceholders,
  contactData?: ContactData
): Record<string, string> {
  // Parse finish type number from the finish string
  let finishType = '';
  if (summary.finish) {
    const match = summary.finish.match(/(\d+)\s*$/);
    finishType = match?.[1] ?? summary.finish;
  }

  // Parse last name from contact name as fallback
  const nameParts = (summary.contactReceivingQuote || '').trim().split(/\s+/);
  const fallbackLastName = nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? '') : '';

  // Aggregate across sub-locations for multi-location jobs (see getEffectiveQuoteTotals)
  const effQuoteTotals = getEffectiveQuoteTotals(summary);

  // Calculate grand total
  const euroWindowsFinal = parseInt(effQuoteTotals?.euroWindows?.finalAdj || '0', 10) || 0;
  const doubleHungFinal = parseInt(effQuoteTotals?.doubleHung?.finalAdj || '0', 10) || 0;
  const euroDoorsFinal = parseInt(effQuoteTotals?.euroDoors?.finalAdj || '0', 10) || 0;
  const grandAdj = parseInt(summary.grandTotalAdjustment?.finalAdj || '0', 10) || 0;
  const grandTotal = euroWindowsFinal + doubleHungFinal + euroDoorsFinal + grandAdj;

  const tokens: Record<string, string> = {
    // Project info
    projectName: summary.name || '',
    projectNumber: summary.opportunityNumber || '',
    plansDated: formatDate(summary.plansDated),
    jobType: summary.jobType || '',
    address: summary.address || '',
    quoteType: summary.quoteType || '',

    // Materials
    glassType: summary.glassTypeCustom || summary.glassType || '',
    finishType,
    sdlType: summary.sdlCustom || summary.sdl || '',
    spacerBarColor: summary.spacerBarColors || '',
    spacerBarType: summary.spacerBarType || '',
    woodType: summary.woodTypeCustom || summary.woodType || '',

    // People
    contactName: summary.contactReceivingQuote || '',
    contactSalutation: contactData?.salutation || '',
    contactLastName: contactData?.lastName || fallbackLastName,
    contactEmail: summary.contactEmail || '',
    contactPhone: formatPhone(summary.contactPrimaryPhone),
    companyName: summary.accountReceivingQuote || '',
    companyAddress: summary.accountShippingAddress || '',
    salesman: summary.salesman || '',
    estimator: summary.estimator || '',

    // Date
    todayDate: formatDate(new Date().toISOString()),

    // Category pricing
    euroWindowsPrice: formatDollar(effQuoteTotals?.euroWindows?.finalAdj),
    doubleHungPrice: formatDollar(effQuoteTotals?.doubleHung?.finalAdj),
    euroDoorsPrice: formatDollar(effQuoteTotals?.euroDoors?.finalAdj),
    grandTotal: formatDollar(String(grandTotal)),
    grandTotalAdjustment: formatDollar(summary.grandTotalAdjustment?.finalAdj),

    // Add-on pricing
    windowScreensPrice: formatDollar(summary.addOns?.windowScreens?.final),
    windowScreensQty: summary.addOns?.windowScreens?.qty || '0',
    doorScreenSashPrice: formatDollar(summary.addOns?.doorScreenSash?.final),
    doorScreenSashQty: summary.addOns?.doorScreenSash?.qty || '0',
    entryDoorPrice: formatDollar(summary.addOns?.entryDoor?.final),
    entryDoorQty: summary.addOns?.entryDoor?.qty || '0',
    jambExtensionsPrice: formatDollar(summary.addOns?.jambExtensions?.final),
    magneticContactPrice: formatDollar(summary.addOns?.magneticContact?.final),
    magneticContactQty: summary.addOns?.magneticContact?.qty || '0',
    finalFinishPrice: formatDollar(summary.addOns?.finalFinish?.final),
    installationPrice: formatDollar(summary.addOns?.installation?.final),
    installationTotalPrice: (() => {
      const inst = summary.addOns?.installation;
      const base = parseFloat((inst?.final || '').replace(/[^0-9.-]/g, '')) || 0;
      const subTotal = (inst?.installationRows || []).reduce(
        (s: number, r: { label: string; price: string }) =>
          s + (parseFloat((r.price || '').replace(/[^0-9.-]/g, '')) || 0),
        0
      );
      return formatDollar(String(base + subTotal));
    })(),
    installationDetails: (() => {
      const inst = summary.addOns?.installation;
      const rows = (inst?.installationRows || []) as Array<{ label: string; price: string }>;
      const base = parseFloat((inst?.final || '').replace(/[^0-9.-]/g, '')) || 0;
      const subTotal = rows.reduce(
        (s: number, r: { label: string; price: string }) =>
          s + (parseFloat((r.price || '').replace(/[^0-9.-]/g, '')) || 0),
        0
      );
      const grandTotal = base + subTotal;
      if (rows.length === 0) return formatDollar(String(grandTotal));
      const lines = rows.map(r => `${r.label}: ${r.price}`);
      lines.push(`Total: ${formatDollar(String(grandTotal))}`);
      return lines.join('<br>');
    })(),
    productTypeDetails: (() => {
      const pto = (summary as any).productTypeOptions as Record<string, string[]> | undefined;
      if (!pto) return '';
      const glassType = summary.glassTypeCustom || summary.glassType || '';
      const hungGlassType = summary.hungTypeCustom || summary.hungType || glassType;
      const lines: string[] = [];

      // Derive the active product type keys from actual rows so that types
      // deleted from Page 1 don't appear as ghost entries here.
      const typeFields = ['type', 'type2', 'type3', 'type4'];
      const subOptMap: Record<string, string> = {
        type: 'typeSubOption', type2: 'type2SubOption',
        type3: 'type3SubOption', type4: 'type4SubOption',
      };
      const allRows: unknown[] = [
        ...((summary as any).rows || []),
        ...((summary as any).doorRows || []),
        ...(((summary as any).subLocations || []) as any[]).flatMap(
          (l: any) => [...(l.rows || []), ...(l.doorRows || [])]
        ),
      ];
      const activeTypes = new Set<string>(
        allRows.flatMap((r: any) =>
          typeFields.map(f => {
            const t = r[f];
            if (!t) return null;
            if (t === 'Fixed with Sash' && r[subOptMap[f]!]) return `Fixed with Sash: ${r[subOptMap[f]!]}`;
            return t;
          }).filter((t): t is string => Boolean(t))
        )
      );

      const seenDisplayNames = new Set<string>();

      for (const [typeName, opts] of Object.entries(pto)) {
        // Skip types not present in any current row (deleted ghost entries)
        if (activeTypes.size > 0 && !activeTypes.has(typeName)) continue;
        if (!Array.isArray(opts) || opts.length === 0) continue;
        // Filter out stale option values no longer valid for this type
        const validSet = new Set(getValidOptionsForType(typeName));
        const filteredOpts = opts.filter((o: string) => validSet.has(o));
        if (filteredOpts.length === 0) continue;
        // Split colon-compound types into two entries, e.g.
        // "Fixed with Sash: Push Outswing" → "Fixed with Sash Units" + "Push Outswings"
        const typeNames = typeName.includes(':')
          ? typeName.split(':').map((s: string) => s.trim()).filter(Boolean)
          : [typeName];
        for (const singleName of typeNames) {
          // Deduplicate: "Fixed with Sash Units" should appear only once
          // even when multiple compound types share the same prefix.
          const displayName = expandProductTypeName(singleName);
          if (seenDisplayNames.has(displayName)) continue;
          seenDisplayNames.add(displayName);
          // Double hung uses its own glass type field if set
          const cat = getProductNfrcCategory(singleName);
          const effectiveGlass = cat === 'doubleHung' ? hungGlassType : glassType;
          const nfrcBlock = formatNfrcBlock(singleName, effectiveGlass, filteredOpts);
          if (nfrcBlock) {
            lines.push(nfrcBlock);
          } else {
            // Extra <br> so plain (no-NFRC) entries get the same visual
            // spacing as NFRC entries whose </ul> creates a natural gap.
            lines.push(buildFirstLine(singleName, filteredOpts) + '<br>');
          }
        }
      }
      return lines.join('<br>');
    })(),
  };

  return tokens;
}

// ── Token resolver ─────────────────────────────────────────────────

/** Regex to match {{tokenName}} placeholders in text. */
const TOKEN_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Replace all {{tokenName}} placeholders in text with values from the token map.
 * Unknown tokens are left as-is (helpful for debugging).
 */
export function resolveTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(TOKEN_REGEX, (match, tokenName: string) => {
    const value = tokens[tokenName];
    return value !== undefined ? value : match; // Keep original if no mapping
  });
}

/** Return unknown token names found in text, deduplicated in document order. */
export function findUnresolvedTokens(text: string, tokens: Record<string, string>): string[] {
  const unresolved: string[] = [];
  text.replace(TOKEN_REGEX, (_match, tokenName: string) => {
    if (tokens[tokenName] === undefined && !unresolved.includes(tokenName)) {
      unresolved.push(tokenName);
    }
    return _match;
  });
  return unresolved;
}

/** Resolve text and report any placeholders that could not be mapped. */
export function resolveTokensWithDiagnostics(
  text: string,
  tokens: Record<string, string>
): { text: string; unresolvedTokens: string[] } {
  return {
    text: resolveTokens(text, tokens),
    unresolvedTokens: findUnresolvedTokens(text, tokens),
  };
}

// ── Custom token resolution (Phase 2) ──────────────────────────────

/**
 * Token mapping row from the database. Mirrors the Prisma `TokenMapping` model.
 * Only the fields needed for resolution are listed here.
 */
export interface TokenMappingRow {
  tokenName: string;
  sourceObject: 'SUMMARY' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY' | 'PROJECT' | 'SYSTEM';
  sourcePath: string;
  format: 'TEXT' | 'CURRENCY' | 'DATE' | 'PHONE' | 'PERCENTAGE';
  isBuiltIn: boolean;
}

/**
 * A `Record.data` blob from a custom-object Record. Field names are CustomField
 * apiNames (possibly prefixed like `Opportunity__opportunityName` per the
 * normalization in the records route). We try both prefixed and unprefixed.
 */
export type CustomObjectData = Record<string, unknown>;

export interface CustomTokenResolverArgs {
  tokenMappings: TokenMappingRow[];
  /** tokenNames already produced by `buildTokenMap` — these take precedence. */
  builtInKeys: Set<string>;
  summary: SummaryForPlaceholders;
  contact?: ContactData;
  opportunity?: CustomObjectData;
  project?: CustomObjectData;
}

/**
 * Read a single field from custom-object data, trying both the literal path
 * and the path with a known object prefix stripped (e.g. `Opportunity__name`
 * vs `name`). Matches the symmetric read in apps/api/src/routes/records.ts.
 */
function readCustomData(data: CustomObjectData | undefined, path: string): unknown {
  if (!data) return undefined;
  if (path in data) return data[path];
  const stripped = path.replace(/^[A-Za-z]+__/, '');
  if (stripped !== path && stripped in data) return data[stripped];
  return undefined;
}

function applyFormat(raw: unknown, format: TokenMappingRow['format']): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw);
  switch (format) {
    case 'CURRENCY':
      return formatDollar(str);
    case 'DATE':
      return formatDate(str);
    case 'PHONE':
      return formatPhone(str);
    case 'PERCENTAGE': {
      const num = parseFloat(str);
      return Number.isFinite(num) ? `${num}%` : str;
    }
    case 'TEXT':
    default:
      return str;
  }
}

/**
 * Resolve the additional tokens described by `TokenMapping` rows that aren't
 * already produced by `buildTokenMap`. Returns a flat map suitable for merging
 * into the main token map.
 *
 * Built-in token names (those already produced by `buildTokenMap`) are skipped
 * here, so the hardcoded resolution always wins for the canonical tokens like
 * `contactName` or `projectName`.
 */
export function resolveCustomTokens(args: CustomTokenResolverArgs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of args.tokenMappings) {
    if (m.isBuiltIn || args.builtInKeys.has(m.tokenName)) continue;

    let raw: unknown = undefined;
    switch (m.sourceObject) {
      case 'SUMMARY':
        if (m.sourcePath === 'installationTotal') {
          const inst = args.summary.addOns?.installation;
          const rows = (inst?.installationRows || []) as Array<{ label: string; price: string }>;
          const base = parseFloat((inst?.final || '').replace(/[^0-9.-]/g, '')) || 0;
          const subTotal = rows.reduce(
            (s: number, r: { label: string; price: string }) =>
              s + (parseFloat((r.price || '').replace(/[^0-9.-]/g, '')) || 0),
            0
          );
          const grandTotal = base + subTotal;
          if (rows.length === 0) {
            out[m.tokenName] = formatDollar(String(grandTotal));
          } else {
            const lines = rows.map(r => `${r.label}: ${r.price}`);
            lines.push(`Total: ${formatDollar(String(grandTotal))}`);
            out[m.tokenName] = lines.join('<br>');
          }
          continue;
        }
        raw = (args.summary as unknown as Record<string, unknown>)[m.sourcePath];
        break;
      case 'CONTACT':
        raw = args.contact ? (args.contact as unknown as Record<string, unknown>)[m.sourcePath] : undefined;
        break;
      case 'OPPORTUNITY':
        raw = readCustomData(args.opportunity, m.sourcePath);
        break;
      case 'PROJECT':
        raw = readCustomData(args.project, m.sourcePath);
        break;
      case 'ACCOUNT':
      case 'SYSTEM':
      default:
        // Hardcoded path covers these — leave to `buildTokenMap` / the
        // built-in fallback. If a custom mapping points here we still skip.
        continue;
    }

    if (raw === undefined || raw === null || raw === '') continue;
    out[m.tokenName] = applyFormat(raw, m.format);
  }
  return out;
}

/**
 * Convenience: resolve tokens in all bodies of a preset array.
 * Returns new array with resolved bodies (does not mutate originals).
 */
export function resolvePresetsTokens<T extends { body: string }>(
  presets: T[],
  tokens: Record<string, string>
): T[] {
  return presets.map((preset) => ({
    ...preset,
    body: resolveTokens(preset.body, tokens),
  }));
}
