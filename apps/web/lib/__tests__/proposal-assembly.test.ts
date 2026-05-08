import { assembleProposal } from '@/lib/proposal-assembly';
import type { SummaryForConditions } from '@/lib/quote-conditions';
import type { SummaryForPlaceholders } from '@/lib/quote-placeholders';

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
            section: 'BOILERPLATE',
            isAlwaysIncluded: true,
            isActive: true,
            conditions: [],
          },
          {
            id: 'magnetic',
            templateId: 'template-1',
            order: 1,
            title: 'Magnetic Contacts',
            body: 'ADD: Magnetic contacts {{magneticContactPrice}}.',
            section: 'OPTION',
            isAlwaysIncluded: false,
            isActive: true,
            conditions: [{ id: 'c1', field: 'hasMagneticContacts', operator: 'IS_TRUE', value: null, logic: 'AND' }],
          },
          {
            id: 'missing',
            templateId: 'template-1',
            order: 2,
            title: 'Missing Field',
            body: 'This should not show.',
            section: 'SPECIFICATION',
            isAlwaysIncluded: false,
            isActive: true,
            conditions: [],
          },
        ],
      },
      contact: { salutation: 'Mr.', lastName: 'Holmes' },
    });

    expect(result.sections.BOILERPLATE[0].body).toBe('We are pleased to propose Little Club Road #1.');
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
            section: 'BOILERPLATE',
            isAlwaysIncluded: true,
            isActive: true,
            conditions: [],
          },
        ],
      },
    });

    expect(result.unresolvedTokens).toEqual([{ presetId: 'unknown-token', token: 'notARealToken' }]);
    expect(result.warnings).toContainEqual(expect.stringContaining('notARealToken'));
  });
});
