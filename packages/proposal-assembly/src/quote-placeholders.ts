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
  if (lo.includes('pivot')) {
    return ['Maco Instinct Motorized Locks'];
  }
  if (lo === 'inswing folding') return ['Threshold #6', 'Threshold #6C', 'Threshold ADA'];
  if (lo === 'outswing folding') return ['Threshold #7', 'Threshold #8', 'Threshold ADA'];
  if (lo.includes('folding')) {
    return lo.includes('inswing')
      ? ['Threshold #6', 'Threshold #6C', 'Threshold ADA']
      : ['Threshold #7', 'Threshold #8', 'Threshold ADA'];
  }
  if (lo === 'l&r d' || lo.startsWith('l&r d:') || lo.startsWith('l&r d ')) return ['72mm Thick Sash', '90mm Thick Sash', 'Standard RH', 'SS RH'];
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

// ── Rough Hardware token ──────────────────────────────────────────

const GD_TYPES_LOWER = new Set([
  'inswing gd', 'outswing gd', 'inswing french gd', 'outswing french gd',
]);

// House doors get their own "HOUSE DOORS:" header but reuse the garden door paragraph text.
const HOUSE_DOOR_TYPES_LOWER = new Set([
  'inswing house door', 'outswing house door',
  'inswing french house door', 'outswing french house door',
]);

const WINDOW_NON_HUNG_TYPES_LOWER = new Set([
  'push outswing', 'crank outswing',
  'inswing', 'inswing t & t',
  'awning', 'tilt-in',
  'inswing french', 'outswing french',
  'inswing folding window', 'outswing folding window',
]);

const DOMESTIC_DOOR_TYPES_LOWER = new Set([
  'inswing dd', 'outswing dd', 'inswing french dd', 'outswing french dd',
]);

const FOLDING_DOOR_TYPES_LOWER = new Set(['inswing folding', 'outswing folding']);

const CRANK_OUT_TYPE_LOWER = 'crank outswing';

// <br><br> creates an empty paragraph block which renders as a blank line in PDF.
const BB = '<br><br>';

// Prefix body text with a bold section header followed by a blank line.
const section = (header: string, body: string) =>
  `<strong>${header}</strong>${BB}${body}`;

function buildRoughHardwareText(
  activeTypes: Set<string>,
  pto: Record<string, string[]>,
): string {
  const activeList = Array.from(activeTypes).map((t) => t.toLowerCase());
  const hasGD = activeList.some((t) => GD_TYPES_LOWER.has(t));
  const hasHouseDoor = activeList.some((t) => HOUSE_DOOR_TYPES_LOWER.has(t));
  const hasWindows = activeList.some((t) =>
    WINDOW_NON_HUNG_TYPES_LOWER.has(t) ||
    t.includes('offset simulated') ||
    t.includes('simulated dh') ||
    t.includes('simulated double hung')
  );

  const parts: string[] = [];

  // Garden doors and house doors share identical hardware copy; only the header differs.
  const doorLabels: string[] = [];
  if (hasGD) doorLabels.push('GARDEN DOORS');
  if (hasHouseDoor) doorLabels.push('HOUSE DOORS');
  const hasDoorLike = doorLabels.length > 0;
  if (hasWindows) doorLabels.push('WINDOWS');
  const header = doorLabels.length > 1
    ? doorLabels.slice(0, -1).join(', ') + ' & ' + doorLabels[doorLabels.length - 1] + ':'
    : doorLabels[0] + ':';

  // Crank-out has no header of its own — it's an extra paragraph tacked onto
  // whichever windows-inclusive section fires (combined or windows-only).
  const crankOutText = activeList.includes(CRANK_OUT_TYPE_LOWER)
    ? BB + 'Crank-out casements with stainless steel Roto scissor crank out hardware and 3-point locking system. One crank per casement sash. Hardware is available in four finishes – Earth Brown, Coppertone, Dark Brown, and Metallic Brown. Color samples available upon request. Not available in a brushed nickel finish.'
    : '';

  if (hasDoorLike && hasWindows) {
    parts.push(section(header,
      'The Tischler system is a stainless steel multi-point locking system for garden doors and a corrosion resistant metal alloy perimeter locking system at jamb, head and sill for windows.' + BB +
      'This locking system creates a tight seal in addition to extra protection against intrusion.' + BB +
      'Standard aluminum construction handles in white or dark brown. One interior handle per window (offset handles for outswing casement.) Outswing casements with sliding casement stays. Garden doors with interior/exterior operable lever handles with lock cylinder (active sash) and interior operable handle (inactive sash.) Exterior dummy handle (inactive sash) is optional.' + BB +
      'Standard TUS lock cylinders (not re-keyable.)' +
      crankOutText
    ));
  } else if (hasDoorLike) {
    parts.push(section(header,
      'The Tischler system is a stainless steel multi-point locking system for garden doors.' + BB +
      'This locking system creates a tight seal in addition to extra protection against intrusion.' + BB +
      'Garden doors with interior/exterior operable lever handles with lock cylinder (active sash) and interior operable handle (inactive sash.) Exterior dummy handle (inactive sash) is optional.' + BB +
      'Standard TUS lock cylinders (not re-keyable.)'
    ));
  } else if (hasWindows) {
    parts.push(section(header,
      'The Tischler system is a corrosion resistant metal alloy perimeter locking system at jamb, head and sill for windows.' + BB +
      'This locking system creates a tight seal in addition to extra protection against intrusion.' + BB +
      'Standard aluminum construction handles in white or dark brown. One interior handle per window (offset handles for outswing casement.) Outswing casements with sliding casement stays.' +
      crankOutText
    ));
  }

  if (activeList.some((t) => DOMESTIC_DOOR_TYPES_LOWER.has(t))) {
    parts.push(section('DOMESTIC DOORS:',
      'Doors incorporate a multi-point locking corrosion resistant metal alloy rough hardware.' + BB +
      'Standard aluminum construction handles in white or dark brown. Domestic doors with interior/exterior operable lever handles with lock cylinder (active sash) and interior operable handle (inactive sash.) Exterior dummy handle (inactive sash) is optional. Standard TUS lock cylinders (not re-keyable.) Upgraded (final) finish hardware and re-keyable cylinders at an additional cost.' + BB +
      'Domestic doors with 4”x4” butt hinges.'
    ));
  }

  if (activeList.some((t) => FOLDING_DOOR_TYPES_LOWER.has(t))) {
    parts.push(section('FOLDING DOORS:',
      'Folding doors incorporate a multi-point locking corrosion resistant metal alloy rough hardware. This locking system creates a tight seal in addition to extra protection against intrusion.' + BB +
      'Standard aluminum construction handles in white or dark brown. Folding doors with interior operable handles (active sash) and exterior pulls. Upgraded (final) finish hardware at an additional cost.'
    ));
  }

  const HUNG_KINDS = [
    { label: 'Single', concealedKey: 'Single Hung Concealed Balance', wcKey: 'Single Hung Weight and Chain' },
    { label: 'Double', concealedKey: 'Double Hung Concealed Balance', wcKey: 'Double Hung Weight and Chain' },
    { label: 'Triple', concealedKey: 'Triple Hung Concealed Balance', wcKey: 'Triple Hung Weight and Chain' },
  ];
  for (const { label, concealedKey, wcKey } of HUNG_KINDS) {
    if (activeTypes.has(concealedKey)) {
      parts.push(section(`${label.toUpperCase()} HUNG CONCEALED BALANCE:`,
        `${label} hung window operation is a concealed stainless steel constant force spring balance system allowing sash operation of equal force. Clear opening is subject to size and sash weight` + BB +
        `${label} with standard polished brass sash locks and stops.`
      ));
    }
    if (activeTypes.has(wcKey)) {
      parts.push(section(`${label.toUpperCase()} HUNG WEIGHT & CHAIN:`,
        `${label} hung window operation is a weight and chain balance system. Chains and pulleys are supplied in standard solid brass. Weights and chains are supplied loose for installation on site by others` + BB +
        `${label} with standard polished brass sash locks and stops.`
      ));
    }
  }

  // Include L&R D pattern types (stored as 'L&R D: Pattern X') alongside bare 'L&R D'.
  const lrActiveTypes = Array.from(activeTypes).filter(
    (t) => t === 'L&R D' || t.startsWith('L&R D:') || t === 'Lift and Roll Window'
  );
  if (lrActiveTypes.length > 0) {
    // Product-type options are keyed by 'L&R D' (the bare type); pattern sub-type
    // keys share the same options, so merge under the bare key.
    const lrOptions = lrActiveTypes.flatMap((t) => pto[t] ?? pto['L&R D'] ?? []);
    if (lrOptions.includes('SS RH')) {
      parts.push(section('LIFT & ROLL DOORS with SS / RH:',
        'Lift-rolling doors with corrosion resistant metal alloy rough hardware with stainless steel meeting stile interlocks and locking bolts. Operation lifts the sash disengaging seals and locking mechanism for smooth operation. Closing operation engages perimeter seal and secures sash to the jamb with multiple locking devices.' + BB +
        'Lift-rolling doors with interior operable handles and recessed exterior pulls. Upgraded (final) finish hardware and re-keyable cylinders at an additional cost.'
      ));
    }
    if (lrOptions.includes('Standard RH')) {
      parts.push(section('LIFT & ROLL DOORS:',
        'Lift rolling doors with corrosion resistant metal alloy rough hardware. Operation lifts the sash disengaging seals and locking mechanism for smooth operation. Closing operation engages perimeter seal and secures sash to the jamb with multiple locking devices' + BB +
        'Lift-rolling doors with interior operable handles and recessed exterior pulls. Upgraded (final) finish hardware and re-keyable cylinders at an additional cost.'
      ));
    }
  }

  return parts.join(BB);
}

const OUTSWING_WINDOW_TYPES_LOWER = new Set(['push outswing', 'crank outswing']);

function buildFinialSectionText(
  activeTypes: Set<string>,
  finials: string,
  hingeFinishSpec: string,
): string {
  const activeList = Array.from(activeTypes).map((t) => t.toLowerCase());
  const hasOutswingWindows = activeList.some((t) => OUTSWING_WINDOW_TYPES_LOWER.has(t));
  const hasSwingDoors = activeList.some((t) => GD_TYPES_LOWER.has(t) || HOUSE_DOOR_TYPES_LOWER.has(t));

  if (!hasOutswingWindows && !hasSwingDoors) return '';
  if (!finials || !hingeFinishSpec) return '';

  const hasFinial = finials === 'Yes';
  const isCustomFinish = hingeFinishSpec === 'Premium Custom Finish (Specify in Notes)';
  const isBrushedSS = hingeFinishSpec === 'Base (Brushed Stainless Steel)';

  const subject = hasOutswingWindows && hasSwingDoors
    ? 'Outswing turn only windows & Swing doors'
    : hasOutswingWindows
      ? 'Outswing turn only windows'
      : 'Swing doors';

  if (!hasFinial && isCustomFinish) {
    return `${subject} with flat top stainless steel hinges. Hinges are available in a variety of finishes. Decorative finials are not included but are available at an additional cost. (finials and finish to be selected during the shop drawing phase.)`;
  }

  if (hasFinial && isCustomFinish) {
    return `${subject} with stainless steel hinges. Hinges are available in a variety of finishes with five different finial options (finials and finish to be selected during the shop drawing phase.)`;
  }

  if (!hasFinial && isBrushedSS) {
    return `${subject} with flat top brushed stainless steel hinges. Decorative finials and custom finishes are not included but are available at an additional cost.`;
  }

  return '';
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
  tdl?: string;
  tdlCustom?: string;
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
  finials?: string;
  hingeFinishSpecification?: string;
  quoteTotals: {
    euroWindows: { full: string; pct: string; final: string; finalAdj: string };
    doubleHung: { full: string; pct: string; final: string; finalAdj: string };
    euroDoors: { full: string; pct: string; final: string; finalAdj: string };
  };
  grandTotalAdjustment?: { full: string; pct: string; final: string; finalAdj: string };
  /** Multi-location jobs store their own quoteTotals per sub-location; the
   * top-level `quoteTotals` above is left blank/unused in that case. */
  hasMultipleLocations?: boolean;
  subLocations?: Array<{ label?: string; quoteTotals?: SummaryForPlaceholders['quoteTotals'] }>;
  addOns: {
    windowScreens: { qty: string; final: string; [k: string]: unknown };
    doorScreenSash: { qty: string; final: string; [k: string]: unknown };
    entryDoor: { qty: string; final: string; [k: string]: unknown };
    jambExtensions: { final: string; [k: string]: unknown };
    magneticContact: { qty: string; final: string; [k: string]: unknown };
    finalFinish: { final: string; [k: string]: unknown };
    installation: { final: string; installationRows?: Array<{ label: string; price: string }>; [k: string]: unknown };
    customRows?: Array<{ item: string; qty: string; details: string; final: string; [k: string]: unknown }>;
    deductRows?: Array<{ item: string; qty: string; details: string; final: string; [k: string]: unknown }>;
    [k: string]: unknown;
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

/**
 * Parse an SDL/TDL value like "22MM" and convert it to a fractional-inch
 * string (e.g. `7/8"`). Returns '' if no leading number is found (blank or
 * "Custom Option").
 */
function sdlTdlToFractionalInches(raw: string): string {
  const m = (raw || '').match(/(\d+(?:\.\d+)?)/);
  return m ? mmToFractionalInches(parseFloat(m[1] ?? '0')) : '';
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
  // L&R D with a sub-pattern (e.g. 'L&R D: Pattern 1F') must NOT go through
  // pluralizeTypeName's compound-name splitting because 'Pattern 1F' has no
  // known plural rule — return it directly after the abbreviation expansion.
  if (/^L&R D:/.test(name)) {
    return 'Lift & Roll Door: ' + name.slice('L&R D:'.length).trim();
  }
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
  // L&R D / Lift and Roll — jamb depth depends on the pattern sub-type
  if (lo.includes('l&r') || (lo.includes('lift') && (lo.includes('roll') || lo.includes('rolling')))) {
    // Pattern-specific jamb depths; extracted from typeName after the colon (e.g. 'L&R D: Pattern 1F')
    const patternMatch = typeName.match(/Pattern\s+(\S+)/i);
    const pattern = patternMatch ? patternMatch[1]!.toUpperCase() : '';
    if (pattern === '1F' || pattern === '11') return '7-7/8"';
    if (pattern === 'F1F') return '7-9/16"';
    if (pattern === 'F11F') return '9-5/8"';
    if (pattern === 'P1') return '6-1/16"';
    if (pattern === 'P12') return '9-9/16"';
    if (pattern === '12F') return '11-1/2"';
    if (pattern === '123F') return '15-7/16"';
    if (pattern === 'P123') return '13-1/2"';
    if (pattern === 'P11P') return '12"';
    if (pattern === 'F1221F') return '15-9/16"';
    if (pattern === 'P1221P') return '18"';
    if (pattern === 'P123321P') return '13-15/16"';
    if (pattern === 'F123321F') return '15-9/16"';
    // F12344321F, P12344321P and any other unlisted pattern: fall back to
    // the generic note
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

  type CategoryEntry = { label: string; amount: string };

  const getCategoryEntries = (qt: SummaryForPlaceholders['quoteTotals'] | undefined): CategoryEntry[] => {
    const categories: Array<[string, string | undefined]> = [
      ['Double Hungs:', qt?.doubleHung?.finalAdj],
      ['Euro Windows:', qt?.euroWindows?.finalAdj],
      ['Doors:', qt?.euroDoors?.finalAdj],
    ];
    return categories
      .filter(([, amount]) => (parseInt(amount || '0', 10) || 0) !== 0)
      .map(([label, amount]) => ({ label, amount: formatDollar(amount) }));
  };

  const baseBidAmount = formatDollar(String(grandTotal));

  // Build a series of <pricingrow> elements. The PDF renderer converts these
  // to drawKeyValueRow calls (body font, right-aligned amount); the web preview
  // renders them as flex rows. This replaces the old monospace-font / nbsp-padding
  // approach which used Courier instead of the document's body font.
  const makePricingRows = (
    entries: CategoryEntry[],
    baseBidLabel: string,
    baseBidValue: string,
  ): string => {
    const rows: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const isLast = i === entries.length - 1;
      rows.push(`<pricingrow label="${entry.label}" value="${entry.amount}"${isLast ? ' underline="true"' : ''}></pricingrow>`);
    }
    rows.push(`<pricingrow label="${baseBidLabel}" value="${baseBidValue}" bold="true"></pricingrow>`);
    return rows.join('');
  };

  const finalEntries = getCategoryEntries(effQuoteTotals);
  const finalPrice = makePricingRows(finalEntries, 'BASE BID PRICE:', baseBidAmount);

  const multipleLocationsFinalPrice = (() => {
    if (!summary.hasMultipleLocations || !summary.subLocations?.length) {
      return finalPrice;
    }
    const allEntries: CategoryEntry[] = [];
    for (const loc of summary.subLocations) {
      const locLabel = loc.label || 'Location';
      for (const cat of getCategoryEntries(loc.quoteTotals)) {
        allEntries.push({ label: `${locLabel} – ${cat.label}`, amount: cat.amount });
      }
    }
    return makePricingRows(allEntries, 'BASE BID PRICE:', baseBidAmount);
  })();

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
    // Fractional-inch equivalent of the SDL/TDL mm value (e.g. "22MM" → `7/8"`),
    // for use in muntin/mullion spec text like "a {{sdlInches}} simulated
    // divided lite (SDL) muntin and mullion system." Prefer the custom value
    // when "Custom Option" was picked, so a custom mm entry (e.g. "30mm") still
    // converts — the raw select value ("Custom Option") has no digits to parse.
    sdlInches: sdlTdlToFractionalInches(summary.sdlCustom || summary.sdl || ''),
    tdlType: summary.tdlCustom || summary.tdl || '',
    tdlInches: sdlTdlToFractionalInches(summary.tdlCustom || summary.tdl || ''),
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
    FinalPrice: finalPrice,
    MultipleLocationsFinalPrice: multipleLocationsFinalPrice,

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
      const lines: string[] = [];
      if (base > 0) lines.push(`Installation: ${formatDollar(String(base))}`);
      rows.forEach(r => lines.push(`${r.label}: ${r.price}`));
      lines.push(`Total: ${formatDollar(String(grandTotal))}`);
      return lines.join('<br>');
    })(),
    options: (() => {
      const ao = summary.addOns as Record<string, any>;
      if (!ao) return '';
      const fmtAmt = (v: string | undefined): string => {
        const n = parseFloat((v || '').replace(/[^0-9.-]/g, ''));
        if (!n) return '';
        return '$\u00A0' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };
      const hasAmt = (v: string | undefined) => Math.abs(parseFloat((v || '').replace(/[^0-9.-]/g, '')) || 0) > 0;
      const qtyStr = (qty: string | undefined) => {
        const n = parseFloat(qty || '');
        return n > 0 ? ` (Qty.\u00A0${qty}.)` : '';
      };
      const escAttr = (s: string): string =>
        s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      // Each row renders via the same <pricingrow> mechanism used for the
      // BASE BID PRICE breakdown: "ADD:"/"DEDUCT:" + item name underlined
      // (labelunderline="true"), amount right-aligned against the page margin.
      // The qty/details clause goes in labelsuffix so it renders WITHOUT
      // the underline. Three nbsp separate the "ADD:"/"DEDUCT:" prefix from
      // the item name — plain spaces get collapsed by the browser preview.
      const GAP = '\u00A0\u00A0\u00A0';
      const makeRow = (
        kind: 'ADD' | 'DEDUCT',
        itemLabel: string,
        qty: string | undefined,
        details: string,
        amount: string,
      ): string => {
        const suffix = `${qtyStr(qty)}${details ? ' ' + details : ''}.`;
        return `<pricingrow label="${escAttr(`${kind}:${GAP}${itemLabel}`)}" labelsuffix="${escAttr(suffix)}" value="${escAttr(amount)}" labelunderline="true"></pricingrow>`;
      };
      const rows: string[] = [];

      // Named add-on rows
      const named: Array<{ key: string; label: string }> = [
        { key: 'windowScreens',      label: 'Window Screens' },
        { key: 'doorScreenSash',     label: 'Door Screen Sash' },
        { key: 'entryDoor',          label: 'Entry Door' },
        { key: 'jambExtensions',     label: 'Jamb Extensions' },
        { key: 'magneticContact',    label: 'Magnetic Alarm Contacts' },
        { key: 'splitFinish',        label: 'Split Finish' },
        { key: 'integratedContacts', label: 'Integrated Contacts' },
        { key: 'poolContacts',       label: 'Pool Alarm Contacts' },
        { key: 'rollScreens',        label: 'Roll Screens' },
        { key: 'shadeBoxes',         label: 'Shade Boxes' },
        { key: 'geniusLock',         label: 'Genius Lock' },
        { key: 'finalFinish',        label: 'Final Finish' },
      ];
      for (const { key, label } of named) {
        const row = ao[key] as Record<string, string> | undefined;
        if (!row || !hasAmt(row.final)) continue;
        const details = [row.frameType, row.meshType, row.woodFrame, row.details]
          .filter(Boolean).join('. ');
        rows.push(makeRow('ADD', label, row.qty, details, fmtAmt(row.final)));
      }
      // Custom add rows
      for (const cr of (ao.customRows || []) as Array<Record<string, string>>) {
        if (!hasAmt(cr.final)) continue;
        rows.push(makeRow('ADD', (cr.item || '').trim(), cr.qty, cr.details || '', fmtAmt(cr.final)));
      }
      // Deduct rows
      for (const dr of (ao.deductRows || []) as Array<Record<string, string>>) {
        if (!hasAmt(dr.final)) continue;
        const n = Math.abs(parseFloat((dr.final || '').replace(/[^0-9.-]/g, '')) || 0);
        const amount = `($\u00A0${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        rows.push(makeRow('DEDUCT', (dr.item || '').trim(), dr.qty, dr.details || '', amount));
      }
      return rows.join('');
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
            if (t === 'L&R D' && r[subOptMap[f]!]) return `L&R D: ${r[subOptMap[f]!]}`;
            return t;
          }).filter((t): t is string => Boolean(t))
        )
      );

      const seenDisplayNames = new Set<string>();

      for (const [typeName, opts] of Object.entries(pto)) {
        // L&R D pattern keys ('L&R D: Pattern X') are formatted directly as single
        // entries — don't let the colon-split path below mis-pluralise 'Pattern 1Fs'.
        if (typeName.startsWith('L&R D:')) {
          if (activeTypes.size > 0 && !activeTypes.has(typeName)) continue;
          if (!Array.isArray(opts) || opts.length === 0) continue;
          const validSet = new Set(getValidOptionsForType(typeName));
          const filteredOpts = opts.filter((o: string) => validSet.has(o));
          if (filteredOpts.length === 0) continue;
          const displayName = expandProductTypeName(typeName);
          if (seenDisplayNames.has(displayName)) continue;
          seenDisplayNames.add(displayName);
          lines.push(buildFirstLine(typeName, filteredOpts) + '<br>');
          continue;
        }

        // Bare 'L&R D' key: emit entries for any active patterns that don't have
        // their own pto key (acts as a fallback / pre-patterns legacy path).
        const isLrBase = typeName === 'L&R D';
        const isActive = activeTypes.has(typeName) ||
          (isLrBase && Array.from(activeTypes).some((t) => t.startsWith('L&R D:')));
        if (activeTypes.size > 0 && !isActive) continue;
        if (!Array.isArray(opts) || opts.length === 0) continue;
        const validSet = new Set(getValidOptionsForType(typeName));
        const filteredOpts = opts.filter((o: string) => validSet.has(o));
        if (filteredOpts.length === 0) continue;

        if (isLrBase) {
          // Only emit patterns that don't have their own pto entry (those are
          // already handled by the 'L&R D: X' branch above).
          const unhandledPatterns = Array.from(activeTypes).filter(
            (t) => t.startsWith('L&R D:') && !((pto[t] ?? []).length > 0)
          );
          const bareActive = activeTypes.has('L&R D');
          for (const patternType of unhandledPatterns) {
            const displayName = expandProductTypeName(patternType);
            if (seenDisplayNames.has(displayName)) continue;
            seenDisplayNames.add(displayName);
            lines.push(buildFirstLine(patternType, filteredOpts) + '<br>');
          }
          if (!bareActive) continue;
        }

        const typeNames = typeName.includes(':')
          ? typeName.split(':').map((s: string) => s.trim()).filter(Boolean)
          : [typeName];
        for (const singleName of typeNames) {
          const displayName = expandProductTypeName(singleName);
          if (seenDisplayNames.has(displayName)) continue;
          seenDisplayNames.add(displayName);
          const cat = getProductNfrcCategory(singleName);
          const effectiveGlass = cat === 'doubleHung' ? hungGlassType : glassType;
          const nfrcBlock = formatNfrcBlock(singleName, effectiveGlass, filteredOpts);
          if (nfrcBlock) {
            lines.push(nfrcBlock);
          } else {
            lines.push(buildFirstLine(singleName, filteredOpts) + '<br>');
          }
        }
      }

      // Final pass: emit any active L&R D patterns not yet in the output.
      // This covers patterns with no pto options set — we can still show the
      // pattern name and pattern-specific jamb depth without a sash thickness.
      for (const patternType of Array.from(activeTypes)) {
        if (!patternType.startsWith('L&R D:')) continue;
        const displayName = expandProductTypeName(patternType);
        if (seenDisplayNames.has(displayName)) continue;
        seenDisplayNames.add(displayName);
        lines.push(buildFirstLine(patternType, []) + '<br>');
      }

      return lines.join('<br>');
    })(),
    roughHardware: (() => {
      const rhPto = ((summary as any).productTypeOptions as Record<string, string[]> | undefined) ?? {};
      const rhFields = ['type', 'type2', 'type3', 'type4'];
      const rhSubOpt: Record<string, string> = {
        type: 'typeSubOption', type2: 'type2SubOption',
        type3: 'type3SubOption', type4: 'type4SubOption',
      };
      const rhRows: unknown[] = [
        ...((summary as any).rows || []),
        ...((summary as any).doorRows || []),
        ...(((summary as any).subLocations || []) as any[]).flatMap(
          (l: any) => [...(l.rows || []), ...(l.doorRows || [])]
        ),
      ];
      const rhActive = new Set<string>(
        rhRows.flatMap((r: any) =>
          rhFields.map((f) => {
            const t = r[f];
            if (!t) return null;
            if (t === 'Fixed with Sash' && r[rhSubOpt[f]!]) return `Fixed with Sash: ${r[rhSubOpt[f]!]}`;
            if (t === 'L&R D' && r[rhSubOpt[f]!]) return `L&R D: ${r[rhSubOpt[f]!]}`;
            return t;
          }).filter((t): t is string => Boolean(t))
        )
      );
      return buildRoughHardwareText(rhActive, rhPto);
    })(),
    finialSection: (() => {
      const fiFields = ['type', 'type2', 'type3', 'type4'];
      const fiSubOpt: Record<string, string> = {
        type: 'typeSubOption', type2: 'type2SubOption',
        type3: 'type3SubOption', type4: 'type4SubOption',
      };
      const fiRows: unknown[] = [
        ...((summary as any).rows || []),
        ...((summary as any).doorRows || []),
        ...(((summary as any).subLocations || []) as any[]).flatMap(
          (l: any) => [...(l.rows || []), ...(l.doorRows || [])]
        ),
      ];
      const fiActive = new Set<string>(
        fiRows.flatMap((r: any) =>
          fiFields.map((f) => {
            const t = r[f];
            if (!t) return null;
            if (t === 'Fixed with Sash' && r[fiSubOpt[f]!]) return `Fixed with Sash: ${r[fiSubOpt[f]!]}`;
            if (t === 'L&R D' && r[fiSubOpt[f]!]) return `L&R D: ${r[fiSubOpt[f]!]}`;
            return t;
          }).filter((t): t is string => Boolean(t))
        )
      );
      return buildFinialSectionText(fiActive, summary.finials || '', summary.hingeFinishSpecification || '');
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
            const lines: string[] = [];
            if (base > 0) lines.push(`Installation: ${formatDollar(String(base))}`);
            rows.forEach(r => lines.push(`${r.label}: ${r.price}`));
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
