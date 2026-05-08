/**
 * Conditions engine for the Quote PDF Builder.
 *
 * Evaluates SpecPreset conditions against a QuoteContext built from
 * the summary data to determine which presets should be included
 * in the generated quote letter.
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
  glassType: string;
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

/** SpecPreset as returned from the API with conditions included. */
export interface SpecPresetData {
  id: string;
  templateId: string;
  order: number;
  title: string;
  body: string;
  section: 'SPECIFICATION' | 'OPTION' | 'EXCLUSION' | 'INSTALLATION' | 'BOILERPLATE';
  isAlwaysIncluded: boolean;
  isActive: boolean;
  conditions: SpecConditionData[];
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

const OUTSWING_TYPES = ['Push Outswing', 'Crank Outswing', 'Outswing French'];

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
    finishType = match ? match[1] : summary.finish;
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
    glassType: summary.glassType || '',
    jobType: summary.jobType || '',
    finishType,
    woodType: summary.woodType || '',
    sdlType: summary.sdl || '',
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
  const value = (context as Record<string, unknown>)[field];
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

// ── Preset assembly ────────────────────────────────────────────────

/**
 * Filter and order presets based on conditions evaluation.
 *
 * Returns only the presets that should be included in the quote,
 * already sorted by their `order` field.
 */
export function assemblePresets(
  presets: SpecPresetData[],
  context: QuoteContext
): SpecPresetData[] {
  return presets
    .filter((preset) => {
      // Skip inactive presets
      if (!preset.isActive) return false;

      // Always-included presets bypass condition evaluation
      if (preset.isAlwaysIncluded) return true;

      // Evaluate conditions
      return evaluateConditions(preset.conditions, context);
    })
    .sort((a, b) => a.order - b.order);
}

/**
 * Convenience: assemble presets by section type.
 *
 * Returns a map of section → included presets for that section.
 */
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
    BOILERPLATE: [],
  };

  for (const preset of included) {
    if (bySection[preset.section]) {
      bySection[preset.section].push(preset);
    }
  }

  return bySection;
}
