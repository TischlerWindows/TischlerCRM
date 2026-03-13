'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSchemaStore } from '@/lib/schema-store';
import { PageLayout, FieldDef, FieldType, ObjectDef, normalizeFieldType } from '@/lib/schema';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { evaluateVisibility, VisibilityContext } from '@/lib/field-visibility';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
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
  Layout,
  Check,
  User as UserIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Custom dropdown for PicklistText that allows selected value to wrap
function PicklistTextDropdown({
  options,
  value,
  onChange,
  disabled,
}: {
  options: string[];
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="w-1/2 min-w-0 relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          'w-full min-h-[2.5rem] px-3 py-2 text-left border border-gray-300 rounded-lg bg-white',
          'focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent focus:outline-none',
          'flex items-start justify-between gap-1',
          disabled && 'bg-gray-100 cursor-not-allowed opacity-70'
        )}
      >
        <span className="break-words whitespace-normal flex-1">
          {value || <span className="text-gray-500">-- Select --</span>}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400 mt-0.5" />
      </button>
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div
            className={cn(
              'px-3 py-2 cursor-pointer hover:bg-gray-100 text-gray-500',
              !value && 'bg-blue-50'
            )}
            onClick={() => { onChange(''); setOpen(false); }}
          >
            -- Select --
          </div>
          {options.map((option) => (
            <div
              key={option}
              className={cn(
                'px-3 py-2 cursor-pointer hover:bg-gray-100 break-words whitespace-normal',
                value === option && 'bg-blue-50 font-medium'
              )}
              onClick={() => { onChange(option); setOpen(false); }}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DynamicFormProps {
  objectApiName: string;
  layoutType: 'create' | 'edit';
  layoutId?: string;
  recordData?: Record<string, any>;
  onSubmit: (data: Record<string, any>, layoutId?: string) => void | Promise<void>;
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
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    // Initialize form data from recordData.
    // Records may store data with UNPREFIXED keys (e.g. "address") because
    // create handlers strip the object prefix (e.g. "Property__address" → "address").
    // The form renders fields via their prefixed apiName from the schema, so we
    // must ensure BOTH key variants exist in formData for lookups to succeed.
    const data = { ...recordData };
    const obj = schema?.objects.find((o) => o.apiName === objectApiName);
    if (obj) {
      // Mirror every field value so both prefixed and unprefixed keys are present
      for (const field of obj.fields) {
        const stripped = field.apiName.replace(/^[A-Za-z]+__/, '');
        if (stripped !== field.apiName) {
          if (data[stripped] !== undefined && data[field.apiName] === undefined) {
            data[field.apiName] = data[stripped];
          }
          if (data[field.apiName] !== undefined && data[stripped] === undefined) {
            data[stripped] = data[field.apiName];
          }
        }
      }

      // For create mode, initialise fields with their schema-defined
      // defaultValue so picklists start pre-selected (e.g. Status → "Not Contacted")
      // instead of blank "-- Select --" which would auto-fill to "N/A" on save.
      if (layoutType === 'create') {
        for (const field of obj.fields) {
          if (field.defaultValue !== undefined && data[field.apiName] === undefined) {
            data[field.apiName] = field.defaultValue;
            // Also mirror the stripped key
            const stripped = field.apiName.replace(/^[A-Za-z]+__/, '');
            if (stripped !== field.apiName && data[stripped] === undefined) {
              data[stripped] = field.defaultValue;
            }
          }
        }
      }

      // Construct composite values from individual sub-fields if the
      // composite key is missing (e.g. Contact Name from first/last).
      if (layoutType === 'edit') {
        for (const field of obj.fields) {
          if (field.type === 'CompositeText' && field.subFields && !data[field.apiName]) {
            const composite: Record<string, any> = {};
            for (const sf of field.subFields) {
              const val = data[sf.apiName] || data[sf.apiName.replace(/^[A-Za-z]+__/, '')];
              if (val) composite[sf.apiName] = val;
            }
            // Also try common unprefixed keys for Contact Name
            if (field.apiName === 'Contact__name') {
              if (!composite.Contact__name_firstName && data.firstName) composite.Contact__name_firstName = data.firstName;
              if (!composite.Contact__name_lastName && data.lastName) composite.Contact__name_lastName = data.lastName;
              if (!composite.Contact__name_salutation && data.salutation) composite.Contact__name_salutation = data.salutation;
            }
            if (Object.keys(composite).length > 0) {
              data[field.apiName] = composite;
            }
          }
        }
      }
    }
    return data;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const stepIndicatorRef = useRef<HTMLDivElement>(null);
  const [lookupQueries, setLookupQueries] = useState<Record<string, string>>({});
  const [activeLookupField, setActiveLookupField] = useState<string | null>(null);
  // Inline record creation from lookup fields
  const [inlineCreateTarget, setInlineCreateTarget] = useState<string | null>(null); // object apiName to create
  const [inlineCreateForField, setInlineCreateForField] = useState<string | null>(null); // which lookup field triggered it
  const [inlineCreateLayoutId, setInlineCreateLayoutId] = useState<string | null>(null); // selected layout for inline create
  const [lookupRecordsCache, setLookupRecordsCache] = useState<Record<string, any[]>>({});
  // Review mode: show read-only summary before final save (create mode only)
  const [showReview, setShowReview] = useState(false);

  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  // Current user — used to auto-populate AutoUser fields & user-based visibility
  const { user: authUser } = useAuth();
  const visibilityCtx: VisibilityContext = { currentUserId: authUser?.id };

  // If layoutId is provided, use it; otherwise check the default record type's
  // assigned layout, then fall back to finding by layoutType.
  // When multiple layouts exist, prefer one that actually has fields on it.
  const layout = (() => {
    if (!object?.pageLayouts?.length) return undefined;
    if (layoutId) return object.pageLayouts.find((l) => l.id === layoutId);

    // Check the default record type's assigned layout first
    const defaultRt = object.defaultRecordTypeId
      ? object.recordTypes?.find((r) => r.id === object.defaultRecordTypeId)
      : object.recordTypes?.[0];
    if (defaultRt?.pageLayoutId) {
      const rtLayout = object.pageLayouts.find((l) => l.id === defaultRt.pageLayoutId);
      if (rtLayout) return rtLayout;
    }

    const hasFields = (l: any) =>
      l.tabs?.some((t: any) => t.sections?.some((s: any) => (s.fields?.length || 0) > 0));

    const byType = object.pageLayouts.filter((l) => l.layoutType === layoutType);
    const withFields = byType.find(hasFields) || object.pageLayouts.find(hasFields);
    return withFields || byType[0] || object.pageLayouts[0];
  })();

  useEffect(() => {
    if (layout && layout.tabs.length > 0 && !activeTab && layout.tabs[0]) {
      setActiveTab(layout.tabs[0].id);
    }
  }, [layout, activeTab]);

  // Auto-populate AutoUser fields with the current user on every render
  // (covers both create and edit — the field is always read-only)
  useEffect(() => {
    if (!object || !authUser) return;
    const userName = authUser.name || authUser.email || 'Unknown User';
    let changed = false;
    const updated = { ...formData };
    for (const field of object.fields) {
      if (normalizeFieldType(field.type) === 'AutoUser' && !updated[field.apiName]) {
        updated[field.apiName] = userName;
        const stripped = field.apiName.replace(/^[A-Za-z]+__/, '');
        if (stripped !== field.apiName) updated[stripped] = userName;
        changed = true;
      }
    }
    if (changed) setFormData(updated);
  }, [object, authUser]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-load lookup records from API for all lookup fields in the layout
  useEffect(() => {
    if (!object || !layout) return;

    const targetApis = new Set<string>();
    let hasLookupUser = false;
    layout.tabs.forEach(tab => {
      tab.sections.forEach(section => {
        section.fields.forEach(field => {
          // Use embedded layout field data (self-contained) first, then fallback
          const rawType = field.type || object.fields.find(f => f.apiName === field.apiName)?.type;
          const fieldType = rawType ? normalizeFieldType(rawType) : undefined;
          if (fieldType === 'LookupUser') {
            hasLookupUser = true;
          } else if (fieldType === 'Lookup' || fieldType === 'ExternalLookup') {
            const target = (field as any).lookupObject
              || (field as any).relationship?.targetObject
              || (field as any).relatedObject
              || (() => {
                const fd = object.fields.find(f => f.apiName === field.apiName);
                if (fd?.lookupObject) return fd.lookupObject;
                if (fd?.relationship?.targetObject) return fd.relationship.targetObject;
                if ((fd as any)?.relatedObject) return (fd as any).relatedObject;
                // Infer from apiName pattern (e.g., "ContactId" -> "Contact")
                const apiName = field.apiName;
                if (apiName.endsWith('Id')) {
                  const possibleTarget = apiName.slice(0, -2);
                  const matchedObj = schema?.objects.find(o => o.apiName === possibleTarget);
                  if (matchedObj) return matchedObj.apiName;
                }
                return undefined;
              })();
            if (target) targetApis.add(target);
          }
        });
      });
    });

    if (targetApis.size === 0 && !hasLookupUser) return;

    (async () => {
      const newCache: Record<string, any[]> = {};

      // Fetch users for LookupUser fields
      if (hasLookupUser) {
        try {
          const users = await apiClient.get<any[]>('/admin/users');
          newCache['__users__'] = Array.isArray(users) ? users : [];
        } catch (err) {
          console.error('Failed to fetch users for LookupUser:', err);
          newCache['__users__'] = [];
        }
      }

      // Fetch records for regular Lookup fields
      if (targetApis.size > 0) {
        const entries = await Promise.all(
          Array.from(targetApis).map(async (api) => {
            const records = await recordsService.getRecords(api);
            return [api, records.map(r => ({ id: r.id, ...r.data }))] as [string, any[]];
          })
        );
        for (const [key, val] of entries) {
          newCache[key] = val;
        }
      }

      setLookupRecordsCache(prev => ({ ...prev, ...newCache }));
    })();
  }, [object, layout]);

  if (!object || !layout) {
    return (
      <div className="p-6 text-center text-gray-500">
        {!object
          ? 'Object not found'
          : `No ${layoutType === 'create' ? 'create' : 'edit'} layout configured for this object`}
      </div>
    );
  }

  const getFieldDef = (apiName: string, pageField?: import('@/lib/schema').PageField): FieldDef | undefined => {
    // Self-contained path: if the PageField carries embedded type & label
    // (populated by enrichLayoutFieldDefs on schema load), build the
    // FieldDef directly from it — no cross-referencing object.fields.
    if (pageField && pageField.type && pageField.label) {
      const { column, order, ...fieldProps } = pageField;
      return {
        id: fieldProps.id || apiName,
        ...fieldProps,
        apiName,
        type: normalizeFieldType(fieldProps.type!),
      } as FieldDef;
    }

    // Fallback: cross-reference object.fields (backward compatibility)
    const raw = object.fields.find((f) => f.apiName === apiName);
    if (!raw) return undefined;
    return { ...raw, type: normalizeFieldType(raw.type) };
  };

  const getLookupTargetApi = (fieldDef: FieldDef): string | undefined => {
    const relatedObject = (fieldDef as any).relatedObject as string | undefined;
    if (fieldDef.lookupObject) return fieldDef.lookupObject;
    if (fieldDef.relationship?.targetObject) return fieldDef.relationship.targetObject;
    if (relatedObject) return relatedObject;

    // Fallback: try to find from object.fields by apiName
    const objField = object.fields.find(f => f.apiName === fieldDef.apiName);
    if (objField?.lookupObject) return objField.lookupObject;

    // Last resort: infer from apiName pattern (e.g., "ContactId" -> "Contact")
    if (fieldDef.apiName.endsWith('Id')) {
      const possibleTarget = fieldDef.apiName.slice(0, -2);
      const matchedObj = schema?.objects.find(o => o.apiName === possibleTarget);
      if (matchedObj) return matchedObj.apiName;
    }

    return undefined;
  };

  const getLookupRecords = (targetApi: string) => {
    return lookupRecordsCache[targetApi] || [];
  };

  const getRecordLabel = (record: any) => {
    if (!record) return '';
    
    // Handle name object (Contact name with salutation, firstName, lastName)
    if (record.name && typeof record.name === 'object') {
      const nameObj = record.name;
      const nameParts = [
        nameObj.salutation || nameObj.Contact__name_salutation,
        nameObj.firstName || nameObj.Contact__name_firstName,
        nameObj.lastName || nameObj.Contact__name_lastName
      ].filter(Boolean);
      if (nameParts.length > 0) return nameParts.join(' ');
    }
    
    // Handle simple name string
    if (record.name && typeof record.name === 'string') return record.name;
    
    if (record.title) return record.title;
    
    // Account name - check multiple variations
    if (record.accountName) return record.accountName;
    if (record.Account__accountName) return record.Account__accountName;
    
    // Property number
    if (record.propertyNumber) return record.propertyNumber;
    if (record.Property__propertyNumber) return record.Property__propertyNumber;
    
    // Account number as fallback for accounts
    if (record.accountNumber) return record.accountNumber;
    
    // Contact names
    if (record.firstName || record.lastName) {
      return `${record.firstName || ''} ${record.lastName || ''}`.trim();
    }
    if (record.email) return record.email;
    
    // Lead/Deal/Project numbers
    if (record.leadNumber) return record.leadNumber;
    if (record.dealNumber) return record.dealNumber;
    if (record.projectNumber) return record.projectNumber;
    if (record.quoteNumber) return record.quoteNumber;
    if (record.serviceNumber) return record.serviceNumber;
    if (record.installationNumber) return record.installationNumber;
    if (record.productName) return record.productName;
    
    // Handle address - could be string or object
    if (record.address) {
      if (typeof record.address === 'object') {
        const addrParts = [record.address.street, record.address.city, record.address.state].filter(Boolean);
        if (addrParts.length > 0) return addrParts.join(', ');
      } else {
        return record.address;
      }
    }
    
    // Search for prefixed field names as last resort
    const keys = Object.keys(record);
    const firstNameKey = keys.find((key) => key.toLowerCase().endsWith('__firstname'));
    const lastNameKey = keys.find((key) => key.toLowerCase().endsWith('__lastname'));
    if (firstNameKey || lastNameKey) {
      return `${record[firstNameKey || ''] || ''} ${record[lastNameKey || ''] || ''}`.trim();
    }
    const nameKey = keys.find((key) => key.toLowerCase().endsWith('__name'));
    if (nameKey && record[nameKey]) return record[nameKey];
    const accountKey = keys.find((key) => key.toLowerCase().endsWith('__accountname'));
    if (accountKey && record[accountKey]) return record[accountKey];
    const propertyKey = keys.find((key) => key.toLowerCase().endsWith('__propertynumber'));
    if (propertyKey && record[propertyKey]) return record[propertyKey];
    const emailKey = keys.find((key) => key.toLowerCase().endsWith('__email'));
    if (emailKey && record[emailKey]) return record[emailKey];
    
    // Final fallback - use any "name" or "number" field
    const anyNameField = keys.find((key) => key.toLowerCase().includes('name') && record[key]);
    if (anyNameField && record[anyNameField]) return String(record[anyNameField]);
    const anyNumberField = keys.find((key) => key.toLowerCase().includes('number') && record[key]);
    if (anyNumberField && record[anyNumberField]) return String(record[anyNumberField]);
    
    return String(record.id || 'Record');
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
      MultiSelectPicklist: List,
      PicklistText: List,
      Address: MapPin,
      Geolocation: MapPin,
      Lookup: LinkIcon,
      ExternalLookup: LinkIcon,
      LookupUser: UserIcon,
      AutoNumber: Hash,
      AutoUser: Layout,
      Formula: Hash,
      RollupSummary: Hash,
      CompositeText: FileText,
    };
    return iconMap[type] || FileText;
  };

  const handleFieldChange = (fieldApiName: string, value: any) => {
    // Use functional updater to avoid stale-closure issues when multiple
    // field changes fire close together (e.g. PicklistText picklist + text).
    setFormData(prev => {
      const next = { ...prev, [fieldApiName]: value };
      // Keep prefixed ↔ unprefixed mirror keys in sync so the
      // normalization step in page handlers always has the latest value.
      const stripped = fieldApiName.replace(/^[A-Za-z]+__/, '');
      if (stripped !== fieldApiName) {
        next[stripped] = value;
      } else {
        // If the key is already unprefixed, check if a prefixed version exists
        const prefixedKey = Object.keys(prev).find(
          k => k !== fieldApiName && k.replace(/^[A-Za-z]+__/, '') === fieldApiName
        );
        if (prefixedKey) next[prefixedKey] = value;
      }
      return next;
    });
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
          const fieldDef = getFieldDef(field.apiName, field);
          if (!fieldDef) return;

          const value = formData[field.apiName];

          // Skip validation for auto-generated fields
          const autoGeneratedFieldNames = [
            'propertyNumber', 'contactNumber', 'accountNumber', 'leadNumber',
            'dealNumber', 'productCode', 'projectNumber', 'quoteNumber',
            'serviceNumber', 'installationNumber'
          ];
          const isAutoGenerated = 
            fieldDef.type === 'AutoNumber' || 
            fieldDef.type === 'AutoUser' || 
            fieldDef.type === 'Formula' || 
            fieldDef.type === 'RollupSummary' ||
            (fieldDef.type === 'URL' && !!fieldDef.staticUrl) ||
            autoGeneratedFieldNames.includes(fieldDef.apiName.replace(/^\w+__/, ''));

          // Required field validation (except for auto-generated fields)
          if (fieldDef.required && !isAutoGenerated) {
            if (value === undefined || value === null || value === '') {
              newErrors[field.apiName] = `${fieldDef.label} is required`;
            }
            // PicklistText: treat { picklist: '', text: '' } as empty
            if (fieldDef.type === 'PicklistText' && typeof value === 'object' && value !== null) {
              if (!value.picklist && !value.text) {
                newErrors[field.apiName] = `${fieldDef.label} is required`;
              }
            }
            // Address: treat all-empty address as empty
            if (fieldDef.type === 'Address' && typeof value === 'object' && value !== null) {
              const addrParts = [value.street, value.city, value.state, value.postalCode, value.country].filter(Boolean);
              if (addrParts.length === 0) {
                newErrors[field.apiName] = `${fieldDef.label} is required`;
              }
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
    const hasErrors = Object.keys(newErrors).length > 0;
    return !hasErrors;
  };

  // Validate only the fields in a specific section (used for wizard "Next" navigation)
  const validateSection = (section: typeof layout.tabs[0]['sections'][0]): boolean => {
    const newErrors: Record<string, string> = {};

    section.fields.forEach((field) => {
      const fieldDef = getFieldDef(field.apiName, field);
      if (!fieldDef) return;

      const value = formData[field.apiName];

      const autoGeneratedFieldNames = [
        'propertyNumber', 'contactNumber', 'accountNumber', 'leadNumber',
        'dealNumber', 'productCode', 'projectNumber', 'quoteNumber',
        'serviceNumber', 'installationNumber'
      ];
      const isAutoGenerated =
        fieldDef.type === 'AutoNumber' ||
        fieldDef.type === 'AutoUser' ||
        fieldDef.type === 'Formula' ||
        fieldDef.type === 'RollupSummary' ||
        autoGeneratedFieldNames.includes(fieldDef.apiName.replace(/^\w+__/, ''));

      if (fieldDef.required && !isAutoGenerated) {
        if (value === undefined || value === null || value === '') {
          newErrors[field.apiName] = `${fieldDef.label} is required`;
        }
      }

      if (value !== undefined && value !== null && value !== '') {
        switch (fieldDef.type) {
          case 'Email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
              newErrors[field.apiName] = 'Invalid email format';
            }
            break;
          case 'URL':
            try { new URL(value); } catch { newErrors[field.apiName] = 'Invalid URL format'; }
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
    });

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  // Compute wizard sections: flatten all visible sections across all tabs (create mode only)
  const wizardSections = (() => {
    if (layoutType !== 'create') return [];
    const allSections: { section: typeof layout.tabs[0]['sections'][0]; tabLabel: string }[] = [];
    layout.tabs.forEach((tab) => {
      tab.sections
        .sort((a, b) => a.order - b.order)
        .forEach((section) => {
          const isVisible = evaluateVisibility(section.visibleIf, formData, visibilityCtx);
          if (isVisible && section.showInTemplate !== false) {
            allSections.push({ section, tabLabel: tab.label });
          }
        });
    });
    return allSections;
  })();

  const isWizardMode = layoutType === 'create' && wizardSections.length > 1;

  // Auto-scroll wizard step indicator to keep the active step visible
  useEffect(() => {
    if (!isWizardMode || !stepIndicatorRef.current) return;
    const container = stepIndicatorRef.current;
    const activeStep = container.querySelector('[data-active-step="true"]') as HTMLElement;
    if (activeStep) {
      const containerRect = container.getBoundingClientRect();
      const stepRect = activeStep.getBoundingClientRect();
      const scrollLeft = activeStep.offsetLeft - containerRect.width / 2 + stepRect.width / 2;
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [currentStep, isWizardMode]);

  const handleNextStep = () => {
    if (currentStep < wizardSections.length - 1) {
      const currentSection = wizardSections[currentStep].section;
      if (validateSection(currentSection)) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const submitForm = async () => {
    if (validateForm()) {
      // Ensure all required fields on the object have a non-empty default,
      // even if they are not on the current page layout. This prevents the API
      // from rejecting records due to fields the user was never asked to fill in.
      const completeData: Record<string, any> = { ...formData };
      if (object) {
        for (const field of object.fields) {
          if (field.required && !completeData[field.apiName]) {
            // Prefer the field's own defaultValue over generic fallbacks
            if (field.defaultValue !== undefined) {
              completeData[field.apiName] = field.defaultValue;
            } else {
              // Use type-aware defaults that pass all validation rules
              switch (field.type) {
                case 'Number':
                case 'Currency':
                case 'Percent':
                  completeData[field.apiName] = 0;
                  break;
                case 'Checkbox':
                  completeData[field.apiName] = false;
                  break;
                case 'PicklistText':
                  completeData[field.apiName] = { picklist: 'N/A', text: '' };
                  break;
                case 'Address':
                  completeData[field.apiName] = { street: '', city: '', state: '', postalCode: '', country: '' };
                  break;
                default:
                  completeData[field.apiName] = 'N/A';
                  break;
              }
            }
          }
        }
      }
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        await onSubmit(completeData, layoutId);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Failed to save record';
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  /** Validate the form and switch to review mode (create only). */
  const enterReview = () => {
    // For wizard mode, validate the current (last) section first
    if (isWizardMode) {
      const currentSection = wizardSections[currentStep].section;
      if (!validateSection(currentSection)) return;
    }
    // Then do a full-form validation
    if (validateForm()) {
      setShowReview(true);
    }
  };

  /** Format a single field value for display in the review page */
  const formatReviewValue = (fieldDef: FieldDef, val: any): string => {
    if (fieldDef.type === 'URL' && fieldDef.staticUrl) return fieldDef.staticUrl;
    if (val === undefined || val === null || val === '') return '—';
    switch (fieldDef.type) {
      case 'Checkbox':
        return val === true || val === 'true' ? 'Yes' : 'No';
      case 'Currency':
        return typeof val === 'number' ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : String(val);
      case 'Percent':
        return `${val}%`;
      case 'Date':
        try { return new Date(val).toLocaleDateString(); } catch { return String(val); }
      case 'DateTime':
        try { return new Date(val).toLocaleString(); } catch { return String(val); }
      case 'MultiPicklist':
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      case 'Lookup':
      case 'ExternalLookup':
      case 'LookupUser': {
        // Try to display the lookup label from the search input state
        const lookupLabel = lookupQueries[fieldDef.apiName];
        return lookupLabel || String(val);
      }
      case 'CompositeText': {
        if (typeof val === 'object' && val !== null) {
          const parts = Object.values(val).filter(Boolean);
          return parts.join(' ') || '—';
        }
        return String(val);
      }
      case 'Address': {
        if (typeof val === 'object' && val !== null) {
          const { street, city, state, zipCode, country } = val as any;
          return [street, city, state, zipCode, country].filter(Boolean).join(', ') || '—';
        }
        return String(val);
      }
      case 'PicklistText': {
        if (typeof val === 'object' && val !== null) {
          const parts = [val.picklist, val.text].filter(Boolean);
          return parts.length > 0 ? parts.join(' — ') : '—';
        }
        return String(val);
      }
      default:
        return String(val);
    }
  };

  // Pressing Enter in an input moves to the next field instead of submitting
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      // Allow Enter in textareas (for multi-line input)
      if (tagName === 'textarea') return;
      // Only intercept for inputs, selects
      if (tagName === 'input' || tagName === 'select') {
        e.preventDefault();
        const form = e.currentTarget;
        const focusable = Array.from(
          form.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
          )
        );
        const currentIndex = focusable.indexOf(target);
        const nextField = focusable[currentIndex + 1];
        if (currentIndex >= 0 && nextField) {
          nextField.focus();
        }
      }
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
    // Check if field should be visible based on visibility rules
    const isVisible = evaluateVisibility(fieldDef.visibleIf, formData, visibilityCtx);
    if (!isVisible) {
      return null; // Field is not visible
    }

    // Helper: filter picklist values by picklistDependencies
    const filterPicklistValues = (values: string[]) => {
      const rules = fieldDef.picklistDependencies;
      if (!rules || rules.length === 0) return values;

      // Collect all values that are governed by at least one rule
      const governedValues = new Set<string>();
      rules.forEach(r => r.values.forEach(v => governedValues.add(v)));

      return values.filter((val) => {
        // If no rule mentions this value, always show it
        if (!governedValues.has(val)) return true;
        // Show if ANY rule containing this value has all its conditions met
        return rules.some(
          (r) => r.values.includes(val) && evaluateVisibility(r.conditions, formData, visibilityCtx)
        );
      });
    };

    const value = formData[fieldDef.apiName];
    const error = errors[fieldDef.apiName];
    const Icon = getFieldIcon(fieldDef.type);
    const autoGeneratedFieldNames = [
      'propertyNumber', 'contactNumber', 'accountNumber', 'leadNumber',
      'dealNumber', 'productCode', 'projectNumber', 'quoteNumber',
      'serviceNumber', 'installationNumber'
    ];
    const isFieldAutoGenerated = autoGeneratedFieldNames.includes(fieldDef.apiName.replace(/^\w+__/, ''));
    const isReadOnly = fieldDef.readOnly || fieldDef.type === 'AutoNumber' || fieldDef.type === 'Formula' || fieldDef.type === 'RollupSummary' || isFieldAutoGenerated;

    const commonProps = {
      id: fieldDef.apiName,
      value: value || '',
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        handleFieldChange(fieldDef.apiName, e.target.value),
      disabled: isReadOnly,
      placeholder: isFieldAutoGenerated ? 'Auto-generated' : undefined,
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
              className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
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
        inputElement = <Textarea {...commonProps} rows={8} />;
        break;

      case 'Picklist':
        const picklistOptions = filterPicklistValues(fieldDef.picklistValues || []);
        inputElement = (
          <select {...commonProps} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent">
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
      case 'MultiSelectPicklist':
        const multiPicklistOptions = filterPicklistValues(fieldDef.picklistValues || []);
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
                  className="w-4 h-4 text-brand-navy border-gray-300 rounded focus:ring-brand-navy/40"
                />
                <label htmlFor={`${fieldDef.apiName}-${option}`} className="text-sm">
                  {option}
                </label>
              </div>
            ))}
          </div>
        );
        break;

      case 'PicklistText':
        const ptOptions = filterPicklistValues(fieldDef.picklistValues || []);
        const ptValue = (typeof value === 'object' && value !== null) ? value : { picklist: '', text: '' };
        const ptPosition = (fieldDef as any).picklistPosition || 'left';
        const picklistSelect = (
          <PicklistTextDropdown
            options={ptOptions}
            value={ptValue.picklist || ''}
            onChange={(val) =>
              handleFieldChange(fieldDef.apiName, { ...ptValue, picklist: val })
            }
            disabled={isReadOnly}
          />
        );
        const textInput = (
          <Input
            value={ptValue.text || ''}
            onChange={(e) =>
              handleFieldChange(fieldDef.apiName, { ...ptValue, text: e.target.value })
            }
            disabled={isReadOnly}
            placeholder="Enter text"
            className="w-1/2 min-w-0"
          />
        );
        inputElement = (
          <div className="flex gap-2 items-start">
            {ptPosition === 'left' ? <>{picklistSelect}{textInput}</> : <>{textInput}{picklistSelect}</>}
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
        if (fieldDef.staticUrl) {
          inputElement = (
            <a
              href={fieldDef.staticUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-2 text-brand-navy hover:text-brand-dark underline text-sm"
            >
              {fieldDef.staticUrl}
            </a>
          );
        } else {
          inputElement = <Input {...commonProps} type="url" />;
        }
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

      case 'AutoUser':
        inputElement = (
          <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">
            {value || '(Current user)'}
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
        const targetApi = getLookupTargetApi(fieldDef);
        const records = targetApi ? getLookupRecords(targetApi) : [];
        const recordsArray = Array.isArray(records) ? records : [];
        // Compare as strings to handle type mismatches (e.g., number vs string IDs)
        const selectedRecord = value ? recordsArray.find((r) => String(r.id) === String(value)) : null;
        const selectedLabel = selectedRecord ? getRecordLabel(selectedRecord) : '';
        const lookupQuery = lookupQueries[fieldDef.apiName] ?? '';
        const isLookupActive = activeLookupField === fieldDef.apiName;
        
        // Determine what to display:
        // - If lookup is active (user is typing), show the query
        // - If we have a selected label (found the record), show that
        // - Otherwise show empty (don't show raw ID to users)
        const displayValue = isLookupActive ? lookupQuery : selectedLabel;

        const filteredRecords = recordsArray.filter((record) => {
          const label = getRecordLabel(record);
          const labelStr = typeof label === 'string' ? label : String(label || '');
          if (!labelStr) return true; // Include records with no label in results
          const query = lookupQuery.toLowerCase();
          if (labelStr.toLowerCase().includes(query)) return true;
          return Object.values(record).some((val) =>
            typeof val === 'string' && val.toLowerCase().includes(query)
          );
        });

        inputElement = (
          <div className="relative">
            <Input
              {...commonProps}
              value={displayValue}
              placeholder={`Search ${fieldDef.relationshipName || targetApi || 'records'}...`}
              onChange={(e) => {
                setLookupQueries((prev) => ({ ...prev, [fieldDef.apiName]: e.target.value }));
                setActiveLookupField(fieldDef.apiName);
              }}
              onFocus={() => setActiveLookupField(fieldDef.apiName)}
              onBlur={() => {
                setTimeout(() => {
                  setActiveLookupField((current) => (current === fieldDef.apiName ? null : current));
                }, 150);
              }}
            />
            {isLookupActive && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredRecords.length > 0 ? (
                  filteredRecords.slice(0, 20).map((record) => {
                    const label = getRecordLabel(record);
                    const displayLabel = typeof label === 'string' ? label : String(label || 'Record');
                    return (
                      <button
                        key={record.id}
                        type="button"
                        onClick={() => {
                          handleFieldChange(fieldDef.apiName, record.id);
                          setLookupQueries((prev) => ({ ...prev, [fieldDef.apiName]: displayLabel }));
                          setActiveLookupField(null);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <div className="font-medium text-gray-900 truncate">{displayLabel}</div>
                        <div className="text-xs text-gray-500">{record.id}</div>
                      </button>
                    );
                  })
                ) : lookupQuery ? (
                  <div className="px-3 py-2 text-xs text-gray-500">No matches found.</div>
                ) : null}
                {targetApi && (() => {
                  const targetObj = schema?.objects.find((o) => o.apiName === targetApi);
                  const createLabel = targetObj?.label || targetApi;
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        setInlineCreateTarget(targetApi);
                        setInlineCreateForField(fieldDef.apiName);
                        setActiveLookupField(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50 border-t border-gray-100 rounded-b-lg"
                    >
                      + Create new {createLabel}
                    </button>
                  );
                })()}
              </div>
            )}
          </div>
        );
        break;

      case 'LookupUser':
        const userRecords = lookupRecordsCache['__users__'] || [];
        const selectedUser = value ? userRecords.find((u) => String(u.id) === String(value)) : null;
        const selectedUserLabel = selectedUser ? (selectedUser.name || selectedUser.email || '') : '';
        const userLookupQuery = lookupQueries[fieldDef.apiName] ?? '';
        const isUserLookupActive = activeLookupField === fieldDef.apiName;
        const userDisplayValue = isUserLookupActive ? userLookupQuery : selectedUserLabel;

        const filteredUsers = userRecords.filter((user) => {
          const query = userLookupQuery.toLowerCase();
          if (!query) return true;
          const name = (user.name || '').toLowerCase();
          const email = (user.email || '').toLowerCase();
          const title = (user.title || '').toLowerCase();
          return name.includes(query) || email.includes(query) || title.includes(query);
        });

        inputElement = (
          <div className="relative">
            <Input
              {...commonProps}
              value={userDisplayValue}
              placeholder="Search users..."
              onChange={(e) => {
                setLookupQueries((prev) => ({ ...prev, [fieldDef.apiName]: e.target.value }));
                setActiveLookupField(fieldDef.apiName);
              }}
              onFocus={() => setActiveLookupField(fieldDef.apiName)}
              onBlur={() => {
                setTimeout(() => {
                  setActiveLookupField((current) => (current === fieldDef.apiName ? null : current));
                }, 150);
              }}
            />
            {isUserLookupActive && (
              <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                {filteredUsers.length > 0 ? (
                  filteredUsers.slice(0, 20).map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        handleFieldChange(fieldDef.apiName, user.id);
                        setLookupQueries((prev) => ({ ...prev, [fieldDef.apiName]: user.name || user.email }));
                        setActiveLookupField(null);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900 truncate">{user.name || user.email}</div>
                      <div className="text-xs text-gray-500">{user.email}{user.title ? ` · ${user.title}` : ''}</div>
                    </button>
                  ))
                ) : userLookupQuery ? (
                  <div className="px-3 py-2 text-xs text-gray-500">No users found.</div>
                ) : null}
              </div>
            )}
          </div>
        );
        break;

      case 'CompositeText':
        const compositeValue = value || {};
        inputElement = (
          <div className="space-y-3 border border-gray-300 rounded-lg p-3">
            {fieldDef.subFields && fieldDef.subFields.map((subField) => {
              if (subField.type === 'Picklist') {
                return (
                  <div key={subField.apiName} className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-gray-700">{subField.label}</label>
                    <select
                      value={compositeValue[subField.apiName] || ''}
                      onChange={(e) =>
                        handleFieldChange(fieldDef.apiName, {
                          ...compositeValue,
                          [subField.apiName]: e.target.value
                        })
                      }
                      disabled={isReadOnly}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
                    >
                      <option value="">-- Select --</option>
                      {fieldDef.apiName === 'Contact__name' && subField.apiName === 'Contact__name_salutation' && (
                        <>
                          <option value="Mr.">Mr.</option>
                          <option value="Mrs.">Mrs.</option>
                          <option value="Ms.">Ms.</option>
                          <option value="Dr.">Dr.</option>
                          <option value="Prof.">Prof.</option>
                        </>
                      )}
                    </select>
                  </div>
                );
              } else {
                return (
                  <div key={subField.apiName} className="flex flex-col space-y-1">
                    <label className="text-sm font-medium text-gray-700">{subField.label}</label>
                    <Input
                      type="text"
                      value={compositeValue[subField.apiName] || ''}
                      onChange={(e) =>
                        handleFieldChange(fieldDef.apiName, {
                          ...compositeValue,
                          [subField.apiName]: e.target.value
                        })
                      }
                      disabled={isReadOnly}
                      placeholder={subField.label}
                    />
                  </div>
                );
              }
            })}
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

  // Helper to render a single section's content (shared between wizard and normal modes)
  const renderSectionContent = (section: typeof currentTab.sections[0]) => {
    const columnArrays: FieldDef[][] = [];
    for (let i = 0; i < section.columns; i++) {
      columnArrays[i] = section.fields
        .filter((f) => f.column === i)
        .sort((a, b) => a.order - b.order)
        .map((f) => getFieldDef(f.apiName, f))
        .filter((f): f is FieldDef => f !== undefined);
    }

    return (
      <div className="p-4 pt-0">
        <div
          className={cn(
            'grid gap-4',
            section.columns === 1 && 'grid-cols-1',
            section.columns === 2 && 'grid-cols-1 md:grid-cols-2',
            section.columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
          )}
        >
          {columnArrays.map((columnFields, colIndex) => (
            <div key={`col-${colIndex}`} className="flex flex-col gap-4">
              {columnFields.map((fieldDef) => renderField(fieldDef))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
    <form onKeyDown={handleFormKeyDown} className="flex flex-col h-full">
      {/* Wizard Step Indicator (create mode with multiple sections) */}
      {isWizardMode && (
        <div className="px-6 pt-5 pb-3 bg-white border-b">
          <div
            ref={stepIndicatorRef}
            className="flex items-center overflow-x-auto scrollbar-hide"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {wizardSections.map((ws, index) => {
              const isBeforeCurrent = showReview ? true : index < currentStep;
              const isCurrent = !showReview && index === currentStep;
              const isAfterCurrent = !showReview && index > currentStep;
              return (
                <React.Fragment key={ws.section.id}>
                  {/* Step circle + label */}
                  <div
                    className="flex flex-col items-center flex-shrink-0"
                    style={{ width: 100 }}
                    data-active-step={isCurrent ? 'true' : undefined}
                  >
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                        isBeforeCurrent && 'bg-green-500 text-white',
                        isCurrent && 'bg-brand-navy text-white',
                        isAfterCurrent && 'bg-gray-200 text-gray-500'
                      )}
                    >
                      {isBeforeCurrent ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <span
                      className={cn(
                        'text-xs mt-1.5 text-center w-full truncate px-1',
                        isCurrent ? 'text-brand-navy font-semibold' : 'text-gray-500'
                      )}
                      title={ws.section.label}
                    >
                      {ws.section.label}
                    </span>
                  </div>
                  {/* Connector line */}
                  <div
                    className={cn(
                      'h-0.5 flex-shrink-0 mt-[-16px]',
                      isBeforeCurrent ? 'bg-green-500' : 'bg-gray-200'
                    )}
                    style={{ width: 24 }}
                  />
                </React.Fragment>
              );
            })}
            {/* Review step at the end */}
            <div
              className="flex flex-col items-center flex-shrink-0"
              style={{ width: 100 }}
              data-active-step={showReview ? 'true' : undefined}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                  showReview ? 'bg-brand-navy text-white' : 'bg-gray-200 text-gray-500'
                )}
              >
                {wizardSections.length + 1}
              </div>
              <span
                className={cn(
                  'text-xs mt-1.5 text-center w-full truncate px-1',
                  showReview ? 'text-brand-navy font-semibold' : 'text-gray-500'
                )}
              >
                Review
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tabs - Only show if there are multiple tabs AND not in wizard mode */}
      {!isWizardMode && layout.tabs.length > 1 && (
        <div className="flex gap-2 border-b px-6 pt-4 bg-white">
          {layout.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-brand-navy text-brand-navy'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Sections — wizard mode (one section at a time) */}
      {!showReview && isWizardMode && wizardSections[currentStep] && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 bg-gray-100 rounded-t-lg">
              <h3 className="text-lg font-semibold text-gray-900">
                {wizardSections[currentStep].section.label}
              </h3>
            </div>
            {renderSectionContent(wizardSections[currentStep].section)}
          </div>
        </div>
      )}

      {/* Sections — normal mode (all sections shown) */}
      {!showReview && !isWizardMode && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentTab.sections
            .sort((a, b) => a.order - b.order)
            .map((section) => {
              const isSectionVisible = evaluateVisibility(section.visibleIf, formData, visibilityCtx);
              if (!isSectionVisible) return null;
              if (section.showInTemplate === false) return null;

              const isCollapsed = collapsedSections.has(section.id);

              return (
                <div key={section.id} className="bg-white rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-150 transition-colors rounded-t-lg"
                  >
                    <h3 className="text-lg font-semibold text-gray-900">{section.label}</h3>
                    {isCollapsed ? (
                      <ChevronRight className="h-5 w-5 text-gray-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-600" />
                    )}
                  </button>

                  {!isCollapsed && renderSectionContent(section)}
                </div>
              );
            })}
        </div>
      )}

      {/* Review mode — read-only summary of all sections before final save */}
      {showReview && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Review header */}
          <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-blue-900">Review Your Record</h3>
              <p className="text-sm text-blue-700">Please review the information below. Click <strong>Edit</strong> to make changes or <strong>Save</strong> to confirm.</p>
            </div>
          </div>
          {/* Render all sections read-only */}
          {layout.tabs.map((tab) =>
            tab.sections
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const isSectionVisible = evaluateVisibility(section.visibleIf, formData, visibilityCtx);
                if (!isSectionVisible) return null;
                if (section.showInTemplate === false) return null;

                const columnArrays: FieldDef[][] = [];
                for (let ci = 0; ci < section.columns; ci++) {
                  columnArrays[ci] = section.fields
                    .filter((f) => f.column === ci)
                    .sort((a, b) => a.order - b.order)
                    .map((f) => getFieldDef(f.apiName, f))
                    .filter((f): f is FieldDef => f !== undefined);
                }

                return (
                  <div key={section.id} className="bg-white rounded-lg border border-gray-200">
                    <div className="p-4 bg-gray-100 rounded-t-lg">
                      <h3 className="text-lg font-semibold text-gray-900">{section.label}</h3>
                    </div>
                    <div className="p-4">
                      <div
                        className={cn(
                          'grid gap-x-8 gap-y-3',
                          section.columns === 1 && 'grid-cols-1',
                          section.columns === 2 && 'grid-cols-1 md:grid-cols-2',
                          section.columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                        )}
                      >
                        {columnArrays.map((columnFields, colIndex) => (
                          <div key={`review-col-${colIndex}`} className="flex flex-col gap-3">
                            {columnFields.map((fieldDef) => {
                              const isVisible = evaluateVisibility(fieldDef.visibleIf, formData, visibilityCtx);
                              if (!isVisible) return null;
                              const val = formData[fieldDef.apiName];
                              const display = formatReviewValue(fieldDef, val);
                              return (
                                <div key={fieldDef.apiName} className="py-1">
                                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{fieldDef.label}</dt>
                                  <dd className="mt-0.5 text-sm text-gray-900">{display}</dd>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}

      {/* Error banner */}
      {submitError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {submitError}
        </div>
      )}

      {/* Actions — wizard mode */}
      {isWizardMode && !showReview && (
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-500">
            Step {currentStep + 1} of {wizardSections.length}
          </div>
          <div className="flex gap-3">
            {onCancel && currentStep === 0 && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                Cancel
              </Button>
            )}
            {currentStep > 0 && (
              <Button type="button" variant="outline" onClick={handlePreviousStep} disabled={isSubmitting}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
            )}
            {currentStep < wizardSections.length - 1 ? (
              <Button type="button" onClick={handleNextStep}>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={enterReview}>
                Review
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Actions — normal mode */}
      {!isWizardMode && !showReview && (
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
          )}
          {layoutType === 'create' ? (
            <Button type="button" onClick={enterReview}>
              Review
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button type="button" onClick={submitForm} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      )}

      {/* Actions — review mode */}
      {showReview && (
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-500 font-medium">
            Review Complete
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setShowReview(false)}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Edit
            </Button>
            <Button type="button" onClick={submitForm} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </form>

      {/* Inline record creation — layout selector step */}
      {inlineCreateTarget && !inlineCreateLayoutId && (() => {
        const targetObj = schema?.objects.find((o) => o.apiName === inlineCreateTarget);
        const targetLayouts = targetObj?.pageLayouts || [];
        // If only one layout (or none), skip selector and go straight to form
        if (targetLayouts.length <= 1) {
          const autoLayoutId = targetLayouts[0]?.id || null;
          // Use a microtask to avoid setting state during render
          queueMicrotask(() => setInlineCreateLayoutId(autoLayoutId));
          return null;
        }
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) { setInlineCreateTarget(null); setInlineCreateForField(null); } }}>
            <DialogContent className="max-w-md p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle>Select a Page Layout</DialogTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Choose which form layout to use for creating a new {targetObj?.label || inlineCreateTarget}
                </p>
              </DialogHeader>
              <div className="p-6 space-y-3">
                {targetLayouts.map((tl) => (
                  <button
                    key={tl.id}
                    type="button"
                    onClick={() => setInlineCreateLayoutId(tl.id)}
                    className="w-full flex items-start gap-3 p-4 border border-gray-200 rounded-lg hover:border-indigo-500 hover:bg-indigo-50 transition-colors text-left"
                  >
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Layout className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{tl.name}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {tl.tabs?.length || 0} {(tl.tabs?.length || 0) === 1 ? 'tab' : 'tabs'} •{' '}
                        {tl.tabs?.reduce((acc: number, tab: any) => acc + (tab.sections?.length || 0), 0) || 0} sections
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="p-6 border-t border-gray-200 flex justify-end">
                <Button type="button" variant="outline" onClick={() => { setInlineCreateTarget(null); setInlineCreateForField(null); }}>
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Inline record creation — form step */}
      {inlineCreateTarget && inlineCreateLayoutId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setInlineCreateTarget(null); setInlineCreateForField(null); setInlineCreateLayoutId(null); } }}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>
                Create New {schema?.objects.find((o) => o.apiName === inlineCreateTarget)?.label || inlineCreateTarget}
              </DialogTitle>
            </DialogHeader>
            <div className="overflow-hidden" style={{ height: 'calc(90vh - 80px)' }}>
              <DynamicForm
                objectApiName={inlineCreateTarget!}
                layoutType="create"
                layoutId={inlineCreateLayoutId}
                onSubmit={async (data, inlineLayoutId) => {
                  try {
                    // Ensure the custom object exists in the database before creating records
                    const targetObj = schema?.objects.find((o) => o.apiName === inlineCreateTarget);
                    if (targetObj) {
                      try {
                        await apiClient.createObject({
                          apiName: targetObj.apiName,
                          label: targetObj.label,
                          pluralLabel: targetObj.pluralLabel || targetObj.label,
                        });
                      } catch {
                        // Object may already exist — that's fine
                      }

                      // Also ensure fields exist in the DB for this object
                      try {
                        for (const field of targetObj.fields) {
                          const isSystemField = ['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(field.apiName);
                          if (!isSystemField && field.type !== 'Lookup' && field.type !== 'ExternalLookup') {
                            await apiClient.createField(targetObj.apiName, {
                              apiName: field.apiName,
                              label: field.label,
                              type: field.type || 'Text',
                              required: field.required || false,
                              unique: field.unique || false,
                              readOnly: field.readOnly || false,
                              picklistValues: field.picklistValues,
                              defaultValue: field.defaultValue,
                            }).catch(() => {}); // field may already exist
                          }
                        }
                      } catch {
                        // Non-fatal — fields best effort sync
                      }
                    }

                    const created = await recordsService.createRecord(inlineCreateTarget!, {
                      data,
                      pageLayoutId: inlineLayoutId || inlineCreateLayoutId,
                    });
                    if (created && inlineCreateForField) {
                      handleFieldChange(inlineCreateForField, created.id);
                      const flat = recordsService.flattenRecord(created);
                      const label = getRecordLabel(flat);
                      setLookupQueries((prev) => ({ ...prev, [inlineCreateForField!]: typeof label === 'string' ? label : String(label) }));
                    }
                  } catch (err) {
                    console.error('Inline create failed:', err);
                    throw err;
                  }
                  setInlineCreateTarget(null);
                  setInlineCreateForField(null);
                  setInlineCreateLayoutId(null);
                }}
                onCancel={() => { setInlineCreateTarget(null); setInlineCreateForField(null); setInlineCreateLayoutId(null); }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
