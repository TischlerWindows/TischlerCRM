import { assembleProposal } from '@crm/proposal-assembly';
import type { SummaryForConditions, SummaryForPlaceholders } from '@crm/proposal-assembly';

const summary = {
  id: 'summary-1',
  name: 'Little Club Road #1',
  opportunityNumber: '26489',
  plansDated: '2025-08-15',
  jobType: 'Dade County Impact',
  glassType: '#28',
  finish: 'Same finish inside and out 200',
  sdl: 'Sprosse 22',
  spacerBarColors: 'Black',
  spacerBarType: 'Aluminum',
  woodType: 'Sipo',
  contactReceivingQuote: 'Matthew Holmes',
  accountReceivingQuote: 'Tim Givens Building & Remodeling',
  accountShippingAddress: '5390 Georgia Avenue\nWest Palm Beach, FL 33405',
  address: '1 Little Club Road',
  salesman: 'James G. Myers',
  estimator: 'Julian',
  contactEmail: '',
  contactPrimaryPhone: '',
  quoteType: 'first',
  rows: [{ type: 'Double Hung Concealed Balance', type2: '', type3: '', type4: '' }],
  doorRows: [{ type: 'Outswing GD', type2: '', type3: '', type4: '' }],
  productTypeOptions: { 'Outswing GD': ['KFV RH'] },
  projectContains: [],
  quoteTotals: {
    euroWindows: { full: '', pct: '', final: '', finalAdj: '88200' },
    doubleHung: { full: '', pct: '', final: '', finalAdj: '48040' },
    euroDoors: { full: '', pct: '', final: '', finalAdj: '108050' },
  },
  grandTotalAdjustment: { full: '', pct: '', final: '', finalAdj: '0' },
  addOns: {
    windowScreens: { qty: '0', final: '0' },
    doorScreenSash: { qty: '0', final: '0' },
    entryDoor: { qty: '0', final: '0' },
    jambExtensions: { final: '0' },
    magneticContact: { qty: '1', final: '2670' },
    finalFinish: { final: '5260' },
    installation: { final: '48900' },
  },
} satisfies SummaryForConditions & SummaryForPlaceholders & { id: string };

describe('proposal assembly', () => {
  it('returns resolved proposal sections with included and excluded diagnostics', () => {
    const result = assembleProposal({
      summary,
      template: {
        id: 'template-1',
        name: 'Standard Proposal',
        presets: [
          {
            id: 'always',
            templateId: 'template-1',
            order: 0,
            title: 'Opening',
            body: 'We are pleased to propose {{projectName}}.',
            section: 'CONSTANT',
            isAlwaysIncluded: true,
            driverField: null,
            isActive: true,
            conditions: [],
            variants: [],
          },
          {
            id: 'magnetic',
            templateId: 'template-1',
            order: 1,
            title: 'Magnetic Contacts',
            body: 'ADD: Magnetic contacts {{magneticContactPrice}}.',
            section: 'OPTION',
            isAlwaysIncluded: false,
            driverField: null,
            isActive: true,
            conditions: [{ id: 'c1', field: 'hasMagneticContacts', operator: 'IS_TRUE', value: null, logic: 'AND' }],
            variants: [],
          },
          {
            id: 'missing',
            templateId: 'template-1',
            order: 2,
            title: 'Missing Field',
            body: 'This should not show.',
            section: 'SPECIFICATION',
            isAlwaysIncluded: false,
            driverField: null,
            isActive: true,
            conditions: [],
            variants: [],
          },
        ],
      },
      contact: { salutation: 'Mr.', lastName: 'Holmes' },
    });

    expect(result.sections.CONSTANT[0].body).toBe('We are pleased to propose Little Club Road #1.');
    expect(result.sections.OPTION[0].body).toContain('$2,670.00');
    expect(result.includedBlocks.map((b) => b.id)).toEqual(['always', 'magnetic']);
    expect(result.excludedBlocks.map((b) => b.id)).toEqual(['missing']);
    expect(result.warnings).toContainEqual(expect.stringContaining('Missing Field'));
  });

  it('reports unresolved tokens before PDF generation', () => {
    const result = assembleProposal({
      summary,
      template: {
        id: 'template-1',
        name: 'Standard Proposal',
        presets: [
          {
            id: 'unknown-token',
            templateId: 'template-1',
            order: 0,
            title: 'Unknown Token',
            body: 'Value {{notARealToken}}',
            section: 'CONSTANT',
            isAlwaysIncluded: true,
            driverField: null,
            isActive: true,
            conditions: [],
            variants: [],
          },
        ],
      },
    });

    expect(result.unresolvedTokens).toEqual([{ presetId: 'unknown-token', token: 'notARealToken' }]);
    expect(result.warnings).toContainEqual(expect.stringContaining('notARealToken'));
  });

  it('includes only the matching variant when driverField is set', () => {
    const result = assembleProposal({
      summary,
      template: {
        id: 'template-1',
        name: 'Standard Proposal',
        presets: [
          {
            id: 'glass-spec',
            templateId: 'template-1',
            order: 0,
            title: 'Impact Glass Spec',
            body: null,
            section: 'SPECIFICATION',
            isAlwaysIncluded: true,
            driverField: 'glassType',
            isActive: true,
            conditions: [],
            variants: [
              { id: 'v1', presetId: 'glass-spec', matchValue: '#28', matchLabel: 'Glass #28', body: 'All glass is #28 laminated.', order: 0, isActive: true },
              { id: 'v2', presetId: 'glass-spec', matchValue: '#3', matchLabel: 'Glass #3', body: 'All glass is #3 tempered.', order: 1, isActive: true },
            ],
          },
        ],
      },
    });

    expect(result.sections.SPECIFICATION).toHaveLength(1);
    expect(result.sections.SPECIFICATION[0].body).toBe('All glass is #28 laminated.');
    expect(result.includedBlocks.map((b) => b.id)).toEqual(['glass-spec']);
  });

  it('skips variant block when no variants match', () => {
    const result = assembleProposal({
      summary: { ...summary, glassType: '#99' },
      template: {
        id: 'template-1',
        name: 'Standard Proposal',
        presets: [
          {
            id: 'glass-spec',
            templateId: 'template-1',
            order: 0,
            title: 'Impact Glass Spec',
            body: null,
            section: 'SPECIFICATION',
            isAlwaysIncluded: true,
            driverField: 'glassType',
            isActive: true,
            conditions: [],
            variants: [
              { id: 'v1', presetId: 'glass-spec', matchValue: '#28', matchLabel: null, body: 'Glass #28 spec.', order: 0, isActive: true },
            ],
          },
        ],
      },
    });

    expect(result.sections.SPECIFICATION).toHaveLength(0);
    expect(result.excludedBlocks.map((b) => b.id)).toEqual(['glass-spec']);
  });

  it('outputs multiple variants when multi-value driver matches', () => {
    const result = assembleProposal({
      summary,
      template: {
        id: 'template-1',
        name: 'Standard Proposal',
        presets: [
          {
            id: 'product-spec',
            templateId: 'template-1',
            order: 0,
            title: 'Product Specs',
            body: null,
            section: 'SPECIFICATION',
            isAlwaysIncluded: true,
            driverField: 'productTypes',
            isActive: true,
            conditions: [],
            variants: [
              { id: 'v1', presetId: 'product-spec', matchValue: 'Double Hung', matchLabel: null, body: 'DH spec text.', order: 0, isActive: true },
              { id: 'v2', presetId: 'product-spec', matchValue: 'Outswing', matchLabel: null, body: 'Outswing spec text.', order: 1, isActive: true },
              { id: 'v3', presetId: 'product-spec', matchValue: 'Inswing', matchLabel: null, body: 'Inswing spec text.', order: 2, isActive: true },
            ],
          },
        ],
      },
    });

    expect(result.sections.SPECIFICATION).toHaveLength(2);
    expect(result.sections.SPECIFICATION[0].body).toBe('DH spec text.');
    expect(result.sections.SPECIFICATION[1].body).toBe('Outswing spec text.');
  });

  it('silently skips simple preset with null body', () => {
    const result = assembleProposal({
      summary,
      template: {
        id: 'template-1',
        name: 'Standard Proposal',
        presets: [
          {
            id: 'empty',
            templateId: 'template-1',
            order: 0,
            title: 'Empty Body',
            body: null,
            section: 'CONSTANT',
            isAlwaysIncluded: true,
            driverField: null,
            isActive: true,
            conditions: [],
            variants: [],
          },
        ],
      },
    });

    expect(result.sections.CONSTANT).toHaveLength(0);
  });
});
