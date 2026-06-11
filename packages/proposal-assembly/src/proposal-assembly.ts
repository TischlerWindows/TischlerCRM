import {
  buildQuoteContext,
  evaluatePresetDecision,
  getUnsupportedConditionFields,
  matchVariants,
  type QuoteContext,
  type SpecPresetData,
  type SummaryForConditions,
} from './quote-conditions.js';
import {
  buildTokenMap,
  resolveCustomTokens,
  resolveTokensWithDiagnostics,
  type ContactData,
  type CustomObjectData,
  type SummaryForPlaceholders,
  type TokenMappingRow,
} from './quote-placeholders.js';
import type { QuotePDFData } from './pdf-data-types.js';

export type ProposalSection = 'CONSTANT' | 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION';

export interface ProposalTemplateData {
  id: string;
  name: string;
  presets: SpecPresetData[];
}

export interface ProposalBlockDiagnostic {
  id: string;
  title: string;
  section: ProposalSection;
  reason: string;
}

export interface ProposalUnresolvedToken {
  presetId: string;
  token: string;
}

/**
 * A single resolved preset in document order. Multi-variant presets
 * expand into multiple entries here, all sharing the same `presetId`.
 * The renderer iterates this list in order and dispatches per
 * `blockType` (carried by SpecPresetData via the new BlockType column).
 */
export interface OrderedBlock {
  presetId: string;
  /** Preset with tokens resolved. */
  preset: SpecPresetData;
  /** For variant expansions, the matched variant. Undefined otherwise. */
  variantValue?: string;
}

export interface ProposalAssemblyResult {
  context: QuoteContext;
  tokens: Record<string, string>;
  sections: Record<ProposalSection, SpecPresetData[]>;
  /**
   * Resolved presets in document order. New block-based templates
   * render exclusively from this list; legacy section-grouped rendering
   * uses `sections` instead.
   */
  orderedBlocks: OrderedBlock[];
  includedBlocks: ProposalBlockDiagnostic[];
  excludedBlocks: ProposalBlockDiagnostic[];
  unresolvedTokens: ProposalUnresolvedToken[];
  warnings: string[];
  pdfData: QuotePDFData;
}

type ProposalSummary = SummaryForConditions & SummaryForPlaceholders & {
  id?: string;
  linkedOpportunityId?: string;
};

function emptySections(): Record<ProposalSection, SpecPresetData[]> {
  return {
    CONSTANT: [],
    SPECIFICATION: [],
    OPTION: [],
    EXCLUSION: [],
    INSTALLATION: [],
  };
}

function sectionOf(preset: SpecPresetData): ProposalSection {
  return preset.section as ProposalSection;
}

function intValue(value: string | undefined | null): number {
  const parsed = parseInt(value || '0', 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function buildPdfData(
  summary: ProposalSummary,
  contact: ContactData | undefined,
  sections: Record<ProposalSection, SpecPresetData[]>,
  tokens: Record<string, string>,
  context: QuoteContext
): QuotePDFData {
  const euroWindowsVal = intValue(summary.quoteTotals?.euroWindows?.finalAdj);
  const doubleHungVal = intValue(summary.quoteTotals?.doubleHung?.finalAdj);
  const euroDoorsVal = intValue(summary.quoteTotals?.euroDoors?.finalAdj);

  return {
    contactName: summary.contactReceivingQuote || '',
    contactSalutation: contact?.salutation || '',
    contactLastName: contact?.lastName || tokens.contactLastName || '',
    companyName: summary.accountReceivingQuote || '',
    companyAddress: summary.accountShippingAddress || '',

    projectName: summary.name || '',
    projectNumber: summary.opportunityNumber || '',
    plansDated: tokens.plansDated || '',
    jobType: summary.jobType || '',
    address: summary.address || '',
    salesman: summary.salesman || '',
    estimator: summary.estimator || '',

    glassType: tokens.glassType || '',
    woodType: tokens.woodType || '',
    finishType: tokens.finishType || '',
    sdlType: tokens.sdlType || '',
    spacerBarColors: tokens.spacerBarColor || '',

    constantPresets: sections.CONSTANT,
    specPresets: sections.SPECIFICATION,
    optionPresets: sections.OPTION,
    exclusionPresets: sections.EXCLUSION,
    installationPresets: sections.INSTALLATION,

    euroWindowsPrice: tokens.euroWindowsPrice || '$0.00',
    doubleHungPrice: tokens.doubleHungPrice || '$0.00',
    euroDoorsPrice: tokens.euroDoorsPrice || '$0.00',
    grandTotal: tokens.grandTotal || '$0.00',
    hasEuroWindows: euroWindowsVal > 0,
    hasDoubleHung: doubleHungVal > 0,
    hasEuroDoors: euroDoorsVal > 0,

    windowScreensPrice: tokens.windowScreensPrice || '$0.00',
    windowScreensQty: tokens.windowScreensQty || '0',
    doorScreenSashPrice: tokens.doorScreenSashPrice || '$0.00',
    doorScreenSashQty: tokens.doorScreenSashQty || '0',
    entryDoorPrice: tokens.entryDoorPrice || '$0.00',
    entryDoorQty: tokens.entryDoorQty || '0',
    jambExtensionsPrice: tokens.jambExtensionsPrice || '$0.00',
    magneticContactPrice: tokens.magneticContactPrice || '$0.00',
    magneticContactQty: tokens.magneticContactQty || '0',
    finalFinishPrice: tokens.finalFinishPrice || '$0.00',
    installationPrice: tokens.installationPrice || '$0.00',

    hasInstallation: context.hasInstallation,
    hasMagneticContacts: context.hasMagneticContacts,
    hasFinalFinish: context.hasFinalFinish,
    hasWindowScreens: context.hasWindowScreens,
    hasDoorScreenSash: context.hasDoorScreenSash,
    hasEntryDoor: context.hasEntryDoor,
    hasJambExtensions: context.hasJambExtensions,
  };
}

export function assembleProposal({
  summary,
  template,
  contact,
  tokenMappings,
  opportunity,
  project,
}: {
  summary: ProposalSummary;
  template: ProposalTemplateData;
  contact?: ContactData;
  /** Custom token mappings from the database for the active template. */
  tokenMappings?: TokenMappingRow[];
  /** Pre-fetched Opportunity record data (Record.data) for custom token resolution. */
  opportunity?: CustomObjectData;
  /** Pre-fetched Project record data (Record.data) for custom token resolution. */
  project?: CustomObjectData;
}): ProposalAssemblyResult {
  const context = buildQuoteContext(summary);
  const builtInTokens = buildTokenMap(summary, contact);
  const customTokens = tokenMappings && tokenMappings.length > 0
    ? resolveCustomTokens({
        tokenMappings,
        builtInKeys: new Set(Object.keys(builtInTokens)),
        summary,
        contact,
        opportunity,
        project,
      })
    : {};
  // Built-in tokens take precedence over custom mappings with the same name.
  const tokens = { ...customTokens, ...builtInTokens };
  const sections = emptySections();
  const orderedBlocks: OrderedBlock[] = [];
  const includedBlocks: ProposalBlockDiagnostic[] = [];
  const excludedBlocks: ProposalBlockDiagnostic[] = [];
  const unresolvedTokens: ProposalUnresolvedToken[] = [];
  const warnings: string[] = [];

  for (const preset of [...(template.presets || [])].sort((a, b) => a.order - b.order)) {
    const decision = evaluatePresetDecision(preset, context);
    const block = {
      id: preset.id,
      title: preset.title,
      section: sectionOf(preset),
      reason: decision.reason,
    };

    if (!decision.included) {
      excludedBlocks.push(block);
      if (decision.reason.includes('No conditions')) {
        warnings.push(`${preset.title}: ${decision.reason}`);
      }
      continue;
    }

    if (preset.driverField && preset.variants?.length) {
      const matched = matchVariants(preset, context);
      if (matched.length === 0) {
        excludedBlocks.push({ ...block, reason: `No variant matched for driver "${preset.driverField}".` });
        continue;
      }

      const configObj = (preset.config as Record<string, unknown> | null) ?? {};
      const mergeVariants = !!configObj.mergeVariants;
      const universalBodyRaw = typeof configObj.universalBody === 'string' ? configObj.universalBody.trim() : '';
      const universalBodyPosition = configObj.universalBodyPosition === 'before' ? 'before' : 'after';

      // Resolve universal body once (shared across all variants).
      const resolvedUniversal = universalBodyRaw
        ? resolveTokensWithDiagnostics(universalBodyRaw, tokens)
        : null;
      if (resolvedUniversal) {
        for (const token of resolvedUniversal.unresolvedTokens) {
          unresolvedTokens.push({ presetId: preset.id, token });
          warnings.push(`${preset.title} (universal): unresolved token {{${token}}}.`);
        }
      }
      const universalText = resolvedUniversal?.text ?? '';

      // Helper — combine a variant/merged body with the universal text in one item.
      const withUniversal = (variantBody: string): string => {
        if (!universalText) return variantBody;
        return universalBodyPosition === 'before'
          ? `${universalText}<br/><br/>${variantBody}`
          : `${variantBody}<br/><br/>${universalText}`;
      };

      if (mergeVariants && matched.length > 1) {
        // Merge all matched variant bodies into one block, then attach universal text.
        const mergedBody = matched
          .map((v) => resolveTokensWithDiagnostics(v.body, tokens).text)
          .join('<br/><br/>');
        const resolvedPreset = { ...preset, body: withUniversal(mergedBody) };
        sections[sectionOf(preset)].push(resolvedPreset);
        orderedBlocks.push({ presetId: preset.id, preset: resolvedPreset });
        includedBlocks.push({ ...block, reason: `${matched.length} variant(s) matched (merged).` });
      } else {
        for (const variant of matched) {
          const resolved = resolveTokensWithDiagnostics(variant.body, tokens);
          const resolvedPreset = { ...preset, body: withUniversal(resolved.text) };
          sections[sectionOf(preset)].push(resolvedPreset);
          orderedBlocks.push({
            presetId: preset.id,
            preset: resolvedPreset,
            variantValue: variant.matchValue,
          });
          for (const token of resolved.unresolvedTokens) {
            unresolvedTokens.push({ presetId: preset.id, token });
            warnings.push(`${preset.title} (variant ${variant.matchValue}): unresolved token {{${token}}}.`);
          }
        }
        includedBlocks.push({ ...block, reason: `${matched.length} variant(s) matched.` });
      }
    } else {
      // Layout blocks (PRICING_TABLE, LETTERHEAD, PAGE_BREAK, etc.)
      // typically have no body — they're rendered from `config`. Don't
      // skip them just because `body` is empty.
      const bodyText = preset.body ?? '';
      const isLayoutOnly = !!preset.blockType && !bodyText;

      if (!bodyText && !isLayoutOnly) continue;

      const resolved = bodyText
        ? resolveTokensWithDiagnostics(bodyText, tokens)
        : { text: '', unresolvedTokens: [] as string[] };
      const resolvedPreset = { ...preset, body: resolved.text };
      sections[sectionOf(preset)].push(resolvedPreset);
      orderedBlocks.push({ presetId: preset.id, preset: resolvedPreset });
      includedBlocks.push(block);

      for (const token of resolved.unresolvedTokens) {
        unresolvedTokens.push({ presetId: preset.id, token });
        warnings.push(`${preset.title}: unresolved token {{${token}}}.`);
      }
    }
  }

  for (const field of getUnsupportedConditionFields(template.presets || [])) {
    warnings.push(`Unsupported condition field: ${field}.`);
  }

  return {
    context,
    tokens,
    sections,
    orderedBlocks,
    includedBlocks,
    excludedBlocks,
    unresolvedTokens,
    warnings,
    pdfData: buildPdfData(summary, contact, sections, tokens, context),
  };
}
