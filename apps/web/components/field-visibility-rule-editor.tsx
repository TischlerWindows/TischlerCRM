'use client';

import { useState } from 'react';
import { ConditionExpr, FieldDef } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';
import { formatCondition } from '@/lib/field-visibility';

interface FieldVisibilityRuleEditorProps {
  field: FieldDef;
  availableFields: FieldDef[];
  onSave: (conditions: ConditionExpr[]) => void;
  onCancel: () => void;
}

export default function FieldVisibilityRuleEditor({
  field,
  availableFields,
  onSave,
  onCancel,
}: FieldVisibilityRuleEditorProps) {
  const [conditions, setConditions] = useState<ConditionExpr[]>(field.visibleIf || []);
  const [newCondition, setNewCondition] = useState<Partial<ConditionExpr>>({
    left: '',
    op: '==',
    right: '',
  });
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [valueSearchTerm, setValueSearchTerm] = useState<string>('');
  const [showValueDropdown, setShowValueDropdown] = useState(false);

  const handleAddCondition = () => {
    if (newCondition.left && newCondition.op && newCondition.right !== '') {
      setConditions([...conditions, newCondition as ConditionExpr]);
      setNewCondition({ left: '', op: '==', right: '' });
    }
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave(conditions);
  };

  const getFieldLabel = (apiName: string) => {
    return availableFields.find(f => f.apiName === apiName)?.label || apiName;
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div>
        <h3 className="font-semibold text-sm mb-2">Field Visibility Rules for {field.label}</h3>
        <p className="text-xs text-gray-600 mb-4">This field will only show if ALL conditions are met (AND logic)</p>
      </div>

      {/* Existing Conditions */}
      {conditions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Current Rules:</Label>
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
              <span className="text-gray-700">
                {formatCondition(condition, getFieldLabel(condition.left))}
              </span>
              <button
                onClick={() => handleRemoveCondition(index)}
                className="text-red-500 hover:text-red-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Condition */}
      <div className="space-y-2 border-t pt-4">
        <Label className="text-xs font-medium">Add Rule:</Label>
        
        {/* Field Selection */}
        <div className="relative">
          <Label htmlFor="condition-field" className="text-xs">When field:</Label>
          <Input
            id="condition-field"
            type="text"
            placeholder="Search fields..."
            value={fieldSearchTerm}
            onChange={(e) => {
              setFieldSearchTerm(e.target.value);
              setShowFieldDropdown(true);
            }}
            onFocus={() => setShowFieldDropdown(true)}
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          />
          
          {showFieldDropdown && (
            <div className="absolute z-10 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-48 overflow-y-auto">
              {availableFields
                .filter(f => 
                  f.apiName !== field.apiName && // Don't allow self-reference
                  (fieldSearchTerm === '' || 
                   f.label.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
                   f.apiName.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
                )
                .map(f => (
                  <div
                    key={f.apiName}
                    onClick={() => {
                      setNewCondition({ ...newCondition, left: f.apiName });
                      setFieldSearchTerm(f.label);
                      setShowFieldDropdown(false);
                    }}
                    className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-xs border-b last:border-b-0"
                  >
                    <div className="font-medium">{f.label}</div>
                    <div className="text-gray-500 text-xs">{f.apiName}</div>
                  </div>
                ))}
              {availableFields.filter(f => 
                f.apiName !== field.apiName && 
                (fieldSearchTerm === '' || 
                 f.label.toLowerCase().includes(fieldSearchTerm.toLowerCase()) ||
                 f.apiName.toLowerCase().includes(fieldSearchTerm.toLowerCase()))
              ).length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-500 text-center">
                  No fields found
                </div>
              )}
            </div>
          )}
        </div>

        {/* Operator Selection */}
        <div>
          <Label htmlFor="condition-op" className="text-xs">Operator:</Label>
          <select
            id="condition-op"
            value={newCondition.op || '=='}
            onChange={(e) =>
              setNewCondition({
                ...newCondition,
                op: e.target.value as ConditionExpr['op'],
              })
            }
            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
          >
            <option value="==">Equals</option>
            <option value="!=">Not Equals</option>
            <option value=">">Greater Than</option>
            <option value="<">Less Than</option>
            <option value=">=">Greater Than or Equal</option>
            <option value="<=">Less Than or Equal</option>
            <option value="IN">Is In (List)</option>
            <option value="INCLUDES">Includes (Multi-Select)</option>
            <option value="CONTAINS">Contains (Text)</option>
            <option value="STARTS_WITH">Starts With</option>
          </select>
        </div>

        {/* Value Input */}
        <div>
          <Label htmlFor="condition-value" className="text-xs">Value:</Label>
          {(() => {
            const selectedField = availableFields.find(f => f.apiName === newCondition.left);
            const isPicklist = selectedField && (selectedField.type === 'Picklist' || selectedField.type === 'MultiPicklist');
            const isCheckbox = selectedField && selectedField.type === 'Checkbox';
            
            // Handle Checkbox fields
            if (isCheckbox) {
              return (
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="checkbox-value"
                      value="true"
                      checked={newCondition.right === true || newCondition.right === 'true'}
                      onChange={() => setNewCondition({ ...newCondition, right: true })}
                      className="w-4 h-4"
                    />
                    <span>Checked</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs">
                    <input
                      type="radio"
                      name="checkbox-value"
                      value="false"
                      checked={newCondition.right === false || newCondition.right === 'false'}
                      onChange={() => setNewCondition({ ...newCondition, right: false })}
                      className="w-4 h-4"
                    />
                    <span>Unchecked</span>
                  </label>
                </div>
              );
            }
            
            if (isPicklist && selectedField?.picklistValues) {
              const filteredValues = selectedField.picklistValues.filter(v =>
                valueSearchTerm === '' || v.toLowerCase().includes(valueSearchTerm.toLowerCase())
              );
              
              return (
                <div className="relative">
                  <Input
                    id="condition-value"
                    type="text"
                    placeholder="Search values..."
                    value={valueSearchTerm}
                    onChange={(e) => {
                      setValueSearchTerm(e.target.value);
                      setShowValueDropdown(true);
                    }}
                    onFocus={() => setShowValueDropdown(true)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                  
                  {showValueDropdown && (
                    <div className="absolute z-10 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-48 overflow-y-auto">
                      {filteredValues.map(value => (
                        <div
                          key={value}
                          onClick={() => {
                            setNewCondition({ ...newCondition, right: value });
                            setValueSearchTerm(value);
                            setShowValueDropdown(false);
                          }}
                          className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-xs border-b last:border-b-0"
                        >
                          {value}
                        </div>
                      ))}
                      {filteredValues.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-500 text-center">
                          No values found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            
            return (
              <Input
                id="condition-value"
                type="text"
                placeholder="Enter value"
                value={newCondition.right || ''}
                onChange={(e) =>
                  setNewCondition({ ...newCondition, right: e.target.value })
                }
                className="h-8 text-xs"
              />
            );
          })()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button 
          onClick={() => {
            let finalConditions = [...conditions];
            
            // Add the new condition if filled out
            if (newCondition.left && newCondition.op && newCondition.right !== '') {
              finalConditions = [...finalConditions, newCondition as ConditionExpr];
            }
            
            // Save all conditions
            onSave(finalConditions);
          }}
          size="sm" 
          className="flex-1 border-2 border-indigo-600"
        >
          Save Visibility Rules
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="flex-1">
          Cancel
        </Button>
      </div>

      {conditions.length === 0 && (
        <p className="text-xs text-gray-500 italic">No rules - field will always be visible</p>
      )}
    </div>
  );
}

export { FieldVisibilityRuleEditor };
