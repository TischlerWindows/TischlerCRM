import { z } from 'zod';

/**
 * A single per-page logo rule. Templates store an array of these on
 * `QuoteTemplate.pageLogos` as JSON. The PDF renderer evaluates each rule
 * after content is laid out (when total page count is known) and paints
 * the matching logo onto each page.
 */
export interface PageLogoRule {
  id: string;
  pageSelector: string;
  logoId: string;
  position: 'header' | 'footer';
  alignment: 'left' | 'center' | 'right';
  maxWidthPt: number;
  maxHeightPt: number;
  order: number;
}

export const pageLogoRuleSchema = z.object({
  id: z.string().min(1),
  pageSelector: z.string().min(1),
  logoId: z.string().min(1),
  position: z.enum(['header', 'footer']),
  alignment: z.enum(['left', 'center', 'right']),
  maxWidthPt: z.number().min(24).max(600),
  maxHeightPt: z.number().min(12).max(600),
  order: z.number().int().min(0),
});

export const pageLogosSchema = z.array(pageLogoRuleSchema);

export type ParsedSelector =
  | { kind: 'first' }
  | { kind: 'last' }
  | { kind: 'rest' }
  | { kind: 'all' }
  | { kind: 'even' }
  | { kind: 'odd' }
  | { kind: 'single'; page: number }
  | { kind: 'range'; from: number; to: number };

export interface SelectorParseError {
  error: string;
}

export function parsePageSelector(input: string): ParsedSelector | SelectorParseError {
  const raw = input.trim().toLowerCase();
  if (!raw) return { error: 'Selector cannot be empty' };

  switch (raw) {
    case 'first':
      return { kind: 'first' };
    case 'last':
      return { kind: 'last' };
    case 'rest':
      return { kind: 'rest' };
    case 'all':
      return { kind: 'all' };
    case 'even':
      return { kind: 'even' };
    case 'odd':
      return { kind: 'odd' };
  }

  if (/^\d+$/.test(raw)) {
    const page = Number(raw);
    if (page < 1) return { error: 'Page number must be at least 1' };
    return { kind: 'single', page };
  }

  const range = /^(\d+)\s*-\s*(\d+)$/.exec(raw);
  if (range) {
    const from = Number(range[1]);
    const to = Number(range[2]);
    if (from < 1 || to < 1) return { error: 'Page numbers must be at least 1' };
    if (from > to) return { error: `Range start (${from}) is greater than end (${to})` };
    return { kind: 'range', from, to };
  }

  return { error: `Unrecognized selector "${input}"` };
}

export function isSelectorError(
  parsed: ParsedSelector | SelectorParseError,
): parsed is SelectorParseError {
  return (parsed as SelectorParseError).error !== undefined;
}

/**
 * Given the full list of rules, return those that apply to `pageNumber`
 * (1-indexed) inside a document of `totalPages` pages. Rules are sorted
 * by `order` ascending. The `rest` selector only fires when no non-rest
 * rule matched the page.
 */
export function resolveRulesForPage(
  rules: PageLogoRule[],
  pageNumber: number,
  totalPages: number,
): PageLogoRule[] {
  if (pageNumber < 1 || pageNumber > totalPages) return [];

  const explicit: PageLogoRule[] = [];
  const rest: PageLogoRule[] = [];

  for (const rule of rules) {
    const parsed = parsePageSelector(rule.pageSelector);
    if (isSelectorError(parsed)) continue;

    if (parsed.kind === 'rest') {
      rest.push(rule);
      continue;
    }
    if (matchesPage(parsed, pageNumber, totalPages)) {
      explicit.push(rule);
    }
  }

  const matched = explicit.length > 0 ? explicit : rest;
  return [...matched].sort((a, b) => a.order - b.order);
}

function matchesPage(
  parsed: ParsedSelector,
  pageNumber: number,
  totalPages: number,
): boolean {
  switch (parsed.kind) {
    case 'first':
      return pageNumber === 1;
    case 'last':
      return pageNumber === totalPages;
    case 'all':
      return true;
    case 'even':
      return pageNumber % 2 === 0;
    case 'odd':
      return pageNumber % 2 === 1;
    case 'single':
      return pageNumber === parsed.page;
    case 'range':
      return pageNumber >= parsed.from && pageNumber <= parsed.to;
    case 'rest':
      return false;
  }
}
