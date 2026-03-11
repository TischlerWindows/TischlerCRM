'use client';

import { useState, useRef, useEffect } from 'react';
import { ConditionExpr, FieldDef, PicklistDependencyRule } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, ChevronDown, ChevronRight, Plus, Trash2, Check } from 'lucide-react';
import { formatCondition } from '@/lib/field-visibility';

interface PicklistDependencyEditorProps {
  field: FieldDef;
  availableFields: FieldDef[];
  onSave: (rules: PicklistDependencyRule[]) => void;
  onCancel: () => void;
}

export default function PicklistDependencyEditor({
  field,
  availableFields,
  onSave,
  onCancel,
}: PicklistDependencyEditorProps) {
  const picklistValues = field.picklistValues || [];
  const [rules, setRules] = useState<PicklistDependencyRule[]>(
    field.picklistDependencies
      ? field.picklistDependencies.map(r => ({
          conditions: [...r.conditions],
          values: [...r.values],
        }))
      : []
  );
  const [expandedRule, setExpandedRule] = useState<number | null>(null);

  // State for new condition being built inside a rule
  const [editingCondition, setEditingCondition] = useState<{
    ruleIdx: number;
    cond: Partial<ConditionExpr>;
  } | null>(null);
  const [fieldSearchTerm, setFieldSearchTerm] = useState('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [valueSearchTerm, setValueSearchTerm] = useState('');
  const [showValueDropdown, setShowValueDropdown] = useState(false);

  const fieldDropdownRef = useRef<HTMLDivElement>(null);
  const valueDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(e.target as Node)) {
        setShowFieldDropdown(false);
      }
      if (valueDropdownRef.current && !valueDropdownRef.current.contains(e.target as Node)) {
        setShowValueDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getFieldLabel = (apiName: string) => {
    return availableFields.find((f) => f.apiName === apiName)?.label || apiName;
  };

  const addNewRule = () => {
    const newIdx = rules.length;
    setRules([...rules, { conditions: [], values: [] }]);
    setExpandedRule(newIdx);
    setEditingCondition({ ruleIdx: newIdx, cond: { left: '', op: '==', right: '' } });
    setFieldSearchTerm('');
    setValueSearchTerm('');
  };

  const deleteRule = (idx: number) => {
    setRules(rules.filter((_, i) => i !== idx));
    if (expandedRule === idx) setExpandedRule(null);
    else if (expandedRule !== null && expandedRule > idx) setExpandedRule(expandedRule - 1);
    if (editingCondition?.ruleIdx === idx) setEditingCondition(null);
  };

  const addConditionToRule = (ruleIdx: number) => {
    if (!editingCondition || editingCondition.ruleIdx !== ruleIdx) return;
    const { cond } = editingCondition;
    if (!cond.left || !cond.op || cond.right === '' || cond.right === undefined) return;

    setRules(
      rules.map((r, i) =>
        i === ruleIdx ? { ...r, conditions: [...r.conditions, cond as ConditionExpr] } : r
      )
    );
    setEditingCondition({ ruleIdx, cond: { left: '', op: '==', right: '' } });
    setFieldSearchTerm('');
    setValueSearchTerm('');
  };

  const removeConditionFromRule = (ruleIdx: number, condIdx: number) => {
    setRules(
      rules.map((r, i) =>
        i === ruleIdx ? { ...r, conditions: r.conditions.filter((_, ci) => ci !== condIdx) } : r
      )
    );
  };

  const toggleValueInRule = (ruleIdx: number, value: string) => {
    setRules(
      rules.map((r, i) => {
        if (i !== ruleIdx) return r;
        const has = r.values.includes(value);
        return {
          ...r,
          values: has ? r.values.filter((v) => v !== value) : [...r.values, value],
        };
      })
    );
  };

  const selectAllValues = (ruleIdx: number) => {
    setRules(rules.map((r, i) => (i === ruleIdx ? { ...r, values: [...picklistValues] } : r)));
  };

  const deselectAllValues = (ruleIdx: number) => {
    setRules(rules.map((r, i) => (i === ruleIdx ? { ...r, values: [] } : r)));
  };

  const totalConditions = rules.reduce((sum, r) => sum + r.conditions.length, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-600 mb-2">
          Create rules to control which picklist values appear. Each rule has one
          or more conditions (AND logic) and a set of values to show when the
          conditions are met. Values not assigned to any rule always appear.
        </p>
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
          {rules.length} rule{rules.length !== 1 ? 's' : ''} with {totalConditions} condition
          {totalConditions !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Rules list */}
      <div className="space-y-2 max-h-[50vh] overflow-y-auto">
        {rules.map((rule, ruleIdx) => {
          const isExpanded = expandedRule === ruleIdx;

          return (
            <div
              key={ruleIdx}
              className={`border rounded ${
                rule.conditions.length > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'
              }`}
            >
              {/* Rule header */}
              <div className="flex items-center justify-between px-3 py-2">
                <button
                  onClick={() => {
                    setExpandedRule(isExpanded ? null : ruleIdx);
                    if (!isExpanded) {
                      setEditingCondition({
                        ruleIdx,
                        cond: { left: '', op: '==', right: '' },
                      });
                      setFieldSearchTerm('');
                      setValueSearchTerm('');
                    }
                  }}
                  className="flex items-center gap-2 text-sm hover:text-gray-900 flex-1 text-left"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium">
                    Rule {ruleIdx + 1}
                    {rule.conditions.length > 0 && (
                      <span className="font-normal text-gray-500 ml-2">
                        ({rule.conditions.length} condition
                        {rule.conditions.length !== 1 ? 's' : ''} &rarr;{' '}
                        {rule.values.length} value
                        {rule.values.length !== 1 ? 's' : ''})
                      </span>
                    )}
                  </span>
                </button>
                <button
                  onClick={() => deleteRule(ruleIdx)}
                  className="text-red-400 hover:text-red-600 p-1"
                  title="Delete rule"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Expanded rule body */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-200 space-y-3">
                  {/* Conditions Section */}
                  <div className="mt-3">
                    <Label className="text-xs font-semibold text-gray-700 mb-1 block">
                      Conditions (all must be true):
                    </Label>

                    {/* Existing conditions */}
                    {rule.conditions.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {rule.conditions.map((condition, condIdx) => (
                          <div
                            key={condIdx}
                            className="flex items-center justify-between bg-white p-2 rounded border text-xs"
                          >
                            <span className="text-gray-700">
                              {formatCondition(condition, getFieldLabel(condition.left), {})}
                            </span>
                            <button
                              onClick={() => removeConditionFromRule(ruleIdx, condIdx)}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add condition form */}
                    <div className="space-y-2 bg-gray-50 p-2 rounded border border-gray-100">
                      <Label className="text-xs text-gray-500">Add condition:</Label>

                      {/* Field Selection */}
                      <div className="relative" ref={fieldDropdownRef}>
                        <Input
                          type="text"
                          placeholder="Select field..."
                          value={editingCondition?.ruleIdx === ruleIdx ? fieldSearchTerm : ''}
                          onChange={(e) => {
                            setFieldSearchTerm(e.target.value);
                            setShowFieldDropdown(true);
                            if (!editingCondition || editingCondition.ruleIdx !== ruleIdx) {
                              setEditingCondition({
                                ruleIdx,
                                cond: { left: '', op: '==', right: '' },
                              });
                            }
                          }}
                          onFocus={() => {
                            setShowFieldDropdown(true);
                            if (!editingCondition || editingCondition.ruleIdx !== ruleIdx) {
                              setEditingCondition({
                                ruleIdx,
                                cond: { left: '', op: '==', right: '' },
                              });
                            }
                          }}
                          className="h-7 text-xs"
                        />
                        {showFieldDropdown && editingCondition?.ruleIdx === ruleIdx && (
                          <div className="absolute z-20 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-40 overflow-y-auto">
                            {availableFields
                              .filter(
                                (f) =>
                                  f.apiName !== field.apiName &&
                                  (fieldSearchTerm === '' ||
                                    f.label
                                      .toLowerCase()
                                      .includes(fieldSearchTerm.toLowerCase()) ||
                                    f.apiName
                                      .toLowerCase()
                                      .includes(fieldSearchTerm.toLowerCase()))
                              )
                              .map((f) => (
                                <div
                                  key={f.apiName}
                                  onClick={() => {
                                    setEditingCondition({
                                      ruleIdx,
                                      cond: { ...editingCondition!.cond, left: f.apiName },
                                    });
                                    setFieldSearchTerm(f.label);
                                    setShowFieldDropdown(false);
                                  }}
                                  className="px-3 py-1.5 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0"
                                >
                                  <div className="font-medium">{f.label}</div>
                                  <div className="text-gray-400 text-[10px]">{f.apiName}</div>
                                </div>
                              ))}
                            {availableFields.filter(
                              (f) =>
                                f.apiName !== field.apiName &&
                                (fieldSearchTerm === '' ||
                                  f.label
                                    .toLowerCase()
                                    .includes(fieldSearchTerm.toLowerCase()) ||
                                  f.apiName
                                    .toLowerCase()
                                    .includes(fieldSearchTerm.toLowerCase()))
                            ).length === 0 && (
                              <div className="px-3 py-1.5 text-xs text-gray-500 text-center">
                                No fields found
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Operator + Value row */}
                      <div className="flex gap-2">
                        <select
                          value={
                            editingCondition?.ruleIdx === ruleIdx
                              ? editingCondition.cond.op || '=='
                              : '=='
                          }
                          onChange={(e) => {
                            if (editingCondition && editingCondition.ruleIdx === ruleIdx) {
                              setEditingCondition({
                                ruleIdx,
                                cond: {
                                  ...editingCondition.cond,
                                  op: e.target.value as ConditionExpr['op'],
                                },
                              });
                            }
                          }}
                          className="h-7 px-1 border border-gray-300 rounded text-xs flex-shrink-0 w-28"
                        >
                          <option value="==">Equals</option>
                          <option value="!=">Not Equals</option>
                          <option value=">">Greater Than</option>
                          <option value="<">Less Than</option>
                          <option value=">=">≥</option>
                          <option value="<=">≤</option>
                          <option value="IN">In (List)</option>
                          <option value="INCLUDES">Includes</option>
                          <option value="CONTAINS">Contains</option>
                          <option value="STARTS_WITH">Starts With</option>
                        </select>

                        {/* Value input — smart based on field type */}
                        {(() => {
                          const cond =
                            editingCondition?.ruleIdx === ruleIdx
                              ? editingCondition.cond
                              : null;
                          const selectedField = cond
                            ? availableFields.find((f) => f.apiName === cond.left)
                            : null;
                          const isCheckbox =
                            selectedField && selectedField.type === 'Checkbox';
                          const isPicklistField =
                            selectedField &&
                            (selectedField.type === 'Picklist' ||
                              selectedField.type === 'MultiPicklist' ||
                              selectedField.type === 'PicklistText');

                          if (isCheckbox) {
                            return (
                              <div className="flex items-center gap-2 flex-1">
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`cb-rule-${ruleIdx}`}
                                    checked={
                                      cond?.right === true || cond?.right === 'true'
                                    }
                                    onChange={() =>
                                      setEditingCondition({
                                        ruleIdx,
                                        cond: { ...cond!, right: true },
                                      })
                                    }
                                    className="w-3 h-3"
                                  />
                                  Checked
                                </label>
                                <label className="flex items-center gap-1 text-xs cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`cb-rule-${ruleIdx}`}
                                    checked={
                                      cond?.right === false || cond?.right === 'false'
                                    }
                                    onChange={() =>
                                      setEditingCondition({
                                        ruleIdx,
                                        cond: { ...cond!, right: false },
                                      })
                                    }
                                    className="w-3 h-3"
                                  />
                                  Unchecked
                                </label>
                              </div>
                            );
                          }

                          if (isPicklistField && selectedField?.picklistValues) {
                            return (
                              <div className="relative flex-1" ref={valueDropdownRef}>
                                <Input
                                  type="text"
                                  placeholder="Select value..."
                                  value={
                                    editingCondition?.ruleIdx === ruleIdx
                                      ? valueSearchTerm
                                      : ''
                                  }
                                  onChange={(e) => {
                                    setValueSearchTerm(e.target.value);
                                    setShowValueDropdown(true);
                                  }}
                                  onFocus={() => setShowValueDropdown(true)}
                                  className="h-7 text-xs"
                                />
                                {showValueDropdown && (
                                  <div className="absolute z-20 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-40 overflow-y-auto">
                                    {selectedField.picklistValues
                                      .filter(
                                        (v) =>
                                          valueSearchTerm === '' ||
                                          v
                                            .toLowerCase()
                                            .includes(valueSearchTerm.toLowerCase())
                                      )
                                      .map((v) => (
                                        <div
                                          key={v}
                                          onClick={() => {
                                            setEditingCondition({
                                              ruleIdx,
                                              cond: { ...cond!, right: v },
                                            });
                                            setValueSearchTerm(v);
                                            setShowValueDropdown(false);
                                          }}
                                          className="px-3 py-1.5 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0"
                                        >
                                          {v}
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return (
                            <Input
                              type="text"
                              placeholder="Value"
                              value={cond?.right != null ? String(cond.right) : ''}
                              onChange={(e) => {
                                if (
                                  editingCondition &&
                                  editingCondition.ruleIdx === ruleIdx
                                ) {
                                  setEditingCondition({
                                    ruleIdx,
                                    cond: {
                                      ...editingCondition.cond,
                                      right: e.target.value,
                                    },
                                  });
                                }
                              }}
                              className="h-7 text-xs flex-1"
                            />
                          );
                        })()}

                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 flex-shrink-0"
                          onClick={() => addConditionToRule(ruleIdx)}
                          disabled={
                            !editingCondition ||
                            editingCondition.ruleIdx !== ruleIdx ||
                            !editingCondition.cond.left ||
                            editingCondition.cond.right === '' ||
                            editingCondition.cond.right === undefined
                          }
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Values Section */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-xs font-semibold text-gray-700">
                        Show these values when conditions are met:
                      </Label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => selectAllValues(ruleIdx)}
                          className="text-[10px] text-blue-600 hover:text-blue-800"
                        >
                          All
                        </button>
                        <button
                          onClick={() => deselectAllValues(ruleIdx)}
                          className="text-[10px] text-blue-600 hover:text-blue-800"
                        >
                          None
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1 max-h-48 overflow-y-auto bg-white rounded border p-2">
                      {picklistValues.map((val) => {
                        const isSelected = rule.values.includes(val);
                        return (
                          <label
                            key={val}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-xs"
                            onClick={() => toggleValueInRule(ruleIdx, val)}
                          >
                            <div
                              className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600'
                                  : 'border-gray-300'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className={isSelected ? 'font-medium' : ''}>
                              {val}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {rule.values.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Select at least one value to show when conditions are met.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Rule Button */}
      <Button variant="outline" size="sm" className="w-full" onClick={addNewRule}>
        <Plus className="w-4 h-4 mr-2" />
        Add Rule
      </Button>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={() => {
            // Clean: remove rules with no conditions or no values
            const cleaned = rules.filter(
              (r) => r.conditions.length > 0 && r.values.length > 0
            );
            onSave(cleaned);
          }}
          size="sm"
          className="flex-1 border-2 border-brand-navy"
        >
          Save Value Dependencies
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}

export { PicklistDependencyEditor };
