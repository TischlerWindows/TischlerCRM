import { z } from 'zod';

/**
 * Block-level classifier on SpecPreset. Determines HOW the renderer draws
 * the block. Templates are rendered as an ordered list of these blocks;
 * a blank template (no presets) renders an empty page.
 *
 * Categories:
 *   - *_ITEM  / FREE_TEXT — rich-text content blocks the admin authors
 *   - *_BLOCK / HEADER    — structural layout blocks with template-level
 *                           labels and data pulled from the summary
 */
export const BLOCK_TYPES = [
  'LETTERHEAD',
  'FREE_TEXT',
  'SPECIFICATION_ITEM',
  'OPTION_ITEM',
  'EXCLUSION_ITEM',
  'INSTALLATION_ITEM',
  'PRICING_TABLE',
  'BASE_BID_LINE',
  'ADDITIONS_TABLE',
  'EXCLUSIONS_HEADER',
  'CLOSING_SIGNATURE',
  'PAGE_BREAK',
  'INSTALLATION_HEADER',
  'FOOTER',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const blockTypeSchema = z.enum(BLOCK_TYPES);

// ─────────────────────────────────────────────────────────────────────
// Per-type config shapes. All are optional fields with sensible defaults
// in the renderer — admins only need to provide overrides they care about.
// ─────────────────────────────────────────────────────────────────────

/**
 * LETTERHEAD — the page-1 logo band. Image rendering is owned by the
 * pageLogos system on QuoteTemplate; this config controls space + the
 * text-wordmark fallback when no logo rule matches page 1.
 */
export interface LetterheadConfig {
  /** Custom text shown if no first-page logo rule matches. */
  wordmarkText?: string;
  /** Smaller subtitle under the wordmark fallback. */
  taglineText?: string;
  /** Show the red separator rule under the logo band. */
  showRule?: boolean;
}

export const letterheadConfigSchema: z.ZodType<LetterheadConfig> = z.object({
  wordmarkText: z.string().max(80).optional(),
  taglineText: z.string().max(120).optional(),
  showRule: z.boolean().optional(),
});

/**
 * PRICING_TABLE — the "PRICING" heading + per-row labels. Values still
 * pull from the active summary so admins can't fake numbers.
 */
export interface PricingTableConfig {
  heading?: string;
  rowLabels?: {
    euroWindows?: string;
    doubleHung?: string;
    euroDoors?: string;
  };
  hide?: {
    euroWindows?: boolean;
    doubleHung?: boolean;
    euroDoors?: boolean;
  };
}

export const pricingTableConfigSchema: z.ZodType<PricingTableConfig> = z.object({
  heading: z.string().max(80).optional(),
  rowLabels: z
    .object({
      euroWindows: z.string().max(80).optional(),
      doubleHung: z.string().max(80).optional(),
      euroDoors: z.string().max(80).optional(),
    })
    .optional(),
  hide: z
    .object({
      euroWindows: z.boolean().optional(),
      doubleHung: z.boolean().optional(),
      euroDoors: z.boolean().optional(),
    })
    .optional(),
});

export interface BaseBidLineConfig {
  /** Label override — default "BASE BID PRICE". */
  label?: string;
}

export const baseBidLineConfigSchema: z.ZodType<BaseBidLineConfig> = z.object({
  label: z.string().max(80).optional(),
});

export interface AdditionsTableConfig {
  /** Heading override — default "ADDITIONS OR DEDUCTIONS TO OUR BASE BID". */
  heading?: string;
  /** Per-row label overrides keyed by addon key. */
  rowLabels?: Record<string, string>;
  /** Hide individual rows. */
  hide?: Record<string, boolean>;
}

export const additionsTableConfigSchema: z.ZodType<AdditionsTableConfig> = z.object({
  heading: z.string().max(120).optional(),
  rowLabels: z.record(z.string()).optional(),
  hide: z.record(z.boolean()).optional(),
});

export interface ExclusionsHeaderConfig {
  /** Heading override — default "Our Base Bid does not include:" */
  heading?: string;
}

export const exclusionsHeaderConfigSchema: z.ZodType<ExclusionsHeaderConfig> = z.object({
  heading: z.string().max(120).optional(),
});

export interface ClosingSignatureConfig {
  /** Closing salutation — default "Sincerely,". */
  closingText?: string;
  /** Company line under the signature — default "Tischler und Sohn". */
  companyLine?: string;
  /** When true, use the template's signature font on the salesman name. */
  useSignatureFont?: boolean;
  /** When true, include "Estimator: ..." line below salesman. */
  showEstimator?: boolean;
}

export const closingSignatureConfigSchema: z.ZodType<ClosingSignatureConfig> = z.object({
  closingText: z.string().max(80).optional(),
  companyLine: z.string().max(80).optional(),
  useSignatureFont: z.boolean().optional(),
  showEstimator: z.boolean().optional(),
});

export interface InstallationHeaderConfig {
  /** Heading override — default "INSTALLATION". */
  heading?: string;
  /** Label for the cost row — default "Installation Cost:". */
  costLabel?: string;
}

export const installationHeaderConfigSchema: z.ZodType<InstallationHeaderConfig> = z.object({
  heading: z.string().max(80).optional(),
  costLabel: z.string().max(80).optional(),
});

export interface FooterConfig {
  /** Left footer text — default "Tischler und Sohn  |  Confidential". */
  text?: string;
  /** Hide the "Page N of M" indicator. */
  hidePageNumbers?: boolean;
}

export const footerConfigSchema: z.ZodType<FooterConfig> = z.object({
  text: z.string().max(160).optional(),
  hidePageNumbers: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────────────
// Combined validator — picks the right schema based on blockType.
// ─────────────────────────────────────────────────────────────────────

const CONFIG_SCHEMAS: Partial<Record<BlockType, z.ZodType<unknown>>> = {
  LETTERHEAD: letterheadConfigSchema,
  PRICING_TABLE: pricingTableConfigSchema,
  BASE_BID_LINE: baseBidLineConfigSchema,
  ADDITIONS_TABLE: additionsTableConfigSchema,
  EXCLUSIONS_HEADER: exclusionsHeaderConfigSchema,
  CLOSING_SIGNATURE: closingSignatureConfigSchema,
  INSTALLATION_HEADER: installationHeaderConfigSchema,
  FOOTER: footerConfigSchema,
};

export function validateBlockConfig(
  blockType: BlockType,
  raw: unknown,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const schema = CONFIG_SCHEMAS[blockType];
  if (!schema) {
    if (raw === null || raw === undefined) return { ok: true, value: null };
    return { ok: true, value: raw };
  }
  const parsed = schema.safeParse(raw ?? {});
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid config' };
  }
  return { ok: true, value: parsed.data };
}

// ─────────────────────────────────────────────────────────────────────
// Section→BlockType inference for legacy presets (blockType is null).
// ─────────────────────────────────────────────────────────────────────

export type LegacySection = 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION' | 'CONSTANT';

export function inferBlockType(section: LegacySection, title: string): BlockType {
  if (section === 'SPECIFICATION') return 'SPECIFICATION_ITEM';
  if (section === 'OPTION') return 'OPTION_ITEM';
  if (section === 'EXCLUSION') return 'EXCLUSION_ITEM';
  if (section === 'INSTALLATION') return 'INSTALLATION_ITEM';
  // CONSTANT: closing presets identified by title pattern get classified
  // as CLOSING_SIGNATURE-adjacent FREE_TEXT (no separate enum value).
  if (/closing|signature|sincerely/i.test(title)) return 'FREE_TEXT';
  return 'FREE_TEXT';
}

/**
 * UI metadata for each block type — used by the palette and editor.
 */
export interface BlockTypeMeta {
  type: BlockType;
  label: string;
  description: string;
  /** Group in the + New palette dropdown. */
  group: 'Layout' | 'Content' | 'Data';
}

export const BLOCK_TYPE_META: Record<BlockType, BlockTypeMeta> = {
  LETTERHEAD: {
    type: 'LETTERHEAD',
    label: 'Letterhead',
    description: 'Logo band + red rule at top of page',
    group: 'Layout',
  },
  FREE_TEXT: {
    type: 'FREE_TEXT',
    label: 'Free Text',
    description: 'Rich-text paragraph (intro, body, etc.)',
    group: 'Content',
  },
  SPECIFICATION_ITEM: {
    type: 'SPECIFICATION_ITEM',
    label: 'Specification Item',
    description: 'Numbered (1) Title — body',
    group: 'Content',
  },
  OPTION_ITEM: {
    type: 'OPTION_ITEM',
    label: 'Option / Addition',
    description: 'Optional add-on line with body',
    group: 'Content',
  },
  EXCLUSION_ITEM: {
    type: 'EXCLUSION_ITEM',
    label: 'Exclusion Item',
    description: 'Bullet item under the exclusions header',
    group: 'Content',
  },
  INSTALLATION_ITEM: {
    type: 'INSTALLATION_ITEM',
    label: 'Installation Detail',
    description: 'Body block on the installation page',
    group: 'Content',
  },
  PRICING_TABLE: {
    type: 'PRICING_TABLE',
    label: 'Pricing Table',
    description: 'Heading + per-product rows from the summary',
    group: 'Data',
  },
  BASE_BID_LINE: {
    type: 'BASE_BID_LINE',
    label: 'Base Bid Total',
    description: '"BASE BID PRICE" line with the summary grand total',
    group: 'Data',
  },
  ADDITIONS_TABLE: {
    type: 'ADDITIONS_TABLE',
    label: 'Additions Table',
    description: 'Addons block (screens, jambs, etc.) from the summary',
    group: 'Data',
  },
  EXCLUSIONS_HEADER: {
    type: 'EXCLUSIONS_HEADER',
    label: 'Exclusions Header',
    description: '"Our base bid does not include:" header line',
    group: 'Layout',
  },
  CLOSING_SIGNATURE: {
    type: 'CLOSING_SIGNATURE',
    label: 'Closing Signature',
    description: '"Sincerely," + signature + company line',
    group: 'Layout',
  },
  PAGE_BREAK: {
    type: 'PAGE_BREAK',
    label: 'Page Break',
    description: 'Force a new page',
    group: 'Layout',
  },
  INSTALLATION_HEADER: {
    type: 'INSTALLATION_HEADER',
    label: 'Installation Header',
    description: '"INSTALLATION" page title + cost row',
    group: 'Layout',
  },
  FOOTER: {
    type: 'FOOTER',
    label: 'Footer',
    description: 'Page footer text + page numbers',
    group: 'Layout',
  },
};
