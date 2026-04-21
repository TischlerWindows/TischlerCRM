'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSchemaStore } from '@/lib/schema-store';
import {
  PageLayout,
  PageField,
  FieldDef,
  FieldType,
  ObjectDef,
  LayoutPanel,
  LayoutSection,
  normalizeFieldType,
} from '@/lib/schema';
import { isLegacyLayout, migrateLegacyLayout } from '@/lib/layout-migration';
import { resolveLayoutForUser } from '@/lib/layout-resolver';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { evaluateVisibility, VisibilityContext } from '@/lib/field-visibility';
import {
  getFormattingEffectsForPanel,
  getFormattingEffectsForRegion,
} from '@/lib/layout-formatting';
import {
  resolveTabCanvasItems,
  gridItemStyle,
  TAB_GRID_COLUMNS,
} from '@/lib/tab-canvas-grid';
import { LayoutWidgetsInline } from '@/components/layout-widgets-inline';
import { useEnabledWidgetIds } from '@/lib/use-widget-settings';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { PendingWidgetProvider, usePendingWidgetManager } from './pending-widget-context';
import { getWidgetSupportsCreate } from '@/lib/widgets/registry-loader';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Check,
  Layout,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { validateFields } from './form-validation';
import { FieldInput, getFieldIcon } from './field-input';
import { getRecordLabel, getLookupTargetApi } from './lookup-search';
import { MissingRequiredModal } from './missing-required-modal';

// ── DynamicFormProps ─────────────────────────────────────────────────

export interface DynamicFormProps {
  objectApiName: string;
  layoutType: 'create' | 'edit';
  layoutId?: string;
  /** If provided, this layout is rendered directly instead of looking up one via layoutId. */
  layoutOverride?: PageLayout;
  recordData?: Record<string, any>;
  /**
   * Called when the form is submitted. For create forms, return the new
   * record's ID so pending widget data (e.g. team members) can be saved
   * after the parent record is created. If not returned, pending widget
   * data is skipped.
   */
  onSubmit: (data: Record<string, any>, layoutId?: string) => string | void | Promise<string | void>;
  onCancel?: () => void;
  /**
   * Called after the record is created AND all pending widget data has
   * been saved. Use this for navigation (router.push) instead of
   * navigating inside onSubmit, so pending data is saved first.
   * Only relevant for create forms that use widgets.
   */
  onCreated?: (recordId: string) => void;
}

/** Returns true if an element should be hidden based on record lifecycle state.
 *  Legacy `hideOnExisting` is treated as both `hideOnView` and `hideOnEdit`. */
function isHiddenByLifecycle(
  element: { hideOnNew?: boolean; hideOnView?: boolean; hideOnEdit?: boolean; hideOnExisting?: boolean },
  mode: 'create' | 'edit',
): boolean {
  if (mode === 'create') return !!element.hideOnNew;
  // mode === 'edit'
  return !!element.hideOnEdit || !!element.hideOnExisting;
}

// ── DynamicForm ─────────────────────────────────────────────────────

export default function DynamicForm({
  objectApiName,
  layoutType,
  layoutId,
  layoutOverride,
  recordData = {},
  onSubmit,
  onCancel,
  onCreated,
}: DynamicFormProps) {
  const { schema } = useSchemaStore();
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    // Initialize form data from recordData.
    // Records may store data with UNPREFIXED keys (e.g. "address") because
    // create handlers strip the object prefix (e.g. "Property__address" -> "address").
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
      // defaultValue so picklists start pre-selected
      if (layoutType === 'create') {
        for (const field of obj.fields) {
          if (field.defaultValue !== undefined && data[field.apiName] === undefined) {
            data[field.apiName] = field.defaultValue;
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
              if (!composite.Contact__name_firstName && data.firstName)
                composite.Contact__name_firstName = data.firstName;
              if (!composite.Contact__name_lastName && data.lastName)
                composite.Contact__name_lastName = data.lastName;
              if (!composite.Contact__name_salutation && data.salutation)
                composite.Contact__name_salutation = data.salutation;
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
  const [missingRequiredLabels, setMissingRequiredLabels] = useState<string[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('');
  const [currentStep, setCurrentStep] = useState(0);
  const stepIndicatorRef = useRef<HTMLDivElement>(null);
  const [lookupQueries, setLookupQueries] = useState<Record<string, string>>({});
  const [activeLookupField, setActiveLookupField] = useState<string | null>(null);
  // Inline record creation from lookup fields
  const [inlineCreateTarget, setInlineCreateTarget] = useState<string | null>(null);
  const [inlineCreateForField, setInlineCreateForField] = useState<string | null>(null);
  const [inlineCreateLayoutId, setInlineCreateLayoutId] = useState<string | null>(null);
  const [lookupRecordsCache, setLookupRecordsCache] = useState<Record<string, any[]>>({});
  // Review mode: show read-only summary before final save (create mode only)
  const [showReview, setShowReview] = useState(false);

  // Pending widget manager — manages widget registrations for create mode
  const isCreateMode = layoutType === 'create';
  const pendingCtx = usePendingWidgetManager(isCreateMode, objectApiName);

  const object = schema?.objects.find((o) => o.apiName === objectApiName);
  const { ids: enabledWidgetIds } = useEnabledWidgetIds();

  // Object definition for widgets (simplified shape expected by LayoutWidgetsInline)
  const widgetObjectDef = useMemo(() => {
    if (!object) return undefined;
    return {
      apiName: object.apiName,
      label: object.label,
      fields: object.fields.map((f) => ({
        apiName: f.apiName,
        label: f.label,
        type: f.type,
      })),
    };
  }, [object]);

  // Current user
  const { user: authUser } = useAuth();
  const visibilityCtx: VisibilityContext = { currentUserId: authUser?.id };

  // ── Layout resolution ─────────────────────────────────────────
  const layout = useMemo(() => {
    // Caller-supplied layout takes precedence (used by the page-editor preview
    // to render an unsaved, in-memory draft).
    if (layoutOverride) {
      return isLegacyLayout(layoutOverride)
        ? migrateLegacyLayout(layoutOverride as any)
        : layoutOverride;
    }

    if (!object?.pageLayouts?.length) return undefined;

    let resolved: PageLayout | undefined;

    // Explicit layoutId wins — but only if that layout is still active.
    // If inactive, drop through to the profile-aware resolver so users
    // don't see a deactivated layout on an existing record.
    if (layoutId) {
      const match = object.pageLayouts.find((l) => l.id === layoutId);
      if (match && match.active !== false) {
        resolved = match;
      }
    }

    if (!resolved) {
      const result = resolveLayoutForUser(
        object,
        { profileId: authUser?.profileId ?? null },
        { layoutType },
      );
      if (result.kind === 'resolved') {
        resolved = result.layout;
      }
    }

    if (resolved && isLegacyLayout(resolved)) {
      return migrateLegacyLayout(resolved as any);
    }
    return resolved;
  }, [object, layoutId, layoutType, layoutOverride, authUser?.profileId]);

  useEffect(() => {
    if (layout && layout.tabs.length > 0 && !activeTab) {
      const firstVisible = layout.tabs.find((t) => !isHiddenByLifecycle(t as any, layoutType));
      if (firstVisible) setActiveTab(firstVisible.id);
      else if (layout.tabs[0]) setActiveTab(layout.tabs[0].id);
    }
  }, [layout, activeTab, layoutType]);

  // Auto-populate AutoUser fields
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

  // Pre-load lookup records from API
  useEffect(() => {
    if (!object || !layout) return;

    const targetApis = new Set<string>();
    let hasLookupUser = false;
    layout.tabs.forEach((tab) => {
      tab.regions.forEach((region) => {
        region.panels.forEach((panel) => {
          panel.fields.forEach((field) => {
            const rawType =
              (field as any).type ||
              object.fields.find((f) => f.apiName === field.fieldApiName)?.type;
            const fieldType = rawType ? normalizeFieldType(rawType) : undefined;
            if (fieldType === 'LookupUser') {
              hasLookupUser = true;
            } else if (
              fieldType === 'Lookup' ||
              fieldType === 'ExternalLookup' ||
              fieldType === 'PicklistLookup'
            ) {
              const target =
                (field as any).lookupObject ||
                (field as any).relationship?.targetObject ||
                (field as any).relatedObject ||
                (() => {
                  const fd = object.fields.find(
                    (f) => f.apiName === field.fieldApiName,
                  );
                  if (fd?.lookupObject) return fd.lookupObject;
                  if (fd?.relationship?.targetObject)
                    return fd.relationship.targetObject;
                  if ((fd as any)?.relatedObject) return (fd as any).relatedObject;
                  const fApiName = field.fieldApiName;
                  if (fApiName.endsWith('Id')) {
                    const possibleTarget = fApiName.slice(0, -2);
                    const matchedObj = schema?.objects.find(
                      (o) => o.apiName === possibleTarget,
                    );
                    if (matchedObj) return matchedObj.apiName;
                  }
                  return undefined;
                })();
              if (target) targetApis.add(target);
            }
          });
        });
      });
    });

    if (targetApis.size === 0 && !hasLookupUser) return;

    (async () => {
      const newCache: Record<string, any[]> = {};

      if (hasLookupUser) {
        try {
          const users = await apiClient.get<any[]>('/admin/users');
          newCache['__users__'] = Array.isArray(users) ? users : [];
        } catch (err) {
          console.error('Failed to fetch users for LookupUser:', err);
          newCache['__users__'] = [];
        }
      }

      if (targetApis.size > 0) {
        const knownApis = new Set<string>(
          (schema?.objects || []).map((o: any) => o.apiName),
        );
        const validApis = Array.from(targetApis).filter((api) => {
          if (api === 'User') return false;
          return knownApis.has(api);
        });

        if (targetApis.has('User') && !newCache['__users__']) {
          try {
            const users = await apiClient.get<any[]>('/admin/users');
            newCache['__users__'] = Array.isArray(users) ? users : [];
          } catch {
            newCache['__users__'] = [];
          }
        }

        const entries = await Promise.all(
          validApis.map(async (api) => {
            try {
              const records = await recordsService.getRecords(api);
              return [api, records.map((r) => ({ id: r.id, ...r.data }))] as [
                string,
                any[],
              ];
            } catch {
              return [api, []] as [string, any[]];
            }
          }),
        );
        for (const [key, val] of entries) {
          newCache[key] = val;
        }
      }

      setLookupRecordsCache((prev) => ({ ...prev, ...newCache }));
    })();
  }, [object, layout]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Early return ──────────────────────────────────────────────
  if (!object || !layout) {
    return (
      <div className="p-6 text-center text-gray-500">
        {!object
          ? 'Object not found'
          : `No ${layoutType === 'create' ? 'create' : 'edit'} layout configured for this object`}
      </div>
    );
  }

  // ── getFieldDef ───────────────────────────────────────────────
  const getFieldDef = (
    apiName: string,
    pageField?: PageField,
  ): FieldDef | undefined => {
    // Always look up the canonical schema field — it's the source of
    // truth for picklistValues, picklistColors, picklistDependencies, etc.
    const schemaField = object.fields.find((f) => f.apiName === apiName);

    if (pageField && pageField.type && pageField.label) {
      const {
        column,
        order,
        presentation: _p,
        colSpan: _cs,
        rowSpan: _rs,
        ...fieldProps
      } = pageField as any;
      return {
        id: fieldProps.id || apiName,
        ...fieldProps,
        apiName,
        type: normalizeFieldType(fieldProps.type!),
        // Prefer canonical schema values for picklist data — layout copies
        // can become stale or corrupted.
        ...(schemaField?.picklistValues ? { picklistValues: schemaField.picklistValues } : {}),
        ...(schemaField?.picklistColors ? { picklistColors: schemaField.picklistColors } : {}),
        ...(schemaField?.picklistDependencies ? { picklistDependencies: schemaField.picklistDependencies } : {}),
        // Always carry lookupObject from the canonical schema field so lookup
        // fields resolve correctly even if the layout copy omits it.
        ...(schemaField?.lookupObject ? { lookupObject: schemaField.lookupObject } : {}),
      } as FieldDef;
    }
    if (!schemaField) return undefined;
    return { ...schemaField, type: normalizeFieldType(schemaField.type) };
  };

  // ── handleFieldChange ─────────────────────────────────────────
  const handleFieldChange = (fieldApiName: string, valueOrFn: any) => {
    setFormData((prev) => {
      // Support functional updaters so callers can derive the next
      // value from the latest state (avoids stale-closure problems).
      const value =
        typeof valueOrFn === 'function'
          ? valueOrFn(prev[fieldApiName])
          : valueOrFn;
      const next = { ...prev, [fieldApiName]: value };
      const stripped = fieldApiName.replace(/^[A-Za-z]+__/, '');
      if (stripped !== fieldApiName) {
        next[stripped] = value;
      } else {
        const prefixedKey = Object.keys(prev).find(
          (k) =>
            k !== fieldApiName &&
            k.replace(/^[A-Za-z]+__/, '') === fieldApiName,
        );
        if (prefixedKey) next[prefixedKey] = value;
      }
      return next;
    });
    if (errors[fieldApiName]) {
      const newErrors = { ...errors };
      delete newErrors[fieldApiName];
      setErrors(newErrors);
    }
  };

  // ── Validation helpers ────────────────────────────────────────

  /** Collect { panelField, fieldDef } pairs for all fields in the layout. */
  const collectAllFields = () => {
    const pairs: Array<{
      panelField: import('@/lib/schema').PanelField;
      fieldDef: FieldDef;
    }> = [];
    layout.tabs.forEach((tab) => {
      if (isHiddenByLifecycle(tab as any, layoutType)) return;
      tab.regions.forEach((region) => {
        if (isHiddenByLifecycle(region as any, layoutType)) return;
        region.panels.forEach((panel) => {
          if (isHiddenByLifecycle(panel as any, layoutType)) return;
          panel.fields.forEach((field) => {
            if (isHiddenByLifecycle(field as any, layoutType)) return;
            const fd = getFieldDef(field.fieldApiName, field as any);
            if (fd) pairs.push({ panelField: field, fieldDef: fd });
          });
        });
      });
    });
    return pairs;
  };

  const runFullValidation = (): boolean => {
    const pairs = collectAllFields();
    const newErrors = validateFields(pairs, formData);
    setErrors(newErrors);
    // Recompute "missing required" from the same source of truth as
    // validateFields (field- or layout-level required) instead of matching
    // the error-message string, so localization / prefix changes don't
    // silently break the modal.
    const missing: string[] = [];
    for (const { panelField, fieldDef } of pairs) {
      const required = fieldDef.required || panelField.behavior === 'required';
      if (!required) continue;
      if (newErrors[panelField.fieldApiName]) {
        missing.push(fieldDef.label);
      }
    }
    setMissingRequiredLabels(missing);
    return Object.keys(newErrors).length === 0;
  };

  const runSectionValidation = (panel: LayoutPanel): boolean => {
    const pairs = panel.fields
      .map((f) => {
        const fd = getFieldDef(f.fieldApiName, f as any);
        return fd ? { panelField: f, fieldDef: fd } : null;
      })
      .filter(Boolean) as Array<{
      panelField: import('@/lib/schema').PanelField;
      fieldDef: FieldDef;
    }>;
    const newErrors = validateFields(pairs, formData);
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  // ── Wizard sections ───────────────────────────────────────────
  const wizardSections = (() => {
    if (layoutType !== 'create') return [];
    type WizardSection = {
      section: LayoutPanel;
      tabLabel: string;
      regionLabel: string;
      /** Parent region — used so the wizard step can render region-level widgets. */
      region: LayoutSection;
      /** True only for the last visible panel in this region — widgets render here. */
      isLastPanelInRegion: boolean;
    };
    const allSections: WizardSection[] = [];
    layout.tabs.forEach((tab) => {
      if (isHiddenByLifecycle(tab as any, layoutType)) return;
      tab.regions.forEach((region) => {
        if (isHiddenByLifecycle(region as any, layoutType)) return;
        // Filter panels first so we can correctly mark the LAST visible panel.
        const visiblePanels = region.panels
          .slice()
          .sort((a, b) => a.order - b.order)
          .filter((panel) => {
            const isVisible = evaluateVisibility(
              (region as any).visibleIf,
              formData,
              visibilityCtx,
            );
            const regionFx = getFormattingEffectsForRegion(
              layout,
              region.id,
              formData,
              visibilityCtx,
            );
            const panelFx = getFormattingEffectsForPanel(
              layout,
              panel.id,
              formData,
              visibilityCtx,
            );
            return (
              isVisible &&
              (region as any).showInTemplate !== false &&
              !regionFx?.hidden &&
              !panelFx?.hidden &&
              !panel.hidden &&
              !isHiddenByLifecycle(panel as any, layoutType) &&
              evaluateVisibility((panel as any).visibleIf, formData, visibilityCtx)
            );
          });
        visiblePanels.forEach((panel, idx) => {
          allSections.push({
            section: panel,
            tabLabel: tab.label,
            regionLabel: region.label,
            region,
            isLastPanelInRegion: idx === visiblePanels.length - 1,
          });
        });
      });
    });
    return allSections;
  })();

  const isWizardMode = layoutType === 'create' && wizardSections.length > 1;

  // Auto-scroll wizard step indicator
  useEffect(() => {
    if (!isWizardMode || !stepIndicatorRef.current) return;
    const container = stepIndicatorRef.current;
    const activeStep = container.querySelector(
      '[data-active-step="true"]',
    ) as HTMLElement;
    if (activeStep) {
      const containerRect = container.getBoundingClientRect();
      const stepRect = activeStep.getBoundingClientRect();
      const scrollLeft =
        activeStep.offsetLeft - containerRect.width / 2 + stepRect.width / 2;
      container.scrollTo({
        left: Math.max(0, scrollLeft),
        behavior: 'smooth',
      });
    }
  }, [currentStep, isWizardMode]);

  const handleNextStep = () => {
    if (currentStep < wizardSections.length - 1) {
      const currentSection = wizardSections[currentStep]!.section;
      if (runSectionValidation(currentSection)) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  // ── Submit ────────────────────────────────────────────────────
  const submitForm = async () => {
    if (runFullValidation()) {
      const completeData: Record<string, any> = { ...formData };
      if (object) {
        for (const field of object.fields) {
          if (field.required && !completeData[field.apiName]) {
            if (field.defaultValue !== undefined) {
              completeData[field.apiName] = field.defaultValue;
            } else {
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
                case 'PicklistLookup':
                  completeData[field.apiName] = { picklist: 'N/A', lookup: '' };
                  break;
                case 'Address':
                  completeData[field.apiName] = {
                    street: '',
                    city: '',
                    state: '',
                    postalCode: '',
                    country: '',
                  };
                  break;
                default:
                  completeData[field.apiName] = 'N/A';
                  break;
              }
            }
          }
        }
      }
      // Remove derived dotted keys (e.g. "address_search.city") that come
      // from flattenRecord expansion — the parent blob is authoritative.
      for (const key of Object.keys(completeData)) {
        if (key.includes('.') && !key.startsWith('_')) delete completeData[key];
      }
      setSubmitError(null);
      setIsSubmitting(true);
      try {
        const result = await onSubmit(completeData, layoutId);
        // If onSubmit returned a record ID (create mode) and there are
        // pending widget saves (e.g. team members), save them now.
        const recordId = typeof result === 'string' ? result : undefined;
        if (recordId && pendingCtx?.hasPendingData()) {
          const { errors: pendingErrors } = await pendingCtx.saveAllPending(recordId);
          if (pendingErrors.length > 0) {
            console.warn('[DynamicForm] Some pending widget data failed to save:', pendingErrors);
            // Don't block the flow — record is created; user can add related data later
          }
        }
        // Call onCreated for post-save navigation (avoids navigating before pending saves finish)
        if (recordId && onCreated) {
          onCreated(recordId);
        }
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : 'Failed to save record';
        setSubmitError(msg);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  /** Enter review mode (create only). */
  const enterReview = () => {
    if (isWizardMode) {
      const currentSection = wizardSections[currentStep]!.section;
      if (!runSectionValidation(currentSection)) return;
    }
    if (runFullValidation()) {
      setShowReview(true);
    }
  };

  /** Format a single field value for display in the review page */
  const formatReviewValue = (fieldDef: FieldDef, val: any): string => {
    if (fieldDef.type === 'URL' && fieldDef.staticUrl) return fieldDef.staticUrl;
    if (val === undefined || val === null || val === '') return '\u2014';
    switch (fieldDef.type) {
      case 'Checkbox':
        return val === true || val === 'true' ? 'Yes' : 'No';
      case 'Currency':
        return typeof val === 'number'
          ? `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : String(val);
      case 'Percent':
        return `${val}%`;
      case 'Date':
        try {
          return new Date(val).toLocaleDateString();
        } catch {
          return String(val);
        }
      case 'DateTime':
        try {
          return new Date(val).toLocaleString();
        } catch {
          return String(val);
        }
      case 'MultiPicklist':
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      case 'Lookup':
      case 'ExternalLookup':
      case 'LookupUser': {
        const lookupLabel = lookupQueries[fieldDef.apiName];
        return lookupLabel || String(val);
      }
      case 'CompositeText': {
        if (typeof val === 'object' && val !== null) {
          const keys = Object.keys(val);
          const findVal = (pattern: string) => {
            const k = keys.find((k2) => k2.toLowerCase().includes(pattern));
            return k ? val[k] : undefined;
          };
          const salutation = val.salutation || findVal('salutation');
          const firstName = val.firstName || findVal('firstname');
          const lastName = val.lastName || findVal('lastname');
          const named = [salutation, firstName, lastName].filter(Boolean);
          if (named.length > 0) return named.join(' ');
          const parts = Object.values(val).filter(Boolean);
          return parts.join(' ') || '\u2014';
        }
        return String(val);
      }
      case 'Address': {
        if (typeof val === 'object' && val !== null) {
          const { street, city, state, zipCode, country } = val as any;
          return (
            [street, city, state, zipCode, country].filter(Boolean).join(', ') ||
            '\u2014'
          );
        }
        return String(val);
      }
      case 'PicklistText': {
        if (typeof val === 'object' && val !== null) {
          const parts = [val.picklist, val.text].filter(Boolean);
          return parts.length > 0 ? parts.join(' \u2014 ') : '\u2014';
        }
        return String(val);
      }
      case 'PicklistLookup': {
        if (typeof val === 'object' && val !== null) {
          const parts = [val.picklist, val.lookup].filter(Boolean);
          return parts.length > 0 ? parts.join(' \u2014 ') : '\u2014';
        }
        return String(val);
      }
      default:
        return String(val);
    }
  };

  // ── Enter key handler ─────────────────────────────────────────
  const handleFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'textarea') return;
      if (tagName === 'input' || tagName === 'select') {
        e.preventDefault();
        const form = e.currentTarget;
        const focusable = Array.from(
          form.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
          ),
        );
        const currentIndex = focusable.indexOf(target);
        const nextField = focusable[currentIndex + 1];
        if (currentIndex >= 0 && nextField) nextField.focus();
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

  // ── Lookup callbacks (lifted for FieldInput) ──────────────────
  const handleLookupQueryChange = (fieldKey: string, query: string) => {
    setLookupQueries((prev) => ({ ...prev, [fieldKey]: query }));
    setActiveLookupField(fieldKey);
  };
  const handleLookupFocus = (fieldKey: string) => {
    setActiveLookupField(fieldKey);
  };
  const handleLookupBlur = (fieldKey: string) => {
    setTimeout(() => {
      setActiveLookupField((current) =>
        current === fieldKey ? null : current,
      );
    }, 150);
  };
  const handleInlineCreate = (targetApi: string, forField: string) => {
    setInlineCreateTarget(targetApi);
    setInlineCreateForField(forField);
    setActiveLookupField(null);
  };

  // ── renderField wrapper ───────────────────────────────────────
  const renderField = (
    fieldDef: FieldDef,
    stretch?: boolean,
    layoutField?: PageField,
  ) => (
    <FieldInput
      key={fieldDef.apiName}
      fieldDef={fieldDef}
      layoutField={layoutField}
      layout={layout}
      formData={formData}
      errors={errors}
      visibilityCtx={visibilityCtx}
      objectApiName={objectApiName}
      schema={schema}
      stretch={stretch}
      onFieldChange={handleFieldChange}
      lookupQueries={lookupQueries}
      activeLookupField={activeLookupField}
      lookupRecordsCache={lookupRecordsCache}
      objectFields={object.fields}
      onLookupQueryChange={handleLookupQueryChange}
      onLookupFocus={handleLookupFocus}
      onLookupBlur={handleLookupBlur}
      onInlineCreate={handleInlineCreate}
    />
  );

  // ── renderSectionContent ──────────────────────────────────────
  const currentTab = layout.tabs.find((t) => t.id === activeTab);
  if (!currentTab) return null;

  const renderSectionContent = (panel: LayoutPanel) => {
    const gridFields: {
      fieldDef: FieldDef;
      pageField: PageField;
      column: number;
      order: number;
      colSpan: number;
      rowSpan: number;
    }[] = [];
    for (const f of panel.fields) {
      if (isHiddenByLifecycle(f as any, layoutType)) continue;
      const fd = getFieldDef(f.fieldApiName, f as any);
      if (fd) {
        gridFields.push({
          fieldDef: fd,
          pageField: f as any,
          column: (f as any).column ?? f.order % panel.columns,
          order: f.order,
          colSpan: f.colSpan ?? 1,
          rowSpan: (f as any).rowSpan ?? 1,
        });
      }
    }

    const hasSpanning = gridFields.some(
      (f) => f.colSpan > 1 || f.rowSpan > 1,
    );

    if (!hasSpanning) {
      const columnArrays: (typeof gridFields)[] = [];
      for (let i = 0; i < panel.columns; i++) {
        columnArrays[i] = gridFields
          .filter((f) => f.column === i)
          .sort((a, b) => a.order - b.order);
      }

      return (
        <div className="p-4 pt-0">
          <div
            className={cn(
              'grid gap-4',
              panel.columns === 1 && 'grid-cols-1',
              panel.columns === 2 && 'grid-cols-1 md:grid-cols-2',
              panel.columns === 3 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
              panel.columns === 4 && 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
            )}
          >
            {columnArrays.map((columnEntries, colIndex) => (
              <div key={`col-${colIndex}`} className="flex flex-col gap-4">
                {columnEntries.map((entry) =>
                  renderField(entry.fieldDef, false, entry.pageField),
                )}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Spanning mode
    const occupied = new Set<string>();
    type PlacedField = (typeof gridFields)[0] & { gridRow: number };
    const placed: PlacedField[] = [];

    const colGroups: (typeof gridFields[0])[][] = [];
    for (let c = 0; c < panel.columns; c++) {
      colGroups[c] = gridFields
        .filter((f) => f.column === c)
        .sort((a, b) => a.order - b.order);
    }
    for (let c = 0; c < panel.columns; c++) {
      for (const f of colGroups[c] || []) {
        const cs = Math.min(f.colSpan, panel.columns - f.column);
        const rs = f.rowSpan;
        let row = 1;
        search: while (true) {
          for (let dr = 0; dr < rs; dr++) {
            for (let dc = 0; dc < cs; dc++) {
              if (occupied.has(`${row + dr},${f.column + dc}`)) {
                row++;
                continue search;
              }
            }
          }
          break;
        }
        placed.push({ ...f, gridRow: row });
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            occupied.add(`${row + dr},${f.column + dc}`);
          }
        }
      }
    }

    return (
      <div className="p-4 pt-0">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${panel.columns}, 1fr)`,
            gridAutoRows: 'minmax(60px, auto)',
            gap: '1rem',
          }}
        >
          {placed.map((f) => (
            <div
              key={f.fieldDef.apiName}
              style={{
                gridColumn: `${f.column + 1} / span ${Math.min(f.colSpan, panel.columns - f.column)}`,
                gridRow: `${f.gridRow} / span ${f.rowSpan}`,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                className="w-full"
                style={
                  f.rowSpan > 1
                    ? { flex: 1, display: 'flex', flexDirection: 'column' }
                    : undefined
                }
              >
                {renderField(f.fieldDef, f.rowSpan > 1, f.pageField)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════
  // ██  JSX  ████████████████████████████████████████████████████
  // ══════════════════════════════════════════════════════════════

  return (
    <PendingWidgetProvider value={pendingCtx.contextValue}>
    <>
      <form onKeyDown={handleFormKeyDown} className="flex flex-col h-full">
        {/* Wizard Step Indicator */}
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
                          isAfterCurrent && 'bg-gray-200 text-gray-500',
                        )}
                      >
                        {isBeforeCurrent ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          index + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs mt-1.5 text-center w-full truncate px-1',
                          isCurrent
                            ? 'text-brand-navy font-semibold'
                            : 'text-gray-500',
                        )}
                        title={ws.regionLabel || ws.section.label}
                      >
                        {ws.regionLabel || ws.section.label}
                      </span>
                    </div>
                    <div
                      className={cn(
                        'h-0.5 flex-shrink-0 mt-[-16px]',
                        isBeforeCurrent ? 'bg-green-500' : 'bg-gray-200',
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
                    showReview
                      ? 'bg-brand-navy text-white'
                      : 'bg-gray-200 text-gray-500',
                  )}
                >
                  {wizardSections.length + 1}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1.5 text-center w-full truncate px-1',
                    showReview
                      ? 'text-brand-navy font-semibold'
                      : 'text-gray-500',
                  )}
                >
                  Review
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        {!isWizardMode && layout.tabs.length > 1 && (
          <div className="flex gap-2 border-b px-6 pt-4 bg-white">
            {layout.tabs
              .filter((tab) => !isHiddenByLifecycle(tab as any, layoutType))
              .map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2 font-medium transition-colors border-b-2 -mb-px',
                  activeTab === tab.id
                    ? 'border-brand-navy text-brand-navy'
                    : 'border-transparent text-gray-600 hover:text-gray-900',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Wizard mode sections */}
        {!showReview && isWizardMode && wizardSections[currentStep] && (() => {
          const step = wizardSections[currentStep]!;
          // Render region widgets in the step for the LAST panel of the region,
          // matching the detail page's visual order (widgets below panels).
          const stepWidgets = step.isLastPanelInRegion
            ? (step.region.widgets ?? []).filter((w: any) => {
                const cfg = (w as any).config;
                // External widgets and Summary only belong on the record detail page.
                if (cfg?.type === 'ExternalWidget') return false;
                if (cfg?.type === 'Summary') return false;
                // On create forms, hide widgets that don't support create mode
                if (isCreateMode && !getWidgetSupportsCreate(cfg?.type)) return false;
                if (isHiddenByLifecycle(w as any, layoutType)) return false;
                return true;
              })
            : [];
          return (
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 bg-gray-100 rounded-t-lg">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {step.regionLabel || step.section.label}
                  </h3>
                  {(step.section as any).description ? (
                    <p className="text-xs text-gray-500 mt-1">
                      {(step.section as any).description}
                    </p>
                  ) : null}
                </div>
                {renderSectionContent(step.section)}
              </div>
              {stepWidgets.length > 0 && (
                <LayoutWidgetsInline
                  widgets={stepWidgets as any}
                  enabledIds={enabledWidgetIds}
                  record={formData}
                  objectDef={widgetObjectDef}
                />
              )}
            </div>
          );
        })()}

        {/* Regions + tab widgets -- 12-column tab canvas */}
        {!showReview && !isWizardMode && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {(() => {
              type CanvasItem =
                | { kind: 'region'; region: LayoutSection }
                | { kind: 'widget'; widget: import('@/lib/schema').LayoutWidget };
              const canvasItems: CanvasItem[] = [];
              for (const region of currentTab.regions) {
                canvasItems.push({ kind: 'region', region });
                for (const w of region.widgets || []) {
                  canvasItems.push({ kind: 'widget', widget: w as any });
                }
              }
              const filtered = canvasItems.filter((item) => {
                if (item.kind === 'widget') {
                  // Hide external widgets and Summary inside the form dialog —
                  // they only belong on the record detail page (rendered post-creation).
                  const cfg = (item.widget as any).config;
                  if (cfg?.type === 'ExternalWidget') return false;
                  if (cfg?.type === 'Summary') return false;
                  // On create forms, hide widgets that don't support create mode
                  if (isCreateMode && !getWidgetSupportsCreate(cfg?.type)) return false;
                  if (isHiddenByLifecycle(item.widget as any, layoutType)) return false;
                  return true;
                }
                const region = item.region;
                if (isHiddenByLifecycle(region as any, layoutType)) return false;
                const isRegionVisible = evaluateVisibility(
                  (region as any).visibleIf,
                  formData,
                  visibilityCtx,
                );
                if (!isRegionVisible) return false;
                if ((region as any).showInTemplate === false) return false;
                const regionFx = getFormattingEffectsForRegion(
                  layout,
                  region.id,
                  formData,
                  visibilityCtx,
                );
                if (regionFx?.hidden) return false;
                if (region.hidden) return false;
                return true;
              });
              return (
                <div
                  className="grid gap-4"
                  style={{
                    gridTemplateColumns: `repeat(${TAB_GRID_COLUMNS}, minmax(0, 1fr))`,
                  }}
                >
                  {filtered.map((item) => {
                    if (item.kind === 'widget') {
                      const g = item.widget;
                      return (
                        <div
                          key={g.id}
                          className="min-w-0"
                          style={gridItemStyle({
                            gridColumn: (g as any).gridColumn ?? 1,
                            gridColumnSpan:
                              (g as any).gridColumnSpan ?? TAB_GRID_COLUMNS,
                            gridRow: (g as any).gridRow ?? 1,
                            gridRowSpan: (g as any).gridRowSpan ?? 1,
                          })}
                        >
                          <LayoutWidgetsInline
                            widgets={[g] as any}
                            enabledIds={enabledWidgetIds}
                            record={formData}
                            objectDef={widgetObjectDef}
                          />
                        </div>
                      );
                    }
                    const region = item.region;
                    const visiblePanels = region.panels
                      .filter((p) => {
                        if (p.hidden) return false;
                        if (isHiddenByLifecycle(p as any, layoutType)) return false;
                        if ((p as any).visibleIf?.length > 0 && !evaluateVisibility((p as any).visibleIf, formData, visibilityCtx)) return false;
                        const panelFx = getFormattingEffectsForPanel(layout, p.id, formData, visibilityCtx);
                        if (panelFx?.hidden) return false;
                        return true;
                      })
                      .sort((a, b) => a.order - b.order);
                    return visiblePanels
                      .map((panelItem, panelIdx) => {
                        const isCollapsed = collapsedSections.has(panelItem.id);
                        return (
                          <div
                            key={panelItem.id}
                            className="bg-white rounded-lg border border-gray-200 min-w-0"
                            style={gridItemStyle({
                              gridColumn: region.gridColumn ?? 1,
                              gridColumnSpan:
                                region.gridColumnSpan ?? TAB_GRID_COLUMNS,
                              gridRow: visiblePanels.length > 1
                                ? (region.gridRow ?? 1) + panelIdx
                                : region.gridRow ?? 1,
                              gridRowSpan: 1,
                            })}
                          >
                            <button
                              type="button"
                              onClick={() => toggleSection(panelItem.id)}
                              className="w-full flex items-center justify-between p-4 bg-gray-100 hover:bg-gray-150 transition-colors rounded-t-lg"
                            >
                              <div className="text-left">
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {panelItem.label}
                                </h3>
                                {(panelItem as any).description ? (
                                  <p className="text-xs text-gray-500 mt-0.5 font-normal">
                                    {(panelItem as any).description}
                                  </p>
                                ) : null}
                              </div>
                              {isCollapsed ? (
                                <ChevronRight className="h-5 w-5 text-gray-600" />
                              ) : (
                                <ChevronDown className="h-5 w-5 text-gray-600" />
                              )}
                            </button>

                            {!isCollapsed && renderSectionContent(panelItem)}
                          </div>
                        );
                      });
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Review mode */}
        {showReview && (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  Review Your Record
                </h3>
                <p className="text-sm text-blue-700">
                  Please review the information below. Click{' '}
                  <strong>Edit</strong> to make changes or{' '}
                  <strong>Save</strong> to confirm.
                </p>
              </div>
            </div>
            {layout.tabs.map((tab) =>
              tab.regions.flatMap((region) => {
                const isRegionVisible = evaluateVisibility(
                  (region as any).visibleIf,
                  formData,
                  visibilityCtx,
                );
                if (!isRegionVisible) return [];
                if ((region as any).showInTemplate === false) return [];
                const regionFx = getFormattingEffectsForRegion(
                  layout,
                  region.id,
                  formData,
                  visibilityCtx,
                );
                if (regionFx?.hidden) return [];

                return region.panels
                  .sort((a, b) => a.order - b.order)
                  .filter((p) => {
                    if (p.hidden) return false;
                    if ((p as any).visibleIf?.length > 0 && !evaluateVisibility((p as any).visibleIf, formData, visibilityCtx)) return false;
                    const panelFx = getFormattingEffectsForPanel(layout, p.id, formData, visibilityCtx);
                    if (panelFx?.hidden) return false;
                    return true;
                  })
                  .map((panelItem) => {
                    const lifecycleFields = panelItem.fields.filter(
                      (f) => !isHiddenByLifecycle(f as any, layoutType),
                    );
                    const columnArrays: FieldDef[][] = [];
                    for (let ci = 0; ci < panelItem.columns; ci++) {
                      columnArrays[ci] = lifecycleFields
                        .filter(
                          (f) =>
                            ((f as any).column ??
                              f.order % panelItem.columns) === ci,
                        )
                        .sort((a, b) => a.order - b.order)
                        .map((f) => getFieldDef(f.fieldApiName, f as any))
                        .filter((f): f is FieldDef => f !== undefined);
                    }

                    return (
                      <div
                        key={panelItem.id}
                        className="bg-white rounded-lg border border-gray-200"
                      >
                        <div className="p-4 bg-gray-100 rounded-t-lg">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {panelItem.label}
                          </h3>
                          {(panelItem as any).description ? (
                            <p className="text-xs text-gray-500 mt-1 font-normal">
                              {(panelItem as any).description}
                            </p>
                          ) : null}
                        </div>
                        <div className="p-4">
                          <div
                            className={cn(
                              'grid gap-x-8 gap-y-3',
                              panelItem.columns === 1 && 'grid-cols-1',
                              panelItem.columns === 2 &&
                                'grid-cols-1 md:grid-cols-2',
                              panelItem.columns === 3 &&
                                'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                              panelItem.columns === 4 &&
                                'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
                            )}
                          >
                            {columnArrays.map((columnFields, colIndex) => (
                              <div
                                key={`review-col-${colIndex}`}
                                className="flex flex-col gap-3"
                              >
                                {columnFields.map((fieldDef) => {
                                  const isVisible = evaluateVisibility(
                                    fieldDef.visibleIf,
                                    formData,
                                    visibilityCtx,
                                  );
                                  if (!isVisible) return null;
                                  const val = formData[fieldDef.apiName];
                                  const display = formatReviewValue(
                                    fieldDef,
                                    val,
                                  );
                                  return (
                                    <div key={fieldDef.apiName} className="py-1">
                                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        {fieldDef.label}
                                      </dt>
                                      <dd className="mt-0.5 text-sm text-gray-900">
                                        {display}
                                      </dd>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  });
              }),
            )}
          </div>
        )}

        {/* Error banner */}
        {submitError && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {submitError}
          </div>
        )}

        {/* Actions -- wizard mode */}
        {isWizardMode && !showReview && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-gray-500">
              Step {currentStep + 1} of {wizardSections.length}
            </div>
            <div className="flex gap-3">
              {onCancel && currentStep === 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              )}
              {currentStep > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviousStep}
                  disabled={isSubmitting}
                >
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

        {/* Actions -- normal mode */}
        {!isWizardMode && !showReview && (
          <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            {layoutType === 'create' ? (
              <Button type="button" onClick={enterReview}>
                Review
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={submitForm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            )}
          </div>
        )}

        {/* Actions -- review mode */}
        {showReview && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
            <div className="text-sm text-gray-500 font-medium">
              Review Complete
            </div>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReview(false)}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                type="button"
                onClick={submitForm}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}
      </form>

      {/* Inline record creation -- layout selector step */}
      {inlineCreateTarget &&
        !inlineCreateLayoutId &&
        (() => {
          const targetObj = schema?.objects.find(
            (o) => o.apiName === inlineCreateTarget,
          );
          const targetLayouts = targetObj?.pageLayouts || [];
          if (targetLayouts.length <= 1) {
            const autoLayoutId = targetLayouts[0]?.id || null;
            queueMicrotask(() => setInlineCreateLayoutId(autoLayoutId));
            return null;
          }
          return (
            <Dialog
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  setInlineCreateTarget(null);
                  setInlineCreateForField(null);
                }
              }}
            >
              <DialogContent className="max-w-md p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b">
                  <DialogTitle>Select a Page Layout</DialogTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Choose which form layout to use for creating a new{' '}
                    {targetObj?.label || inlineCreateTarget}
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
                        <div className="font-medium text-gray-900">
                          {tl.name}
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {tl.tabs?.length || 0}{' '}
                          {(tl.tabs?.length || 0) === 1 ? 'tab' : 'tabs'} •{' '}
                          {tl.tabs?.reduce(
                            (acc: number, tab: any) =>
                              acc + (tab.regions?.length || 0),
                            0,
                          ) || 0}{' '}
                          sections
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-6 border-t border-gray-200 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInlineCreateTarget(null);
                      setInlineCreateForField(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          );
        })()}

      {/* Inline record creation -- form step */}
      {inlineCreateTarget && inlineCreateLayoutId && (
        <Dialog
          open={true}
          onOpenChange={(open) => {
            if (!open) {
              setInlineCreateTarget(null);
              setInlineCreateForField(null);
              setInlineCreateLayoutId(null);
            }
          }}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle>
                Create New{' '}
                {schema?.objects.find(
                  (o) => o.apiName === inlineCreateTarget,
                )?.label || inlineCreateTarget}
              </DialogTitle>
            </DialogHeader>
            <div
              className="overflow-hidden"
              style={{ height: 'calc(90vh - 80px)' }}
            >
              <DynamicForm
                objectApiName={inlineCreateTarget!}
                layoutType="create"
                layoutId={inlineCreateLayoutId}
                onSubmit={async (data, inlineLayoutIdArg) => {
                  try {
                    const targetObj = schema?.objects.find(
                      (o) => o.apiName === inlineCreateTarget,
                    );
                    if (targetObj) {
                      try {
                        await apiClient.createObject({
                          apiName: targetObj.apiName,
                          label: targetObj.label,
                          pluralLabel:
                            targetObj.pluralLabel || targetObj.label,
                        });
                      } catch {
                        // Object may already exist
                      }

                      try {
                        for (const field of targetObj.fields) {
                          const isSystemField = [
                            'Id',
                            'CreatedDate',
                            'LastModifiedDate',
                            'CreatedById',
                            'LastModifiedById',
                          ].includes(field.apiName);
                          if (
                            !isSystemField &&
                            field.type !== 'Lookup' &&
                            field.type !== 'ExternalLookup'
                          ) {
                            const bareApiName = field.apiName.replace(
                              /^[A-Za-z]+__/,
                              '',
                            );
                            await apiClient
                              .createField(targetObj.apiName, {
                                apiName: bareApiName,
                                label: field.label,
                                type: field.type || 'Text',
                                required: field.required || false,
                                unique: field.unique || false,
                                readOnly: field.readOnly || false,
                                picklistValues: field.picklistValues,
                                defaultValue: field.defaultValue,
                              })
                              .catch(() => {});
                          }
                        }
                      } catch {
                        // Non-fatal
                      }
                    }

                    const normalizedData: Record<string, any> = {};
                    Object.entries(data).forEach(([key, value]) => {
                      const cleanKey = key.replace(/^[A-Za-z]+__/, '');
                      normalizedData[cleanKey] = value;
                    });

                    const created = await recordsService.createRecord(
                      inlineCreateTarget!,
                      {
                        data: normalizedData,
                        pageLayoutId:
                          inlineLayoutIdArg || inlineCreateLayoutId,
                      },
                    );
                    if (created && inlineCreateForField) {
                      handleFieldChange(inlineCreateForField, created.id);
                      const flat = recordsService.flattenRecord(created);
                      const label = getRecordLabel(flat);
                      setLookupQueries((prev) => ({
                        ...prev,
                        [inlineCreateForField!]:
                          typeof label === 'string'
                            ? label
                            : String(label),
                      }));

                      if (inlineCreateTarget) {
                        setLookupRecordsCache((prev) => {
                          const existing =
                            prev[inlineCreateTarget!] || [];
                          return {
                            ...prev,
                            [inlineCreateTarget!]: [
                              ...existing,
                              { id: created.id, ...flat },
                            ],
                          };
                        });
                      }
                    }
                  } catch (err) {
                    console.error('Inline create failed:', err);
                    throw err;
                  }
                  setInlineCreateTarget(null);
                  setInlineCreateForField(null);
                  setInlineCreateLayoutId(null);
                }}
                onCancel={() => {
                  setInlineCreateTarget(null);
                  setInlineCreateForField(null);
                  setInlineCreateLayoutId(null);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
      <MissingRequiredModal
        open={missingRequiredLabels.length > 0}
        labels={missingRequiredLabels}
        onClose={() => setMissingRequiredLabels([])}
      />
    </>
    </PendingWidgetProvider>
  );
}
