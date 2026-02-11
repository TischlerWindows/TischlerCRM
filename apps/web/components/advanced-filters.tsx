'use client';

import { useState, useEffect } from 'react';
import { Filter, X, Plus, Save, Trash2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FilterCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  logicOperator?: 'AND' | 'OR';
}

export interface FilterPreset {
  id: string;
  name: string;
  conditions: FilterCondition[];
  isDefault?: boolean;
}

interface AdvancedFiltersProps {
  fields: Array<{ id: string; label: string; type?: string }>;
  onApplyFilters: (conditions: FilterCondition[]) => void;
  onClearFilters: () => void;
  storageKey: string; // For saving presets
  className?: string;
}

const OPERATORS = {
  text: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does Not Contain' },
    { value: 'starts_with', label: 'Starts With' },
    { value: 'ends_with', label: 'Ends With' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'greater_or_equal', label: 'Greater or Equal' },
    { value: 'less_or_equal', label: 'Less or Equal' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  date: [
    { value: 'equals', label: 'Equals' },
    { value: 'before', label: 'Before' },
    { value: 'after', label: 'After' },
    { value: 'between', label: 'Between' },
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'this_week', label: 'This Week' },
    { value: 'last_week', label: 'Last Week' },
    { value: 'this_month', label: 'This Month' },
    { value: 'last_month', label: 'Last Month' },
    { value: 'is_empty', label: 'Is Empty' },
    { value: 'is_not_empty', label: 'Is Not Empty' },
  ],
  boolean: [
    { value: 'is_true', label: 'Is True' },
    { value: 'is_false', label: 'Is False' },
  ],
};

export default function AdvancedFilters({
  fields,
  onApplyFilters,
  onClearFilters,
  storageKey,
  className,
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [conditions, setConditions] = useState<FilterCondition[]>([]);
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

  // Load presets from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`${storageKey}_filter_presets`);
    if (stored) {
      try {
        setPresets(JSON.parse(stored));
      } catch (e) {
        console.error('Error loading filter presets:', e);
      }
    }
  }, [storageKey]);

  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: `condition-${Date.now()}`,
      field: fields[0]?.id || '',
      operator: 'equals',
      value: '',
      logicOperator: conditions.length > 0 ? 'AND' : undefined,
    };
    setConditions([...conditions, newCondition]);
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions(conditions.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const applyFilters = () => {
    onApplyFilters(conditions);
    setIsOpen(false);
  };

  const clearAllFilters = () => {
    setConditions([]);
    setSelectedPreset(null);
    onClearFilters();
    setIsOpen(false);
  };

  const savePreset = () => {
    if (!presetName.trim()) return;

    const newPreset: FilterPreset = {
      id: `preset-${Date.now()}`,
      name: presetName,
      conditions: [...conditions],
    };

    const updatedPresets = [...presets, newPreset];
    setPresets(updatedPresets);
    localStorage.setItem(`${storageKey}_filter_presets`, JSON.stringify(updatedPresets));
    setPresetName('');
    setShowSavePreset(false);
    setSelectedPreset(newPreset.id);
  };

  const loadPreset = (preset: FilterPreset) => {
    setConditions([...preset.conditions]);
    setSelectedPreset(preset.id);
    onApplyFilters(preset.conditions);
  };

  const deletePreset = (presetId: string) => {
    const updatedPresets = presets.filter(p => p.id !== presetId);
    setPresets(updatedPresets);
    localStorage.setItem(`${storageKey}_filter_presets`, JSON.stringify(updatedPresets));
    if (selectedPreset === presetId) {
      setSelectedPreset(null);
    }
  };

  const getFieldType = (fieldId: string): 'text' | 'number' | 'date' | 'boolean' => {
    const field = fields.find(f => f.id === fieldId);
    return (field?.type as any) || 'text';
  };

  const getOperators = (fieldId: string) => {
    const fieldType = getFieldType(fieldId);
    return OPERATORS[fieldType] || OPERATORS.text;
  };

  const activeFilterCount = conditions.length;

  return (
    <div className={cn('relative', className)}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors',
          activeFilterCount > 0
            ? 'bg-indigo-50 border-indigo-300 text-indigo-700 hover:bg-indigo-100'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
        )}
      >
        <Filter className="w-4 h-4" />
        <span>Filters</span>
        {activeFilterCount > 0 && (
          <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-[600px] bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[600px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Presets */}
            {presets.length > 0 && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="text-sm font-medium text-gray-700 mb-2">Saved Filters</div>
                <div className="flex flex-wrap gap-2">
                  {presets.map(preset => (
                    <div
                      key={preset.id}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
                        selectedPreset === preset.id
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-300'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      )}
                    >
                      <button
                        onClick={() => loadPreset(preset)}
                        className="flex-1"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePreset(preset.id);
                        }}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conditions */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conditions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Filter className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p>No filters applied</p>
                  <p className="text-sm">Click "Add Condition" to start filtering</p>
                </div>
              ) : (
                conditions.map((condition, index) => (
                  <div key={condition.id} className="space-y-2">
                    {/* Logic Operator */}
                    {index > 0 && (
                      <div className="flex items-center gap-2">
                        <select
                          value={condition.logicOperator}
                          onChange={(e) =>
                            updateCondition(condition.id, {
                              logicOperator: e.target.value as 'AND' | 'OR',
                            })
                          }
                          className="px-2 py-1 border border-gray-300 rounded text-sm font-medium text-indigo-600 bg-indigo-50"
                        >
                          <option value="AND">AND</option>
                          <option value="OR">OR</option>
                        </select>
                        <div className="flex-1 h-px bg-gray-200" />
                      </div>
                    )}

                    {/* Condition Row */}
                    <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 grid grid-cols-3 gap-2">
                        {/* Field */}
                        <select
                          value={condition.field}
                          onChange={(e) =>
                            updateCondition(condition.id, {
                              field: e.target.value,
                              operator: 'equals',
                              value: '',
                            })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          {fields.map(field => (
                            <option key={field.id} value={field.id}>
                              {field.label}
                            </option>
                          ))}
                        </select>

                        {/* Operator */}
                        <select
                          value={condition.operator}
                          onChange={(e) =>
                            updateCondition(condition.id, { operator: e.target.value })
                          }
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          {getOperators(condition.field).map(op => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>

                        {/* Value */}
                        {!['is_empty', 'is_not_empty', 'today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'is_true', 'is_false'].includes(condition.operator) && (
                          <input
                            type={getFieldType(condition.field) === 'date' ? 'date' : 'text'}
                            value={condition.value}
                            onChange={(e) =>
                              updateCondition(condition.id, { value: e.target.value })
                            }
                            placeholder="Enter value..."
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                          />
                        )}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeCondition(condition.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove condition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              {/* Add Condition Button */}
              <button
                onClick={addCondition}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Condition
              </button>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {conditions.length > 0 && !showSavePreset && (
                  <button
                    onClick={() => setShowSavePreset(true)}
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-white rounded-lg transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Save as Preset
                  </button>
                )}

                {showSavePreset && (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="Preset name..."
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48"
                      onKeyDown={(e) => e.key === 'Enter' && savePreset()}
                    />
                    <button
                      onClick={savePreset}
                      disabled={!presetName.trim()}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setShowSavePreset(false);
                        setPresetName('');
                      }}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={applyFilters}
                  disabled={conditions.length === 0}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
