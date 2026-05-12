import {
  buildQuoteContext,
  evaluatePresetDecision,
  getUnsupportedConditionFields,
  matchVariants,
  type QuoteContext,
  type SpecPresetData,
  type SummaryForConditions,
} from './quote-conditions';
import {
  buildTokenMap,
  resolveCustomTokens,
  resolveTokensWithDiagnostics,
  type ContactData,
  type CustomObjectData,
  type SummaryForPlaceholders,
  type TokenMappingRow,
} from './quote-placeholders';
import type { QuotePDFData } from './quote-pdf-renderer';

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

export interface ProposalAssemblyResult {
  context: QuoteContext;
  tokens: Record<string, string>;
  sections: Record<ProposalSection, SpecPresetData[]>;
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
      for (const variant of matched) {
        const resolved = resolveTokensWithDiagnostics(variant.body, tokens);
        const resolvedPreset = { ...preset, body: resolved.text };
        sections[sectionOf(preset)].push(resolvedPreset);
        for (const token of resolved.unresolvedTokens) {
          unresolvedTokens.push({ presetId: preset.id, token });
          warnings.push(`${preset.title} (variant ${variant.matchValue}): unresolved token {{${token}}}.`);
        }
      }
      includedBlocks.push({ ...block, reason: `${matched.length} variant(s) matched.` });
    } else {
      const bodyText = preset.body ?? '';
      if (!bodyText) continue;
      const resolved = resolveTokensWithDiagnostics(bodyText, tokens);
      const resolvedPreset = { ...preset, body: resolved.text };
      sections[sectionOf(preset)].push(resolvedPreset);
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
    includedBlocks,
    excludedBlocks,
    unresolvedTokens,
    warnings,
    pdfData: buildPdfData(summary, contact, sections, tokens, context),
  };
}
