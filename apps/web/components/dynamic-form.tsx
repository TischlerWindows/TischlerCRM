'use client';

import React, { useState, useEffect } from 'react';
import { useSchemaStore } from '@/lib/schema-store';
import { PageLayout, FieldDef, FieldType, ObjectDef } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronDown,
  ChevronRight,
  Calendar as CalendarIcon,
  DollarSign,
  Hash,
  Percent,
  Phone,
  Mail,
  Globe,
  MapPin,
  Clock,
  Lock,
  FileText,
  CheckSquare,
  List,
  Link as LinkIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DynamicFormProps {
  objectApiName: string;
  layoutType: 'create' | 'edit';
  layoutId?: string;
  recordData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onCancel?: () => void;
}

export default function DynamicForm({
  objectApiName,
  layoutType,
  layoutId,
  recordData = {},
  onSubmit,
  onCancel,
}: DynamicFormProps) {
  const { schema } = useSchemaStore();
  const [formData, setFormData] = useState<Record<string, any>>(recordData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('');

  const object = schema?.objects.find((o) => o.apiName === objectApiName);
  // If layoutId is provided, use it; otherwise fall back to finding by layoutType
  const layout = layoutId
    ? object?.pageLayouts?.find((l) => l.id === layoutId)
    : object?.pageLayouts?.find((l) => l.layoutType === layoutType);

  useEffect(() => {
    if (layout && layout.tabs.length > 0 && !activeTab && layout.tabs[0]) {
      setActiveTab(layout.tabs[0].id);
    }
  }, [layout, activeTab]);

  if (!object || !layout) {
    return (
      <div className="p-6 text-center text-gray-500">
        {!object
          ? 'Object not found'
          : `No ${layoutType === 'create' ? 'create' : 'edit'} layout configured for this object`}
      </div>
    );
  }

  const getFieldDef = (apiName: string): FieldDef | undefined => {
    return object.fields.find((f) => f.apiName === apiName);
  };

  const getFieldIcon = (type: FieldType) => {
    const iconMap: Record<string, any> = {
      Text: FileText,
      TextArea: FileText,
      LongTextArea: FileText,
      RichTextArea: FileText,
      EncryptedText: Lock,
      Email: Mail,
      Phone: Phone,
      URL: Globe,
      Number: Hash,
      Currency: DollarSign,
      Percent: Percent,
      Date: CalendarIcon,
      DateTime: CalendarIcon,
      Time: Clock,
      Checkbox: CheckSquare,
      Picklist: List,
      MultiPicklist: List,
      Address: MapPin,
      Geolocation: MapPin,
      Lookup: LinkIcon,
      ExternalLookup: LinkIcon,
      AutoNumber: Hash,
      Formula: Hash,
      RollupSummary: Hash,
    };
    return iconMap[type] || FileText;
  };

  const handleFieldChange = (fieldApiName: string, value: any) => {
    setFormData({ ...formData, [fieldApiName]: value });
    // Clear error for this field
    if (errors[fieldApiName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldApiName];
      setErrors(newErrors);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate all fields in the layout
    layout.tabs.forEach((tab) => {
      tab.sections.forEach((section) => {
        section.fields.forEach((field) => {
          const fieldDef = getFieldDef(field.apiName);
          if (!fieldDef) return;

          const value = formData[field.apiName];

          // Required field validation
          if (fieldDef.required) {
            if (value === undefined || value === null || value === '') {
              newErrors[field.apiName] = `${fieldDef.label} is required`;
            }
          }

          // Type-specific validation
          if (value !== undefined && value !== null && value !== '') {
            switch (fieldDef.type) {
              case 'Email':
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                  newErrors[field.apiName] = 'Invalid email format';
                }
                break;
              case 'URL':
                try {
                  new URL(value);
                } catch {
                  newErrors[field.apiName] = 'Invalid URL format';
                }
                break;
              case 'Phone':
                if (!/^[\d\s\-\+\(\)]+$/.test(value)) {
                  newErrors[field.apiName] = 'Invalid phone format';
                }
                break;
              case 'Number':
              case 'Currency':
              case 'Percent':
                if (isNaN(Number(value))) {
                  newErrors[field.apiName] = 'Must be a valid number';
                }
                break;
            }
          }

          // Min/Max validation
          if (value !== undefined && value !== null && value !== '') {
            if (fieldDef.min !== undefined && Number(value) < fieldDef.min) {
              newErrors[field.apiName] = `Value must be at least ${fieldDef.min}`;
            }
            if (fieldDef.max !== undefined && Number(value) > fieldDef.max) {
              newErrors[field.apiName] = `Value must be at most ${fieldDef.max}`;
            }
          }

          // Length validation
          if (typeof value === 'string') {
            if (fieldDef.minLength !== undefined && value.length < fieldDef.minLength) {
              newErrors[field.apiName] = `Must be at least ${fieldDef.minLength} characters`;
            }
            if (fieldDef.maxLength !== undefined && value.length > fieldDef.maxLength) {
              newErrors[field.apiName] = `Must be at most ${fieldDef.maxLength} characters`;
            }
          }
        });
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections);
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId);
    } else {
      newCollapsed.add(sectionId);
    }
    setCollapsedSections(newCollapsed);
  };

  const renderField = (fieldDef: FieldDef) => {
    const value = formData[fieldDef.apiName];
    const error = errors[fieldDef.apiName];
    const Icon = getFieldIcon(fieldDef.type);
    const isReadOnly = fieldDef.readOnly || fieldDef.type === 'AutoNumber' || fieldDef.type === 'Formula' || fieldDef.type === 'RollupSummary';

    const commonProps = {
      id: fieldDef.apiName,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleFieldChange(fieldDef.apiName, e.target.value),
      disabled: isReadOnly,
      className: cn(error && 'border-red-500'),
    };

    let inputElement: React.ReactNode;

    switch (fieldDef.type) {
      case 'Checkbox':
        inputElement = (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id={fieldDef.apiName}
              checked={value || false}
              onChange={(e) => handleFieldChange(fieldDef.apiName, e.target.checked)}
              disabled={isReadOnly}
              className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
            />
            <Label htmlFor={fieldDef.apiName} className="text-sm font-normal">
              {fieldDef.label}
              {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        );
        return (
          <div key={fieldDef.apiName} className="flex flex-col">
            {inputElement}
            {error && <span className="text-xs text-red-500 mt-1">{error}</span>}
            {fieldDef.helpText && (
              <span className="text-xs text-gray-500 mt-1">{fieldDef.helpText}</span>
            )}
          </div>
        );

      case 'TextArea':
        inputElement = <Textarea {...commonProps} rows={3} />;
        break;

      case 'LongTextArea':
        inputElement = <Textarea {...commonProps} rows={6} />;
        break;

      case 'RichTextArea':
        inputElement = <Textarea {...commonProps} rows={8} placeholder="Rich text editor (simplified)" />;
        break;

      case 'Picklist':
        const picklistOptions = fieldDef.picklistValues || [];
        inputElement = (
          <select {...commonProps} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
            <option value="">-- Select --</option>
            {picklistOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
        break;

      case 'MultiPicklist':
        const multiPicklistOptions = fieldDef.picklistValues || [];
        const selectedValues = value ? value.split(';') : [];
        inputElement = (
          <div className="border border-gray-300 rounded-lg p-2 max-h-48 overflow-y-auto">
            {multiPicklistOptions.map((option) => (
              <div key={option} className="flex items-center space-x-2 py-1">
                <input
                  type="checkbox"
                  id={`${fieldDef.apiName}-${option}`}
                  checked={selectedValues.includes(option)}
                  onChange={(e) => {
                    let newValues = [...selectedValues];
                    if (e.target.checked) {
                      newValues.push(option);
                    } else {
                      newValues = newValues.filter((v) => v !== option);
                    }
                    handleFieldChange(fieldDef.apiName, newValues.join(';'));
                  }}
                  disabled={isReadOnly}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor={`${fieldDef.apiName}-${option}`} className="text-sm">
                  {option}
                </label>
              </div>
            ))}
          </div>
        );
        break;

      case 'Date':
        inputElement = <Input {...commonProps} type="date" />;
        break;

      case 'DateTime':
        inputElement = <Input {...commonProps} type="datetime-local" />;
        break;

      case 'Time':
        inputElement = <Input {...commonProps} type="time" />;
        break;

      case 'Number':
      case 'Currency':
      case 'Percent':
        inputElement = (
          <div className="relative">
            {fieldDef.type === 'Currency' && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
            )}
            <Input
              {...commonProps}
              type="number"
              step={fieldDef.scale ? `0.${'0'.repeat(fieldDef.scale - 1)}1` : '1'}
              className={cn(
                commonProps.className,
                fieldDef.type === 'Currency' && 'pl-8',
                fieldDef.type === 'Percent' && 'pr-8'
              )}
            />
            {fieldDef.type === 'Percent' && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
            )}
          </div>
        );
        break;

      case 'Email':
        inputElement = <Input {...commonProps} type="email" />;
        break;

      case 'Phone':
        inputElement = <Input {...commonProps} type="tel" />;
        break;

      case 'URL':
        inputElement = <Input {...commonProps} type="url" />;
        break;

      case 'EncryptedText':
        inputElement = <Input {...commonProps} type="password" />;
        break;

      case 'AutoNumber':
      case 'Formula':
      case 'RollupSummary':
        inputElement = (
          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
            {value || '(Auto-generated)'}
          </div>
        );
        break;

      case 'Address':
        const addressValue = value || {};
        inputElement = (
          <div className="space-y-2 border border-gray-300 rounded-lg p-3">
            <Input
              placeholder="Street"
              value={addressValue.street || ''}
              onChange={(e) =>
                handleFieldChange(fieldDef.apiName, { ...addressValue, street: e.target.value })
              }
              disabled={isReadOnly}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={addressValue.city || ''}
                onChange={(e) =>
                  handleFieldChange(fieldDef.apiName, { ...addressValue, city: e.target.value })
                }
                disabled={isReadOnly}
              />
              <Input
                placeholder="State/Province"
                value={addressValue.state || ''}
                onChange={(e) =>
                  handleFieldChange(fieldDef.apiName, { ...addressValue, state: e.target.value })
                }
                disabled={isReadOnly}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Postal Code"
                value={addressValue.postalCode || ''}
                onChange={(e) =>
                  handleFieldChange(fieldDef.apiName, {
                    ...addressValue,
                    postalCode: e.target.value,
                  })
                }
                disabled={isReadOnly}
              />
              <Input
                placeholder="Country"
                value={addressValue.country || ''}
                onChange={(e) =>
                  handleFieldChange(fieldDef.apiName, { ...addressValue, country: e.target.value })
                }
                disabled={isReadOnly}
              />
            </div>
          </div>
        );
        break;

      case 'Geolocation':
        const geoValue = value || {};
        inputElement = (
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Latitude"
              type="number"
              step="any"
              value={geoValue.latitude || ''}
              onChange={(e) =>
                handleFieldChange(fieldDef.apiName, { ...geoValue, latitude: e.target.value })
              }
              disabled={isReadOnly}
            />
            <Input
              placeholder="Longitude"
              type="number"
              step="any"
              value={geoValue.longitude || ''}
              onChange={(e) =>
                handleFieldChange(fieldDef.apiName, { ...geoValue, longitude: e.target.value })
              }
              disabled={isReadOnly}
            />
          </div>
        );
        break;

      case 'Lookup':
      case 'ExternalLookup':
        inputElement = (
          <div className="flex gap-2">
            <Input
              {...commonProps}
              placeholder={`Search ${fieldDef.relationshipName || 'records'}...`}
            />
            <Button type="button" variant="outline" size="sm" disabled={isReadOnly}>
              Search
            </Button>
          </div>
        );
        break;

      default:
        inputElement = <Input {...commonProps} type="text" />;
    }

    return (
      <div key={fieldDef.apiName} className="flex flex-col space-y-1">
        {fieldDef.type !== ('Checkbox' as FieldType) && (
          <Label htmlFor={fieldDef.apiName} className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-gray-400" />
            <span>
              {fieldDef.label}
              {fieldDef.required && <span className="text-red-500 ml-1">*</span>}
            </span>
          </Label>
        )}
        {inputElement}
        {error && <span className="text-xs text-red-500">{error}</span>}
        {!error && fieldDef.helpText && (
          <span className="text-xs text-gray-500">{fieldDef.helpText}</span>
        )}
      </div>
    );
  };

  const currentTab = layout.tabs.find((t) => t.id === activeTab);
  if (!currentTab) return null;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {/* Tabs */}
      {layout.tabs.length > 1 && (
        <div className="flex gap-2 border-b px-6 pt-4">
          {layout.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 font-medium transition-colors border-b-2',
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {currentTab.sections
          .sort((a, b) => a.order - b.order)
          .map((section) => {
            const isCollapsed = collapsedSections.has(section.id);
            const sectionFields = section.fields
              .map((f) => getFieldDef(f.apiName))
              .filter((f): f is FieldDef => f !== undefined);

            return (
              <div key={section.id} className="bg-white rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                >
                  <h3 className="text-lg font-semibold text-gray-900">{section.label}</h3>
                  {isCollapsed ? (
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-400" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="p-4 pt-0">
                    <div
                      className={cn(
                        'grid gap-4',
                        section.columns === 1 && 'grid-cols-1',
                        section.columns === 2 && 'grid-cols-1 md:grid-cols-2',
                        section.columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                      )}
                    >
                      {sectionFields.map((fieldDef) => renderField(fieldDef))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit">
          {layoutType === 'create' ? 'Create' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
