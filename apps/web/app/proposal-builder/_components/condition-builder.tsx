'use client';

import { Plus, X, Info } from 'lucide-react';
import { CONDITION_FIELD_DEFINITIONS } from '@/lib/quote-conditions';

export interface DraftCondition {
  _key: string;
  field: string;
  operator: 'CONTAINS' | 'EQUALS' | 'NOT_EMPTY' | 'IS_TRUE' | 'IS_FALSE';
  value: string | null;
  logic: 'AND' | 'OR';
}

const OPERATORS = [
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EMPTY', label: 'Not Empty' },
  { value: 'IS_TRUE', label: 'Is True' },
  { value: 'IS_FALSE', label: 'Is False' },
];

const NO_VALUE_OPERATORS = ['NOT_EMPTY', 'IS_TRUE', 'IS_FALSE'];

let _keyCounter = 0;
export function nextConditionKey(): string {
  return `dk_${++_keyCounter}`;
}

export function emptyDraftCondition(): DraftCondition {
  return { _key: nextConditionKey(), field: 'hasWindows', operator: 'IS_TRUE', value: null, logic: 'AND' };
}

export function conditionToDraft(c: { field: string; operator: string; value: string | null; logic: string }): DraftCondition {
  return {
    _key: nextConditionKey(),
    field: c.field,
    operator: c.operator as DraftCondition['operator'],
    value: c.value,
    logic: c.logic as 'AND' | 'OR',
  };
}

export function conditionsPayload(conditions: DraftCondition[]) {
  return conditions.map((c) => ({
    field: c.field,
    operator: c.operator,
    value: NO_VALUE_OPERATORS.includes(c.operator) ? null : (c.value || null),
    logic: c.logic,
  }));
}

export function validateConditions(conditions: ReturnType<typeof conditionsPayload>): string | null {
  const bad = conditions.find(
    (c) => (c.operator === 'CONTAINS' || c.operator === 'EQUALS') && !c.value?.trim()
  );
  return bad ? `${bad.operator} conditions require a value.` : null;
}

interface Props {
  conditions: DraftCondition[];
  onChange: (conditions: DraftCondition[]) => void;
}

export function ConditionBuilder({ conditions, onChange }: Props) {
  const add = () => onChange([...conditions, emptyDraftCondition()]);
  const remove = (key: string) => onChange(conditions.filter((c) => c._key !== key));
  const update = (key: string, patch: Partial<DraftCondition>) =>
    onChange(conditions.map((c) => (c._key === key ? { ...c, ...patch } : c)));

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <label className="text-xs font-semibold text-gray-600">Conditions</label>
          <span
            title='This block is included only when all AND conditions pass and (if any OR conditions exist) at least one OR also passes. "Always included" overrides this entirely.'
            aria-label="Conditions help"
            tabIndex={0}
            className="inline-flex cursor-help text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:text-gray-700"
          >
            <Info className="w-3 h-3" />
          </span>
        </div>
        <button onClick={add} className="text-xs text-brand-navy font-semibold hover:underline flex items-center gap-1">
          <Plus className="w-3 h-3" /> Add Condition
        </button>
      </div>

      {conditions.length === 0 ? (
        <p className="text-xs text-gray-400 italic leading-relaxed">
          No conditions yet. Without any, this block is excluded unless <span className="font-semibold not-italic">Always included</span> is on.
          Add a condition like <span className="font-mono text-gray-500 not-italic">hasDoors IS_TRUE</span> to include this block only when the summary has doors.
        </p>
      ) : (
        <div className="space-y-2">
          {conditions.map((cond, idx) => (
            <div key={cond._key} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              {idx > 0 ? (
                <select
                  value={cond.logic}
                  onChange={(e) => update(cond._key, { logic: e.target.value as 'AND' | 'OR' })}
                  className="w-16 text-xs font-semibold px-2 py-1 border border-gray-300 rounded bg-white"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              ) : (
                <span className="w-16 text-xs font-semibold text-gray-400 text-center">Where</span>
              )}

              <select
                value={cond.field}
                onChange={(e) => update(cond._key, { field: e.target.value })}
                className="flex-1 min-w-0 text-xs px-2 py-1 border border-gray-300 rounded bg-white"
              >
                {CONDITION_FIELD_DEFINITIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>

              <select
                value={cond.operator}
                onChange={(e) => update(cond._key, { operator: e.target.value as DraftCondition['operator'] })}
                className="w-28 text-xs px-2 py-1 border border-gray-300 rounded bg-white"
              >
                {OPERATORS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>

              {!NO_VALUE_OPERATORS.includes(cond.operator) && (
                <input
                  value={cond.value || ''}
                  onChange={(e) => update(cond._key, { value: e.target.value })}
                  placeholder="value"
                  className="w-32 text-xs px-2 py-1 border border-gray-300 rounded bg-white"
                />
              )}

              <button onClick={() => remove(cond._key)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
