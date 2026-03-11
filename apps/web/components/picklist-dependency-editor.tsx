'use client';

import { useState, useRef, useEffect } from 'react';
import { ConditionExpr, FieldDef } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { formatCondition } from '@/lib/field-visibility';

interface PicklistDependencyEditorProps {
  field: FieldDef;
  availableFields: FieldDef[];
  onSave: (dependencies: { [value: string]: ConditionExpr[] }) => void;
  onCancel: () => void;
}

export default function PicklistDependencyEditor({
  field,
  availableFields,
  onSave,
  onCancel,
}: PicklistDependencyEditorProps) {
  const picklistValues = field.picklistValues || [];
  const [dependencies, setDependencies] = useState<{ [value: string]: ConditionExpr[] }>(
    field.picklistDependencies ? { ...field.picklistDependencies } : {}
  );
  const [expandedValues, setExpandedValues] = useState<Set<string>>(new Set());

  // Per-value new condition state
  const [newConditions, setNewConditions] = useState<{ [value: string]: Partial<ConditionExpr> }>({});
  const [activeFieldSearch, setActiveFieldSearch] = useState<string | null>(null);
  const [fieldSearchTerms, setFieldSearchTerms] = useState<{ [value: string]: string }>({});
  const [activeValueSearch, setActiveValueSearch] = useState<string | null>(null);
  const [valueSearchTerms, setValueSearchTerms] = useState<{ [value: string]: string }>({});

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveFieldSearch(null);
        setActiveValueSearch(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleExpand = (value: string) => {
    setExpandedValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const getNewCondition = (value: string): Partial<ConditionExpr> => {
    return newConditions[value] || { left: '', op: '==', right: '' };
  };

  const setNewCondition = (value: string, cond: Partial<ConditionExpr>) => {
    setNewConditions((prev) => ({ ...prev, [value]: cond }));
  };

  const addCondition = (value: string) => {
    const cond = getNewCondition(value);
    if (!cond.left || !cond.op || cond.right === '' || cond.right === undefined) return;

    setDependencies((prev) => ({
      ...prev,
      [value]: [...(prev[value] || []), cond as ConditionExpr],
    }));
    setNewConditions((prev) => ({ ...prev, [value]: { left: '', op: '==', right: '' } }));
    setFieldSearchTerms((prev) => ({ ...prev, [value]: '' }));
    setValueSearchTerms((prev) => ({ ...prev, [value]: '' }));
  };

  const removeCondition = (value: string, index: number) => {
    setDependencies((prev) => {
      const updated = { ...prev };
      updated[value] = (updated[value] || []).filter((_, i) => i !== index);
      if (updated[value].length === 0) delete updated[value];
      return updated;
    });
  };

  const removeAllForValue = (value: string) => {
    setDependencies((prev) => {
      const updated = { ...prev };
      delete updated[value];
      return updated;
    });
  };

  const getFieldLabel = (apiName: string) => {
    return availableFields.find((f) => f.apiName === apiName)?.label || apiName;
  };

  const totalRules = Object.values(dependencies).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div ref={containerRef} className="space-y-4">
      <div>
        <p className="text-xs text-gray-600 mb-2">
          Configure conditions for individual picklist values. A value will only
          appear in the dropdown if ALL of its conditions are met (AND logic).
          Values without rules always appear.
        </p>
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
          {totalRules} rule{totalRules !== 1 ? 's' : ''} across{' '}
          {Object.keys(dependencies).length} value
          {Object.keys(dependencies).length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Value list */}
      <div className="space-y-1 max-h-[50vh] overflow-y-auto">
        {picklistValues.map((val) => {
          const isExpanded = expandedValues.has(val);
          const conditions = dependencies[val] || [];
          const hasRules = conditions.length > 0;
          const cond = getNewCondition(val);

          return (
            <div
              key={val}
              className={`border rounded ${hasRules ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}
            >
              {/* Value header */}
              <button
                onClick={() => toggleExpand(val)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <span className="font-medium">{val}</span>
                </div>
                {hasRules && (
                  <span className="text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    {conditions.length} rule{conditions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </button>

              {/* Expanded section */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-200 space-y-2">
                  {/* Existing conditions */}
                  {conditions.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {conditions.map((condition, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white p-2 rounded border text-xs"
                        >
                          <span className="text-gray-700">
                            {formatCondition(condition, getFieldLabel(condition.left), {})}
                          </span>
                          <button
                            onClick={() => removeCondition(val, idx)}
                            className="text-red-500 hover:text-red-700 ml-2"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => removeAllForValue(val)}
                        className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 mt-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        Remove all rules for this value
                      </button>
                    </div>
                  )}

                  {/* Add new condition */}
                  <div className="space-y-2 mt-2 pt-2 border-t border-gray-100">
                    <Label className="text-xs font-medium text-gray-600">Add rule:</Label>

                    {/* Field Selection */}
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Select field..."
                        value={fieldSearchTerms[val] || ''}
                        onChange={(e) => {
                          setFieldSearchTerms((prev) => ({ ...prev, [val]: e.target.value }));
                          setActiveFieldSearch(val);
                        }}
                        onFocus={() => setActiveFieldSearch(val)}
                        className="h-7 text-xs"
                      />
                      {activeFieldSearch === val && (
                        <div className="absolute z-20 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-40 overflow-y-auto">
                          {availableFields
                            .filter(
                              (f) =>
                                f.apiName !== field.apiName &&
                                ((fieldSearchTerms[val] || '') === '' ||
                                  f.label
                                    .toLowerCase()
                                    .includes((fieldSearchTerms[val] || '').toLowerCase()) ||
                                  f.apiName
                                    .toLowerCase()
                                    .includes((fieldSearchTerms[val] || '').toLowerCase()))
                            )
                            .map((f) => (
                              <div
                                key={f.apiName}
                                onClick={() => {
                                  setNewCondition(val, { ...cond, left: f.apiName });
                                  setFieldSearchTerms((prev) => ({ ...prev, [val]: f.label }));
                                  setActiveFieldSearch(null);
                                }}
                                className="px-3 py-1.5 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0"
                              >
                                <div className="font-medium">{f.label}</div>
                                <div className="text-gray-400 text-[10px]">{f.apiName}</div>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Operator + Value row */}
                    <div className="flex gap-2">
                      <select
                        value={cond.op || '=='}
                        onChange={(e) =>
                          setNewCondition(val, {
                            ...cond,
                            op: e.target.value as ConditionExpr['op'],
                          })
                        }
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

                      {/* Value input — smart based on selected field type */}
                      {(() => {
                        const selectedField = availableFields.find(
                          (f) => f.apiName === cond.left
                        );
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
                                  name={`cb-${val}`}
                                  checked={
                                    cond.right === true || cond.right === 'true'
                                  }
                                  onChange={() =>
                                    setNewCondition(val, { ...cond, right: true })
                                  }
                                  className="w-3 h-3"
                                />
                                Checked
                              </label>
                              <label className="flex items-center gap-1 text-xs cursor-pointer">
                                <input
                                  type="radio"
                                  name={`cb-${val}`}
                                  checked={
                                    cond.right === false || cond.right === 'false'
                                  }
                                  onChange={() =>
                                    setNewCondition(val, { ...cond, right: false })
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
                            <div className="relative flex-1">
                              <Input
                                type="text"
                                placeholder="Select value..."
                                value={valueSearchTerms[val] || ''}
                                onChange={(e) => {
                                  setValueSearchTerms((prev) => ({
                                    ...prev,
                                    [val]: e.target.value,
                                  }));
                                  setActiveValueSearch(val);
                                }}
                                onFocus={() => setActiveValueSearch(val)}
                                className="h-7 text-xs"
                              />
                              {activeValueSearch === val && (
                                <div className="absolute z-20 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-40 overflow-y-auto">
                                  {selectedField.picklistValues
                                    .filter(
                                      (v) =>
                                        (valueSearchTerms[val] || '') === '' ||
                                        v
                                          .toLowerCase()
                                          .includes(
                                            (
                                              valueSearchTerms[val] || ''
                                            ).toLowerCase()
                                          )
                                    )
                                    .map((v) => (
                                      <div
                                        key={v}
                                        onClick={() => {
                                          setNewCondition(val, {
                                            ...cond,
                                            right: v,
                                          });
                                          setValueSearchTerms((prev) => ({
                                            ...prev,
                                            [val]: v,
                                          }));
                                          setActiveValueSearch(null);
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
                            value={(cond.right as string) || ''}
                            onChange={(e) =>
                              setNewCondition(val, { ...cond, right: e.target.value })
                            }
                            className="h-7 text-xs flex-1"
                          />
                        );
                      })()}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 flex-shrink-0"
                        onClick={() => addCondition(val)}
                        disabled={!cond.left || cond.right === '' || cond.right === undefined}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button
          onClick={() => onSave(dependencies)}
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
