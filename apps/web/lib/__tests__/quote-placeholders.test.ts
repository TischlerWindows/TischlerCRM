import { findUnresolvedTokens, formatDate, resolveTokens, resolveTokensWithDiagnostics, buildTokenMap } from '@crm/proposal-assembly';
import type { SummaryForPlaceholders } from '@crm/proposal-assembly';

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

  it('unwraps a <p> that wraps nothing but a single block-level token, avoiding nested <p>', () => {
    // Tiptap always wraps a body in <p>...</p>, even a chip-only body like
    // {{BaseBidoptions}} — its resolved value is itself <p> markup, so
    // substituting in place would otherwise nest a <p> inside a <p>.
    const result = resolveTokens('<p>{{BaseBidoptions}}</p>', {
      BaseBidoptions: '<p><u>Window Screens</u> (Qty. 1.).</p>',
    });
    expect(result).toBe('<p><u>Window Screens</u> (Qty. 1.).</p>');
    expect(result).not.toContain('<p><p>');
  });

  it('leaves plain (non-block) tokens substituted in place inside their paragraph', () => {
    const result = resolveTokens('<p>Hello {{contactName}}!</p>', { contactName: 'Matthew' });
    expect(result).toBe('<p>Hello Matthew!</p>');
  });

  it('does NOT unwrap a solo token whose value is inline-only markup (no wrapping block tag)', () => {
    // productTypeDetails/installationDetails resolve to <strong>/<br> runs with
    // no wrapping <p> of their own — unwrapping the editor's <p> here would
    // drop their bold formatting and <br><br> spacing (both need a real <p>).
    const result = resolveTokens('<p>{{productTypeDetails}}</p>', {
      productTypeDetails: '<strong>Lift & Roll Door: Pattern 1F</strong> with 2-13/16" Thick Sash<br><br><strong>Next</strong>',
    });
    expect(result).toBe('<p><strong>Lift & Roll Door: Pattern 1F</strong> with 2-13/16" Thick Sash<br><br><strong>Next</strong></p>');
  });
});

describe('"Included in Base Bid" add-on rows', () => {
  const baseSummary: SummaryForPlaceholders = {
    name: '', opportunityNumber: '', plansDated: '', jobType: '', glassType: '',
    finish: '', sdl: '', spacerBarColors: '', spacerBarType: '', woodType: '',
    contactReceivingQuote: '', accountReceivingQuote: '', accountShippingAddress: '',
    address: '', salesman: '', estimator: '', contactEmail: '', contactPrimaryPhone: '',
    quoteType: '',
    quoteTotals: {
      euroWindows: { full: '', pct: '', final: '', finalAdj: '1000' },
      doubleHung: { full: '', pct: '', final: '', finalAdj: '0' },
      euroDoors: { full: '', pct: '', final: '', finalAdj: '0' },
    },
    addOns: {
      windowScreens: { qty: '2', final: '500', includedInBaseBid: 'true' },
      doorScreenSash: { qty: '1', final: '300' },
      entryDoor: { qty: '0', final: '0' },
      jambExtensions: { final: '0' },
      magneticContact: { qty: '0', final: '0' },
      finalFinish: { final: '0' },
      installation: { final: '0' },
      deductRows: [{ item: 'DH Concealed Balance', qty: '', details: '', final: '200', includedInBaseBid: 'true' }],
    },
  };

  it('excludes base-bid rows from {{options}} and folds their $ into {{FinalPrice}}', () => {
    const tokens = buildTokenMap(baseSummary);

    // grandTotal = 1000 (quoteTotals) + 500 (windowScreens, base-bid add) - 200 (deduct row, base-bid) = 1300
    expect(tokens.FinalPrice).toContain('$1,300.00');
    // Each base-bid row also gets its own visible "Item: $Amount" breakdown line.
    expect(tokens.FinalPrice).toContain('Window Screens:');
    expect(tokens.FinalPrice).toContain('$500.00');
    expect(tokens.FinalPrice).toContain('DH Concealed Balance:');
    expect(tokens.FinalPrice).toContain('($ 200.00)');
    // The base-bid Window Screens row must NOT show up in {{options}} (no ADD:/$500 line)...
    expect(tokens.options).not.toContain('Window Screens');
    // ...but the non-base-bid Door Screen Sash row still does.
    expect(tokens.options).toContain('Door Screen Sash');
  });

  it('lists base-bid rows in {{BaseBidoptions}} without the ADD:/DEDUCT: prefix or $ amount', () => {
    const tokens = buildTokenMap(baseSummary);

    expect(tokens.BaseBidoptions).toContain('Window Screens');
    expect(tokens.BaseBidoptions).toContain('DH Concealed Balance');
    expect(tokens.BaseBidoptions).not.toContain('ADD:');
    expect(tokens.BaseBidoptions).not.toContain('DEDUCT:');
    expect(tokens.BaseBidoptions).not.toContain('$500');
  });
});
