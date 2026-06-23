/**
 * Placeholder resolver for the Proposal Builder.
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
function expandProductTypeName(name: string): string {
  return name
    .replace(/\bL&R D\b/g, 'Lift & Roll Door')
    .replace(/\bT & T\b/g, 'Turn & Tilt')
    .replace(/\bGD\b/g, 'Garden Door')
    .replace(/\bDH\b/g, 'Double Hung');
}

/** Format a single product type option, converting "XXmm Thick Sash" to fractional inches. */
function formatProductTypeOption(opt: string): string {
  const m = opt.match(/^(\d+(?:\.\d+)?)mm Thick Sash$/i);
  if (m && m[1]) return `${mmToFractionalInches(parseFloat(m[1]))} Thick Sash`;
  return opt;
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
    finishType = match?.[1] ?? summary.finish;
  }

  // Parse last name from contact name as fallback
  const nameParts = (summary.contactReceivingQuote || '').trim().split(/\s+/);
  const fallbackLastName = nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? '') : '';

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
      const lines = Object.entries(pto)
        .filter(([, opts]) => Array.isArray(opts) && opts.length > 0)
        .map(([typeName, opts]) => `${expandProductTypeName(typeName)} with ${opts.map(formatProductTypeOption).join(', ')}`);
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
