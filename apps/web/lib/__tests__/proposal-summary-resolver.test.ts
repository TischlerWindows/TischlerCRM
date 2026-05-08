import { findSummaryForOpportunity } from '@/lib/proposal-summary-resolver';

describe('proposal summary resolver', () => {
  const summaries = [
    { id: 'sum-1', linkedOpportunityId: 'opp-1', opportunityNumber: '26489', name: 'Little Club Road #1' },
    { id: 'sum-2', linkedOpportunityId: 'opp-2', opportunityNumber: '99999', name: 'Other Job' },
  ];

  it('prefers explicit linkedOpportunityId matches', () => {
    const result = findSummaryForOpportunity(summaries, {
      id: 'opp-1',
      data: { opportunityNumber: '99999', opportunityName: 'Different name' },
    });

    expect(result.summary?.id).toBe('sum-1');
    expect(result.matchType).toBe('linkedOpportunityId');
  });

  it('falls back to opportunity number when no explicit link exists', () => {
    const result = findSummaryForOpportunity(summaries, {
      id: 'opp-x',
      data: { opportunityNumber: '26489' },
    });

    expect(result.summary?.id).toBe('sum-1');
    expect(result.matchType).toBe('opportunityNumber');
  });

  it('returns a no-match reason instead of guessing', () => {
    const result = findSummaryForOpportunity(summaries, {
      id: 'opp-x',
      data: { opportunityNumber: '12345', opportunityName: 'Unknown' },
    });

    expect(result.summary).toBeNull();
    expect(result.reason).toContain('No saved summary');
  });

  it('does not guess when multiple summaries share an opportunity name', () => {
    const result = findSummaryForOpportunity(
      [
        { id: 'sum-1', name: 'Little Club Road #1' },
        { id: 'sum-2', name: 'Little Club Road #1' },
      ],
      { id: 'opp-x', data: { opportunityName: 'Little Club Road #1' } }
    );

    expect(result.summary).toBeNull();
    expect(result.matchType).toBe('none');
    expect(result.reason).toContain('Multiple saved summaries');
  });
});
