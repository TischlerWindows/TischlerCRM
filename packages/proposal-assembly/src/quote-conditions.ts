/**
 * Conditions engine for the Proposal Builder.
 *
 * Evaluates SpecPreset conditions against a QuoteContext built from
 * the summary data to determine which presets should be included
 * in the generated proposal.
 */

// ── Types ──────────────────────────────────────────────────────────

/** Shape of a summary row (windows). Mirrors SummaryRow in summary/page.tsx. */
interface SummaryRow {
  type: string;
  type2: string;
  type3: string;
  type4: string;
  [key: string]: unknown;
}

/** Shape of a door row. Mirrors DoorRow in summary/page.tsx. */
interface DoorRow {
  type: string;
  type2?: string;
  type3?: string;
  type4?: string;
  [key: string]: unknown;
}

/** Subset of the Summary interface relevant to condition evaluation. */
export interface SummaryForConditions {
  rows: SummaryRow[];
  doorRows: DoorRow[];
  jobType: string;
  glassType: string;
  glassTypeCustom?: string;
  additionalGlassTypes?: string[];
  hungType?: string;
  hungTypeCustom?: string;
  woodType: string;
  woodTypeCustom?: string;
  finish: string;
  sdl: string;
  sdlCustom?: string;
  tdl?: string;
  tdlCustom?: string;
  spacerBarType: string;
  spacerBarColors: string;
  productTypeOptions: Record<string, string[]>;
  projectContains: string[];
  addOns: {
    windowScreens: { final: string; [k: string]: unknown };
    doorScreenSash: { final: string; [k: string]: unknown };
    entryDoor: { final: string; [k: string]: unknown };
    jambExtensions: { final: string; [k: string]: unknown };
    magneticContact: { final: string; [k: string]: unknown };
    finalFinish: { final: string; [k: string]: unknown };
    installation: { final: string; [k: string]: unknown };
  };
  plansDated: string;
  quoteType: string;
  hasMultipleLocations?: boolean;
  subLocations?: { rows: SummaryRow[]; doorRows: DoorRow[] }[];
}

/** The flattened context object the conditions engine evaluates against. */
export interface QuoteContext {
  // Product type presence
  productTypes: string[];
  hasWindows: boolean;
  hasDoors: boolean;

  // Specific product family flags
  hasDoubleHung: boolean;
  hasSingleHung: boolean;
  hasTripleHung: boolean;
  hasHungWindows: boolean; // any single/double/triple hung variant
  hasOutswing: boolean;
  hasInswing: boolean;
  hasGardenDoor: boolean;
  hasLiftRoll: boolean;
  hasFolding: boolean;
  hasPivot: boolean;
  hasDirectGlaze: boolean;
  hasFixedWithSash: boolean;
  hasTiltIn: boolean;
  hasAwning: boolean;
  hasSimulatedDH: boolean;

  // Materials & options
  glassType: string[];  // primary + any additional glass types
  jobType: string;
  finishType: string;
  woodType: string;
  sdlType: string;
  spacerBarType: string;
  spacerBarColors: string;
  quoteType: string;

  // Hardware & features
  hardwareOptions: string[];
  projectContains: string[];

  // Add-on flags
  addOnItems: string[];
  hasInstallation: boolean;
  hasMagneticContacts: boolean;
  hasFinalFinish: boolean;
  hasWindowScreens: boolean;
  hasDoorScreenSash: boolean;
  hasEntryDoor: boolean;
  hasJambExtensions: boolean;

  // For placeholder resolution (pricing)
  plansDated: string;
  hasMultipleLocations: boolean;
}

/** SpecCondition as returned from the API. */
export interface SpecConditionData {
  id: string;
  field: string;
  operator: 'CONTAINS' | 'EQUALS' | 'NOT_EMPTY' | 'IS_TRUE' | 'IS_FALSE';
  value: string | null;
  logic: 'AND' | 'OR';
}

/** SpecVariant as returned from the API. */
export interface SpecVariantData {
  id: string;
  presetId: string;
  matchValue: string;
  matchLabel: string | null;
  title: string | null;
  body: string;
  order: number;
  isActive: boolean;
}

/** SpecPreset as returned from the API with conditions and variants included. */
export interface SpecPresetData {
  id: string;
  templateId: string;
  order: number;
  title: string;
  body: string | null;
  section: 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION' | 'CONSTANT';
  /**
   * Block-level type for the in-order renderer. Null on legacy presets
   * that predate the block-type column — the renderer infers a type
   * from `section` when null so old templates keep rendering.
   */
  blockType: string | null;
  /** Per-blockType configuration (e.g. PricingTableConfig). */
  config: unknown | null;
  isAlwaysIncluded: boolean;
  driverField: string | null;
  isActive: boolean;
  conditions: SpecConditionData[];
  variants: SpecVariantData[];
}

export const CONDITION_FIELD_DEFINITIONS = [
  { value: 'hasWindows', label: 'Has Windows' },
  { value: 'hasDoors', label: 'Has Doors' },
  { value: 'hasDoubleHung', label: 'Has Double Hung' },
  { value: 'hasSingleHung', label: 'Has Single Hung' },
  { value: 'hasTripleHung', label: 'Has Triple Hung' },
  { value: 'hasHungWindows', label: 'Has Hung Windows (any)' },
  { value: 'hasOutswing', label: 'Has Outswing' },
  { value: 'hasInswing', label: 'Has Inswing' },
  { value: 'hasGardenDoor', label: 'Has Garden Door' },
  { value: 'hasLiftRoll', label: 'Has Lift & Roll' },
  { value: 'hasFolding', label: 'Has Folding' },
  { value: 'hasPivot', label: 'Has Pivot' },
  { value: 'hasDirectGlaze', label: 'Has Direct Glaze' },
  { value: 'hasFixedWithSash', label: 'Has Fixed with Sash' },
  { value: 'hasTiltIn', label: 'Has Tilt-in' },
  { value: 'hasAwning', label: 'Has Awning' },
  { value: 'hasSimulatedDH', label: 'Has Simulated DH' },
  { value: 'hasInstallation', label: 'Has Installation' },
  { value: 'hasMagneticContacts', label: 'Has Magnetic Contacts' },
  { value: 'hasFinalFinish', label: 'Has Final Finish' },
  { value: 'hasWindowScreens', label: 'Has Window Screens' },
  { value: 'hasDoorScreenSash', label: 'Has Door Screen Sash' },
  { value: 'hasEntryDoor', label: 'Has Entry Door' },
  { value: 'hasJambExtensions', label: 'Has Jamb Extensions' },
  { value: 'productTypes', label: 'Product Types (array)' },
  { value: 'glassType', label: 'Glass Type' },
  { value: 'jobType', label: 'Job Type' },
  { value: 'finishType', label: 'Finish Type' },
  { value: 'woodType', label: 'Wood Type' },
  { value: 'sdlType', label: 'SDL Type' },
  { value: 'spacerBarType', label: 'Spacer Bar Type' },
  { value: 'spacerBarColors', label: 'Spacer Bar Colors' },
  { value: 'hardwareOptions', label: 'Hardware Options (array)' },
  { value: 'addOnItems', label: 'Add-on Items (array)' },
  { value: 'projectContains', label: 'Project Contains (array)' },
  { value: 'quoteType', label: 'Quote Type' },
] as const;

const SUPPORTED_CONDITION_FIELDS = new Set(CONDITION_FIELD_DEFINITIONS.map((field) => field.value));

export interface PresetConditionDecision {
  preset: SpecPresetData;
  included: boolean;
  reason: string;
  conditionResults: Array<{ condition: SpecConditionData; passed: boolean }>;
}

// ── Product type classification ────────────────────────────────────

/** Hung window types (single, double, triple across all balance systems). */
const SINGLE_HUNG_TYPES = [
  'Single Hung Concealed Balance',
  'Single Hung Weight and Chain',
  'Single Hung Cross Cable Balance System',
];

const DOUBLE_HUNG_TYPES = [
  'Double Hung Concealed Balance',
  'Double Hung Weight and Chain',
  'Double Hung Cross Cable Balance System',
];

const TRIPLE_HUNG_TYPES = [
  'Triple Hung Concealed Balance',
  'Triple Hung Weight and Chain',
  'Triple Hung Cross Cable Balance System',
];

const ALL_HUNG_TYPES = [...SINGLE_HUNG_TYPES, ...DOUBLE_HUNG_TYPES, ...TRIPLE_HUNG_TYPES];

const OUTSWING_TYPES = ['Push Outswing', 'Crank Outswing', 'Outswing French', 'Outswing GD', 'Outswing French GD'];

const INSWING_TYPES = ['Inswing', 'Inswing T & T', 'Inswing French', 'Inswing T & T French'];

const GARDEN_DOOR_TYPES = ['Inswing GD', 'Outswing GD', 'Inswing French GD', 'Outswing French GD'];

const LIFT_ROLL_TYPES = ['L&R D', 'Lift and Roll Window'];

const FOLDING_TYPES = [
  'Inswing Folding Window',
  'Outswing Folding Window',
  'Outswing Folding',
  'Inswing Folding',
];

const PIVOT_TYPES = ['Pivot', 'Outswing Pivot', 'Convert Pivot to Inswing'];

const SIMULATED_DH_TYPES = [
  'Offset Simulated DH (2 Glass Fields)',
  'Simulated DH (1 glass Field and a 44MM)',
  'French Offset Simulated DH (2 Glass Fields)',
  'French Simulated DH (1 glass Field and a 44MM)',
];

// ── Context builder ────────────────────────────────────────────────

/**
 * Extract all product type strings from summary rows and door rows.
 * Each row can have up to 4 type columns (type, type2, type3, type4).
 */
function extractProductTypes(summary: SummaryForConditions): string[] {
  const types = new Set<string>();

  const addFromRows = (rows: (SummaryRow | DoorRow)[]) => {
    for (const row of rows) {
      for (const key of ['type', 'type2', 'type3', 'type4'] as const) {
        const val = (row as Record<string, unknown>)[key];
        if (typeof val === 'string' && val.trim()) {
          types.add(val.trim());
        }
      }
    }
  };

  addFromRows(summary.rows);
  addFromRows(summary.doorRows);

  // Also include sub-location rows if present
  if (summary.subLocations) {
    for (const sub of summary.subLocations) {
      addFromRows(sub.rows);
      addFromRows(sub.doorRows);
    }
  }

  return Array.from(types);
}

/** Check if a dollar-amount string is > 0 (values like "87600", "0", ""). */
function hasDollarValue(val: string | undefined | null): boolean {
  if (!val) return false;
  const num = parseInt(val, 10);
  return !isNaN(num) && num > 0;
}

/** Check if any of the candidate types appear in the product types list. */
function hasAnyType(productTypes: string[], candidates: string[]): boolean {
  return candidates.some((c) => productTypes.includes(c));
}

/**
 * Build the QuoteContext from a summary object.
 *
 * This flattens the nested summary data into a flat context that the
 * conditions engine can evaluate against.
 */
export function buildQuoteContext(summary: SummaryForConditions): QuoteContext {
  const productTypes = extractProductTypes(summary);

  // Flatten productTypeOptions values into a single hardware options array
  const hardwareOptions: string[] = [];
  if (summary.productTypeOptions) {
    for (const opts of Object.values(summary.productTypeOptions)) {
      if (Array.isArray(opts)) {
        for (const opt of opts) {
          if (opt && !hardwareOptions.includes(opt)) {
            hardwareOptions.push(opt);
          }
        }
      }
    }
  }

  // Determine which add-on items are present (have a non-zero final value)
  const addOnItems: string[] = [];
  if (hasDollarValue(summary.addOns?.windowScreens?.final)) addOnItems.push('Window Screens');
  if (hasDollarValue(summary.addOns?.doorScreenSash?.final)) addOnItems.push('Door Screen Sash');
  if (hasDollarValue(summary.addOns?.entryDoor?.final)) addOnItems.push('Entry Door');
  if (hasDollarValue(summary.addOns?.jambExtensions?.final)) addOnItems.push('Jamb Extensions');
  if (hasDollarValue(summary.addOns?.magneticContact?.final)) addOnItems.push('Magnetic Alarm Contacts');
  if (hasDollarValue(summary.addOns?.finalFinish?.final)) addOnItems.push('Final Finish');
  if (hasDollarValue(summary.addOns?.installation?.final)) addOnItems.push('Installation');

  // Parse finish type number from the finish string (e.g., "... 200" → "200")
  let finishType = '';
  if (summary.finish) {
    const match = summary.finish.match(/(\d+)\s*$/);
    finishType = match?.[1] ?? summary.finish;
  }

  // Check if any rows have types at all (to determine hasWindows / hasDoors)
  // Also check sub-location rows for multi-location summaries
  const rowHasType = (r: SummaryRow | DoorRow) =>
    ['type', 'type2', 'type3', 'type4'].some((k) => {
      const v = (r as Record<string, unknown>)[k];
      return typeof v === 'string' && v.trim() !== '';
    });

  const hasWindows = summary.rows.some(rowHasType) ||
    (summary.subLocations ?? []).some((sub) => sub.rows.some(rowHasType));

  const hasDoors = summary.doorRows.some(rowHasType) ||
    (summary.subLocations ?? []).some((sub) => sub.doorRows.some(rowHasType));

  return {
    productTypes,
    hasWindows,
    hasDoors,

    // Specific type family flags
    hasSingleHung: hasAnyType(productTypes, SINGLE_HUNG_TYPES),
    hasDoubleHung: hasAnyType(productTypes, DOUBLE_HUNG_TYPES),
    hasTripleHung: hasAnyType(productTypes, TRIPLE_HUNG_TYPES),
    hasHungWindows: hasAnyType(productTypes, ALL_HUNG_TYPES),
    hasOutswing: hasAnyType(productTypes, OUTSWING_TYPES),
    hasInswing: hasAnyType(productTypes, INSWING_TYPES),
    hasGardenDoor: hasAnyType(productTypes, GARDEN_DOOR_TYPES),
    hasLiftRoll: hasAnyType(productTypes, LIFT_ROLL_TYPES),
    hasFolding: hasAnyType(productTypes, FOLDING_TYPES),
    hasPivot: hasAnyType(productTypes, PIVOT_TYPES),
    hasDirectGlaze: productTypes.includes('Direct Glaze'),
    hasFixedWithSash: productTypes.includes('Fixed with Sash'),
    hasTiltIn: productTypes.includes('Tilt-in'),
    hasAwning: productTypes.includes('Awning'),
    hasSimulatedDH: hasAnyType(productTypes, SIMULATED_DH_TYPES),

    // Materials
    glassType: [
      summary.glassType || '',
      ...(summary.additionalGlassTypes || []),
      // Hung Glass Type is a separate field for double-hung windows but should
      // also match glassType variants so blocks can target it directly.
      summary.hungType === 'Custom Option' ? (summary.hungTypeCustom || '') : (summary.hungType || ''),
    ].filter(Boolean),
    jobType: summary.jobType || '',
    finishType,
    woodType: summary.woodType || '',
    sdlType: summary.sdl || summary.tdl || summary.sdlCustom || summary.tdlCustom || '',
    spacerBarType: summary.spacerBarType || '',
    spacerBarColors: summary.spacerBarColors || '',
    quoteType: summary.quoteType || '',

    // Options
    hardwareOptions,
    projectContains: summary.projectContains || [],

    // Add-ons
    addOnItems,
    hasInstallation: hasDollarValue(summary.addOns?.installation?.final),
    hasMagneticContacts: hasDollarValue(summary.addOns?.magneticContact?.final),
    hasFinalFinish: hasDollarValue(summary.addOns?.finalFinish?.final),
    hasWindowScreens: hasDollarValue(summary.addOns?.windowScreens?.final),
    hasDoorScreenSash: hasDollarValue(summary.addOns?.doorScreenSash?.final),
    hasEntryDoor: hasDollarValue(summary.addOns?.entryDoor?.final),
    hasJambExtensions: hasDollarValue(summary.addOns?.jambExtensions?.final),

    // Metadata
    plansDated: summary.plansDated || '',
    hasMultipleLocations: summary.hasMultipleLocations || false,
  };
}

// ── Condition evaluation ───────────────────────────────────────────

/**
 * Resolve a condition field name to its actual value from the context.
 *
 * Field names map directly to QuoteContext keys. For array fields
 * (productTypes, hardwareOptions, addOnItems, projectContains),
 * the value is the joined array for CONTAINS/EQUALS checks, or
 * the array itself is used for CONTAINS operator matching.
 */
function resolveField(field: string, context: QuoteContext): unknown {
  // Direct key lookup on the context object
  const value = (context as unknown as Record<string, unknown>)[field];
  return value;
}

/**
 * Evaluate a single condition against the context.
 */
function evaluateCondition(condition: SpecConditionData, context: QuoteContext): boolean {
  const fieldValue = resolveField(condition.field, context);
  const condValue = condition.value ?? '';

  switch (condition.operator) {
    case 'CONTAINS': {
      if (!condValue.trim()) return false;
      // For arrays: check if any element contains the value (case-insensitive)
      if (Array.isArray(fieldValue)) {
        const lower = condValue.toLowerCase();
        return fieldValue.some((item) =>
          String(item).toLowerCase().includes(lower)
        );
      }
      // For strings: substring match (case-insensitive)
      return String(fieldValue ?? '').toLowerCase().includes(condValue.toLowerCase());
    }

    case 'EQUALS': {
      if (!condValue.trim()) return false;
      // For arrays: check if any element equals the value exactly
      if (Array.isArray(fieldValue)) {
        return fieldValue.some(
          (item) => String(item).toLowerCase() === condValue.toLowerCase()
        );
      }
      // For strings: exact match (case-insensitive)
      return String(fieldValue ?? '').toLowerCase() === condValue.toLowerCase();
    }

    case 'NOT_EMPTY': {
      if (Array.isArray(fieldValue)) return fieldValue.length > 0;
      if (typeof fieldValue === 'boolean') return fieldValue;
      return fieldValue !== null && fieldValue !== undefined && String(fieldValue).trim() !== '';
    }

    case 'IS_TRUE': {
      return fieldValue === true;
    }

    case 'IS_FALSE': {
      return fieldValue === false;
    }

    default:
      return false;
  }
}

export function isSupportedConditionField(field: string): boolean {
  return SUPPORTED_CONDITION_FIELDS.has(field as typeof CONDITION_FIELD_DEFINITIONS[number]['value']);
}

export function getUnsupportedConditionFields(presets: SpecPresetData[]): string[] {
  const unsupported: string[] = [];
  for (const preset of presets) {
    for (const condition of preset.conditions) {
      if (!isSupportedConditionField(condition.field) && !unsupported.includes(condition.field)) {
        unsupported.push(condition.field);
      }
    }
  }
  return unsupported;
}

/**
 * Evaluate all conditions on a preset against the context.
 *
 * Logic: conditions are grouped by their `logic` field.
 * - All AND conditions must be true.
 * - At least one OR condition must be true (if any OR conditions exist).
 * - If both AND and OR conditions exist, both groups must pass.
 * - If no conditions exist and the preset is not isAlwaysIncluded, it is excluded.
 *   (isAlwaysIncluded presets bypass this function entirely in assemblePresets.)
 */
export function evaluateConditions(
  conditions: SpecConditionData[],
  context: QuoteContext
): boolean {
  if (conditions.length === 0) return false;

  const andConditions = conditions.filter((c) => c.logic === 'AND');
  const orConditions = conditions.filter((c) => c.logic === 'OR');

  // All AND conditions must pass
  const andPass = andConditions.length === 0 || andConditions.every((c) => evaluateCondition(c, context));

  // At least one OR condition must pass (if any exist)
  const orPass = orConditions.length === 0 || orConditions.some((c) => evaluateCondition(c, context));

  return andPass && orPass;
}

export function evaluatePresetDecision(
  preset: SpecPresetData,
  context: QuoteContext
): PresetConditionDecision {
  const conditionResults = preset.conditions.map((condition) => ({
    condition,
    passed: evaluateCondition(condition, context),
  }));

  if (!preset.isActive) {
    return {
      preset,
      included: false,
      reason: 'Preset is inactive.',
      conditionResults,
    };
  }

  if (preset.isAlwaysIncluded) {
    return {
      preset,
      included: true,
      reason: 'Always included presets bypass conditions.',
      conditionResults,
    };
  }

  const unsupportedFields = preset.conditions
    .map((condition) => condition.field)
    .filter((field, index, fields) => !isSupportedConditionField(field) && fields.indexOf(field) === index);

  if (unsupportedFields.length > 0) {
    return {
      preset,
      included: false,
      reason: `Unsupported condition field${unsupportedFields.length === 1 ? '' : 's'}: ${unsupportedFields.join(', ')}.`,
      conditionResults,
    };
  }

  if (preset.conditions.length === 0) {
    return {
      preset,
      included: false,
      reason: 'No conditions configured; turn on Always included or add conditions.',
      conditionResults,
    };
  }

  const included = evaluateConditions(preset.conditions, context);
  return {
    preset,
    included,
    reason: included ? 'Conditions matched the selected summary.' : 'Conditions did not match the selected summary.',
    conditionResults,
  };
}

// ── Preset assembly ────────────────────────────────────────────────

/**
 * Filter and order presets based on conditions evaluation.
 *
 * Returns only the presets that should be included in the proposal,
 * already sorted by their `order` field.
 */
export function assemblePresets(
  presets: SpecPresetData[],
  context: QuoteContext
): SpecPresetData[] {
  return presets
    .filter((preset) => evaluatePresetDecision(preset, context).included)
    .sort((a, b) => a.order - b.order);
}

/**
 * Convenience: assemble presets by section type.
 *
 * Returns a map of section → included presets for that section.
 */
/**
 * Match active variants for a preset against the context.
 *
 * Looks up the driver field value(s) in the context. For string fields,
 * returns variants whose matchValue is contained in the context value.
 * For array fields (e.g. productTypes), returns variants whose matchValue
 * is contained in any element. Returns all matching variants sorted by order.
 *
 * matchValue may encode an optional product-type-option filter separated by '||':
 *   "Inswing GD,Inswing French GD||KFV RH,72mm Thick Sash"
 * The part before '||' is the standard driver match; the part after is an option
 * filter checked against context.hardwareOptions (flattened productTypeOptions).
 * If an option filter is present, ALL checks must pass for the variant to match.
 */
/**
 * Test whether a single encoded `matchValue` string matches the given context
 * across ANY of the supplied driver fields.
 *
 * `matchValue` encoding: a newline- (new) or comma- (legacy) separated list of
 * values to match the driver against, optionally followed by `||` and a second
 * list that further filters against `hardwareOptions`.
 *
 * Shared by body-variant matching (`matchVariants`) and title-variant matching
 * (assembly `effectiveTitle`) so both use identical semantics.
 */
export function matchValueMatchesContext(
  matchValue: string,
  driverFields: string[],
  context: QuoteContext
): boolean {
  if (!matchValue || driverFields.length === 0) return false;

  // Split matchValue on newline (new format) or comma (legacy format).
  // Newline is used as separator because option names (e.g. glass types)
  // can contain commas, which would fragment them if split on comma.
  const sep = matchValue.includes('\n') ? '\n' : ',';
  const pipeIdx = matchValue.indexOf('||');
  const typeMatchStr = pipeIdx === -1 ? matchValue : matchValue.slice(0, pipeIdx);
  const optionFilterStr = pipeIdx === -1 ? '' : matchValue.slice(pipeIdx + 2);

  const matchParts = typeMatchStr
    .split(sep)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (matchParts.length === 0) return false;

  // Use exact-or-prefix matching, NOT substring matching.
  // Substring caused false positives: matchValue "8" would match glassType
  // "28 DC Standard..." because "28..." contains "8". Prefix matching ensures
  // "8" only matches "8 Bullet Resistant..." (starts with "8 " / "8." / etc.).
  const typeValueMatch = (contextItem: string, matchPart: string): boolean => {
    const v = contextItem.toLowerCase().trim();
    if (v === matchPart) return true;
    // Prefix matching: "8" matches "8 Bullet Resistant..." but NOT "28 DC..." or "7.1 ...".
    // Exclude "." from the allowed trailing chars so that short code "7" does NOT
    // ghost-match sub-variants "7.1" or "7.2" (the decimal IS part of the numeric code).
    const afterMatch = v.slice(matchPart.length);
    return v.startsWith(matchPart) && (afterMatch === '' || /^[\s,;-]/.test(afterMatch));
  };

  // Matches if ANY of the configured driver fields produces a match.
  let typeMatch = false;
  for (const driverField of driverFields) {
    const driverValue = (context as unknown as Record<string, unknown>)[driverField];
    if (driverValue === undefined || driverValue === null) continue;
    if (Array.isArray(driverValue)) {
      if (matchParts.some((match) => driverValue.some((item) => typeValueMatch(String(item), match)))) {
        typeMatch = true;
        break;
      }
    } else {
      if (matchParts.some((match) => typeValueMatch(String(driverValue), match))) {
        typeMatch = true;
        break;
      }
    }
  }
  if (!typeMatch) return false;

  // If an option filter is encoded, also check against hardwareOptions.
  if (optionFilterStr) {
    const optSep = optionFilterStr.includes('\n') ? '\n' : ',';
    const optionParts = optionFilterStr
      .split(optSep)
      .map((p) => p.trim().toLowerCase())
      .filter(Boolean);
    if (optionParts.length > 0) {
      const hwLower = context.hardwareOptions.map((o) => o.toLowerCase());
      const optionMatch = optionParts.some((opt) => hwLower.some((hw) => typeValueMatch(hw, opt)));
      if (!optionMatch) return false;
    }
  }

  return true;
}

export function matchVariants(
  preset: SpecPresetData,
  context: QuoteContext
): SpecVariantData[] {
  if (!preset.driverField || !preset.variants?.length) return [];

  // Support comma-separated multi-driver: "glassType,productTypes"
  const driverFields = preset.driverField.split(',').map((f) => f.trim()).filter(Boolean);

  const activeVariants = preset.variants
    .filter((v) => v.isActive)
    .sort((a, b) => a.order - b.order);

  return activeVariants.filter((variant) =>
    matchValueMatchesContext(variant.matchValue, driverFields, context)
  );
}

export function assemblePresetsBySection(
  presets: SpecPresetData[],
  context: QuoteContext
): Record<string, SpecPresetData[]> {
  const included = assemblePresets(presets, context);

  const bySection: Record<string, SpecPresetData[]> = {
    SPECIFICATION: [],
    OPTION: [],
    EXCLUSION: [],
    INSTALLATION: [],
    CONSTANT: [],
  };

  for (const preset of included) {
    const sectionBucket = bySection[preset.section];
    if (sectionBucket) {
      sectionBucket.push(preset);
    }
  }

  return bySection;
}
