import { evaluateVisibility } from '../field-visibility';
import type { ConditionExpr } from '../schema';

const conditions: ConditionExpr[] = [
  { left: 'supplier', op: '==', right: 'MHB' },
  { left: 'product', op: '==', right: 'Metal' },
];

describe('field visibility logic', () => {
  it('defaults existing rules to AND', () => {
    expect(evaluateVisibility(conditions, { supplier: 'MHB', product: 'Wood' })).toBe(false);
    expect(evaluateVisibility(conditions, { supplier: 'MHB', product: 'Metal' })).toBe(true);
  });

  it('allows any condition to show the field with OR', () => {
    expect(evaluateVisibility(conditions, { supplier: 'MHB', product: 'Wood' }, undefined, 'OR')).toBe(true);
    expect(evaluateVisibility(conditions, { supplier: 'Other', product: 'Metal' }, undefined, 'OR')).toBe(true);
    expect(evaluateVisibility(conditions, { supplier: 'Other', product: 'Wood' }, undefined, 'OR')).toBe(false);
  });

  it('keeps empty conditions visible regardless of logic', () => {
    expect(evaluateVisibility([], {}, undefined, 'OR')).toBe(true);
  });
});