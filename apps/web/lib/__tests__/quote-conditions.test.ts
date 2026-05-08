import {
  buildQuoteContext,
  evaluatePresetDecision,
  getUnsupportedConditionFields,
  type SpecPresetData,
  type SummaryForConditions,
} from '@/lib/quote-conditions';

const baseSummary: SummaryForConditions = {
  rows: [{ type: 'Double Hung Concealed Balance', type2: '', type3: '', type4: '' }],
  doorRows: [{ type: 'Outswing GD', type2: '', type3: '', type4: '' }],
  jobType: 'Dade County Impact',
  glassType: '#28',
  woodType: 'Sipo',
  finish: 'Same finish inside and out 200',
  sdl: 'Sprosse 22',
  spacerBarType: 'Aluminum Spacer',
  spacerBarColors: 'Black',
  productTypeOptions: { 'Outswing GD': ['KFV RH'] },
  projectContains: [],
  addOns: {
    windowScreens: { final: '0' },
    doorScreenSash: { final: '0' },
    entryDoor: { final: '0' },
    jambExtensions: { final: '0' },
    magneticContact: { final: '2670' },
    finalFinish: { final: '5260' },
    installation: { final: '48900' },
  },
  plansDated: '2025-08-15',
  quoteType: 'first',
};

function preset(overrides: Partial<SpecPresetData>): SpecPresetData {
  return {
    id: 'preset-1',
    templateId: 'template-1',
    order: 0,
    title: 'Test preset',
    body: 'Body',
    section: 'SPECIFICATION',
    isAlwaysIncluded: false,
    isActive: true,
    conditions: [],
    ...overrides,
  };
}

describe('quote condition diagnostics', () => {
  it('explains that a non-always preset with no conditions is excluded', () => {
    const decision = evaluatePresetDecision(preset({}), buildQuoteContext(baseSummary));

    expect(decision.included).toBe(false);
    expect(decision.reason).toContain('No conditions');
  });

  it('explains that always-included presets bypass conditions', () => {
    const decision = evaluatePresetDecision(
      preset({ isAlwaysIncluded: true, conditions: [] }),
      buildQuoteContext(baseSummary)
    );

    expect(decision.included).toBe(true);
    expect(decision.reason).toContain('Always included');
  });

  it('identifies unsupported condition fields for admin warnings', () => {
    const unsupported = getUnsupportedConditionFields([
      preset({
        conditions: [
          { id: 'c1', field: 'hasInstallation', operator: 'IS_TRUE', value: null, logic: 'AND' },
          { id: 'c2', field: 'unknownField', operator: 'NOT_EMPTY', value: null, logic: 'AND' },
        ],
      }),
    ]);

    expect(unsupported).toEqual(['unknownField']);
  });

  it('does not let blank value-based conditions match every block', () => {
    const decision = evaluatePresetDecision(
      preset({
        conditions: [
          { id: 'c1', field: 'jobType', operator: 'CONTAINS', value: '', logic: 'AND' },
        ],
      }),
      buildQuoteContext(baseSummary)
    );

    expect(decision.included).toBe(false);
  });
});
