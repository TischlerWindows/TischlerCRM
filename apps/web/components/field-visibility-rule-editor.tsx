'use client';

import { useState, useEffect, useRef } from 'react';
import { ConditionExpr, FieldDef } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, User, Check } from 'lucide-react';
import { formatCondition } from '@/lib/field-visibility';
import { apiClient } from '@/lib/api-client';

interface UserRecord {
  id: string;
  name: string | null;
  email: string;
}

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
  // Separate user-based conditions from field-based conditions
  const existingUserCondition = (field.visibleIf || []).find(c => c.left === '__currentUser__');
  const existingFieldConditions = (field.visibleIf || []).filter(c => c.left !== '__currentUser__');

  const [conditions, setConditions] = useState<ConditionExpr[]>(existingFieldConditions);
  const [newCondition, setNewCondition] = useState<Partial<ConditionExpr>>({
    left: '',
    op: '==',
    right: '',
  });
  const [fieldSearchTerm, setFieldSearchTerm] = useState<string>('');
  const [showFieldDropdown, setShowFieldDropdown] = useState(false);
  const [valueSearchTerm, setValueSearchTerm] = useState<string>('');
  const [showValueDropdown, setShowValueDropdown] = useState(false);
  // Multi-value state for INCLUDES operator
  const [selectedIncludesValues, setSelectedIncludesValues] = useState<string[]>([]);

  // Click-outside handler to close all dropdowns
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowFieldDropdown(false);
        setShowValueDropdown(false);
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Refs for individual dropdowns to close when clicking outside their area
  const fieldDropdownRef = useRef<HTMLDivElement>(null);
  const valueDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(e.target as Node)) {
        setShowFieldDropdown(false);
      }
      if (valueDropdownRef.current && !valueDropdownRef.current.contains(e.target as Node)) {
        setShowValueDropdown(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // User-based visibility state
  const [enableUserVisibility, setEnableUserVisibility] = useState(!!existingUserCondition);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(
    existingUserCondition && Array.isArray(existingUserCondition.right) ? existingUserCondition.right : []
  );
  const [allUsers, setAllUsers] = useState<UserRecord[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Fetch users when user visibility is enabled
  useEffect(() => {
    if (enableUserVisibility && allUsers.length === 0) {
      apiClient.get<any>('/admin/users')
        .then((res: any) => {
          // API returns a plain array directly
          const users = Array.isArray(res) ? res : (res.data?.users || res.users || res.data || []);
          setAllUsers(users);
        })
        .catch(() => {});
    }
  }, [enableUserVisibility, allUsers.length]);

  // Build a map of userId -> display name for formatting
  const userNameMap: Record<string, string> = {};
  allUsers.forEach(u => { userNameMap[u.id] = u.name || u.email; });

  const handleAddCondition = () => {
    if (newCondition.left && newCondition.op && newCondition.right !== '' &&
        !(Array.isArray(newCondition.right) && newCondition.right.length === 0)) {
      setConditions([...conditions, newCondition as ConditionExpr]);
      setNewCondition({ left: '', op: '==', right: '' });
      setSelectedIncludesValues([]);
      setValueSearchTerm('');
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
    <div ref={containerRef} className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <div>
        <h3 className="font-semibold text-sm mb-2">Field Visibility Rules for {field.label}</h3>
        <p className="text-xs text-gray-600 mb-4">This field will only show if ALL conditions are met (AND logic)</p>
      </div>

      {/* Existing Conditions */}
      {conditions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">Current Field Rules:</Label>
          {conditions.map((condition, index) => (
            <div key={index} className="flex items-center justify-between bg-white p-2 rounded border text-sm">
              <span className="text-gray-700">
                {formatCondition(condition, getFieldLabel(condition.left), userNameMap)}
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
        <div className="relative" ref={fieldDropdownRef}>
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
                      const isPicklist = f.type === 'Picklist' || f.type === 'MultiPicklist';
                      const isMultiOp = newCondition.op === 'INCLUDES' || newCondition.op === 'IN' || ((newCondition.op === '==' || newCondition.op === '!=') && isPicklist);
                      setNewCondition({ ...newCondition, left: f.apiName, right: isMultiOp ? [] : '' });
                      setFieldSearchTerm(f.label);
                      setShowFieldDropdown(false);
                      setSelectedIncludesValues([]);
                      setValueSearchTerm('');
                    }}
                    className="px-3 py-2 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0"
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
            onChange={(e) => {
              const op = e.target.value as ConditionExpr['op'];
              const selectedField = availableFields.find(f => f.apiName === newCondition.left);
              const isPicklist = selectedField && (selectedField.type === 'Picklist' || selectedField.type === 'MultiPicklist');
              const isMultiOp = op === 'INCLUDES' || op === 'IN' || ((op === '==' || op === '!=') && isPicklist);
              setSelectedIncludesValues([]);
              setNewCondition({
                ...newCondition,
                op,
                right: isMultiOp ? [] : '',
              });
            }}
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
              const isMultiValueOp = newCondition.op === 'INCLUDES' || newCondition.op === 'IN' || newCondition.op === '==' || newCondition.op === '!=';
              const filteredValues = selectedField.picklistValues.filter(v =>
                valueSearchTerm === '' || v.toLowerCase().includes(valueSearchTerm.toLowerCase())
              );
              
              // Multi-value picker for INCLUDES / IN operators
              if (isMultiValueOp) {
                return (
                  <div className="space-y-2">
                    {/* Selected value pills */}
                    {selectedIncludesValues.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {selectedIncludesValues.map(val => (
                          <span key={val} className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full text-xs">
                            {val}
                            <button
                              onClick={() => {
                                const next = selectedIncludesValues.filter(v => v !== val);
                                setSelectedIncludesValues(next);
                                setNewCondition({ ...newCondition, right: next });
                              }}
                              className="hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Search + dropdown */}
                    <div className="relative" ref={valueDropdownRef}>
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
                          {filteredValues.map(value => {
                            const isSelected = selectedIncludesValues.includes(value);
                            return (
                              <div
                                key={value}
                                onClick={() => {
                                  let next: string[];
                                  if (isSelected) {
                                    next = selectedIncludesValues.filter(v => v !== value);
                                  } else {
                                    next = [...selectedIncludesValues, value];
                                  }
                                  setSelectedIncludesValues(next);
                                  setNewCondition({ ...newCondition, right: next });
                                }}
                                className={`px-3 py-2 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0 flex items-center gap-2 ${isSelected ? 'bg-amber-50' : ''}`}
                              >
                                <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-amber-600 border-amber-600' : 'border-gray-300'}`}>
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                                {value}
                              </div>
                            );
                          })}
                          {filteredValues.length === 0 && (
                            <div className="px-3 py-2 text-xs text-gray-500 text-center">
                              No values found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Single-value picker for other operators
              return (
                <div className="relative" ref={valueDropdownRef}>
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
                          className="px-3 py-2 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0"
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

      {/* Visibility by User */}
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enable-user-visibility"
            checked={enableUserVisibility}
            onChange={(e) => {
              setEnableUserVisibility(e.target.checked);
              if (!e.target.checked) {
                setSelectedUserIds([]);
              }
            }}
            className="w-4 h-4 rounded border-gray-300"
          />
          <Label htmlFor="enable-user-visibility" className="text-xs font-medium cursor-pointer flex items-center gap-1">
            <User className="w-3.5 h-3.5" />
            Visible to specific users only
          </Label>
        </div>

        {enableUserVisibility && (
          <div className="ml-6 space-y-2">
            {/* Selected users */}
            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedUserIds.map(uid => {
                  const u = allUsers.find(u => u.id === uid);
                  return (
                    <span key={uid} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                      {u ? (u.name || u.email) : uid}
                      <button onClick={() => setSelectedUserIds(prev => prev.filter(id => id !== uid))} className="hover:text-red-600">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* User search */}
            <div className="relative" ref={userDropdownRef}>
              <Input
                type="text"
                placeholder="Search users..."
                value={userSearchTerm}
                onChange={(e) => {
                  setUserSearchTerm(e.target.value);
                  setShowUserDropdown(true);
                }}
                onFocus={() => setShowUserDropdown(true)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              />
              {showUserDropdown && (
                <div className="absolute z-10 w-full mt-1 border border-gray-300 rounded bg-white shadow-lg max-h-48 overflow-y-auto">
                  {allUsers
                    .filter(u =>
                      userSearchTerm === '' ||
                      (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                      u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                    )
                    .map(u => {
                      const isSelected = selectedUserIds.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                            } else {
                              setSelectedUserIds(prev => [...prev, u.id]);
                            }
                          }}
                          className={`px-3 py-2 hover:bg-[#f0f1fa] cursor-pointer text-xs border-b last:border-b-0 flex items-center gap-2 ${isSelected ? 'bg-blue-50' : ''}`}
                        >
                          <div className={`w-4 h-4 border rounded flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <div className="font-medium">{u.name || 'No name'}</div>
                            <div className="text-gray-500">{u.email}</div>
                          </div>
                        </div>
                      );
                    })}
                  {allUsers.filter(u =>
                    userSearchTerm === '' ||
                    (u.name || '').toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                      {allUsers.length === 0 ? 'Loading users...' : 'No users found'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedUserIds.length === 0 && (
              <p className="text-xs text-amber-600">Select at least one user, or uncheck the option above</p>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 border-t">
        <Button 
          onClick={() => {
            let finalConditions = [...conditions];
            
            // Add the new field condition if filled out
            const rightFilled = Array.isArray(newCondition.right)
              ? newCondition.right.length > 0
              : newCondition.right !== '' && newCondition.right !== undefined;
            if (newCondition.left && newCondition.op && rightFilled) {
              finalConditions = [...finalConditions, newCondition as ConditionExpr];
            }

            // Add user visibility condition if enabled with selected users
            if (enableUserVisibility && selectedUserIds.length > 0) {
              finalConditions.push({
                left: '__currentUser__',
                op: 'IN',
                right: selectedUserIds,
              });
            }
            
            // Save all conditions
            onSave(finalConditions);
          }}
          size="sm" 
          className="flex-1 border-2 border-brand-navy"
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
