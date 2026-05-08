/**
 * Placeholder resolver for the Quote PDF Builder.
 *
 * Replaces {{token}} markers in preset body text with actual values
 * from the summary and optional contact data.
 */

// ── Types ──────────────────────────────────────────────────────────

/** Subset of Summary fields used for token resolution. */
export interface SummaryForPlaceholders {
  name: string;
  opportunityNumber: string;
  plansDated: string;
  jobType: string;
  glassType: string;
  glassTypeCustom?: string;
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
  addOns: {
    windowScreens: { qty: string; final: string; [k: string]: unknown };
    doorScreenSash: { qty: string; final: string; [k: string]: unknown };
    entryDoor: { qty: string; final: string; [k: string]: unknown };
    jambExtensions: { final: string; [k: string]: unknown };
    magneticContact: { qty: string; final: string; [k: string]: unknown };
    finalFinish: { final: string; [k: string]: unknown };
    installation: { final: string; [k: string]: unknown };
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
  const num = parseInt(value, 10);
  if (isNaN(num)) return '$0.00';
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

/**
 * Format an ISO date string (YYYY-MM-DD) or similar to a readable date.
 * Returns "August 15, 2025" format, or the original string if unparseable.
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
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

// ── Token map builder ──────────────────────────────────────────────

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
    finishType = match ? match[1] : summary.finish;
  }

  // Parse last name from contact name as fallback
  const nameParts = (summary.contactReceivingQuote || '').trim().split(/\s+/);
  const fallbackLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

  // Calculate grand total
  const euroWindowsFinal = parseInt(summary.quoteTotals?.euroWindows?.finalAdj || '0', 10) || 0;
  const doubleHungFinal = parseInt(summary.quoteTotals?.doubleHung?.finalAdj || '0', 10) || 0;
  const euroDoorsFinal = parseInt(summary.quoteTotals?.euroDoors?.finalAdj || '0', 10) || 0;
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
    euroWindowsPrice: formatDollar(summary.quoteTotals?.euroWindows?.finalAdj),
    doubleHungPrice: formatDollar(summary.quoteTotals?.doubleHung?.finalAdj),
    euroDoorsPrice: formatDollar(summary.quoteTotals?.euroDoors?.finalAdj),
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
