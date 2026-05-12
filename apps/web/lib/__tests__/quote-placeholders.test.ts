import { findUnresolvedTokens, formatDate, resolveTokensWithDiagnostics } from '@crm/proposal-assembly';

describe('quote placeholder diagnostics', () => {
  it('reports unresolved tokens while preserving the unresolved marker in text', () => {
    const result = resolveTokensWithDiagnostics(
      'Hello {{contactName}}, this is {{missingToken}} for {{projectName}}.',
      { contactName: 'Matthew Holmes', projectName: 'Little Club Road #1' }
    );

    expect(result.text).toBe('Hello Matthew Holmes, this is {{missingToken}} for Little Club Road #1.');
    expect(result.unresolvedTokens).toEqual(['missingToken']);
  });

  it('deduplicates unresolved token names in document order', () => {
    expect(findUnresolvedTokens('{{foo}} {{bar}} {{foo}}', { bar: 'ready' })).toEqual(['foo']);
  });

  it('formats date-only strings without timezone shifting the day', () => {
    expect(formatDate('2025-08-15')).toBe('August 15, 2025');
  });
});
