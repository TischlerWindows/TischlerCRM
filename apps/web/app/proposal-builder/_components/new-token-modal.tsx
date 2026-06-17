'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

const SOURCE_OBJECTS = [
  { value: 'SUMMARY', label: 'Summary' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'OPPORTUNITY', label: 'Opportunity' },
  { value: 'PROJECT', label: 'Project' },
  { value: 'SYSTEM', label: 'System' },
];

interface FieldOption {
  value: string;
  label: string;
}

/**
 * Hardcoded field lists for sources whose data shape isn't a CustomObject
 * (Summary is a JSON blob in Settings; Contact/Account/System are read by
 * the built-in token resolver via fixed paths). Opportunity and Project are
 * fetched dynamically from `/objects/:apiName/fields` since they're
 * CustomObjects whose field set can vary per deployment.
 */
const STATIC_SOURCE_FIELDS: Record<string, FieldOption[]> = {
  SUMMARY: [
    { value: 'name', label: 'Project Name' },
    { value: 'opportunityNumber', label: 'Opportunity Number' },
    { value: 'jobType', label: 'Job Type' },
    { value: 'quoteType', label: 'Quote Type' },
    { value: 'glassType', label: 'Glass Type' },
    { value: 'woodType', label: 'Wood Type' },
    { value: 'finish', label: 'Finish' },
    { value: 'sdl', label: 'SDL' },
    { value: 'spacerBarType', label: 'Spacer Bar Type' },
    { value: 'spacerBarColors', label: 'Spacer Bar Colors' },
    { value: 'plansDated', label: 'Plans Dated' },
    { value: 'salesman', label: 'Salesman' },
    { value: 'estimator', label: 'Estimator' },
    { value: 'address', label: 'Address' },
    { value: 'contactReceivingQuote', label: 'Contact Name' },
    { value: 'contactEmail', label: 'Contact Email' },
    { value: 'contactPrimaryPhone', label: 'Contact Phone' },
    { value: 'accountReceivingQuote', label: 'Company Name' },
    { value: 'accountShippingAddress', label: 'Company Address' },
    { value: 'installationTotal', label: 'Installation Total (inc. sub-rows)' },
  ],
  CONTACT: [
    { value: 'salutation', label: 'Salutation' },
    { value: 'firstName', label: 'First Name' },
    { value: 'lastName', label: 'Last Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
  ],
  ACCOUNT: [
    { value: 'name', label: 'Company Name' },
    { value: 'shippingAddress', label: 'Shipping Address' },
    { value: 'billingAddress', label: 'Billing Address' },
    { value: 'phone', label: 'Phone' },
  ],
  SYSTEM: [
    { value: 'currentDate', label: 'Current Date' },
    { value: 'companyName', label: 'Company Name' },
    { value: 'companyAddress', label: 'Company Address' },
  ],
};

const DYNAMIC_SOURCE_OBJECTS = new Set(['OPPORTUNITY', 'PROJECT']);

const FORMATS = [
  { value: 'TEXT', label: 'Text' },
  { value: 'CURRENCY', label: 'Currency ($1,234.56)' },
  { value: 'DATE', label: 'Date' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'PERCENTAGE', label: 'Percentage' },
];

const CATEGORIES = ['Project', 'Contact', 'Pricing', 'Materials', 'Add-ons', 'Custom'];

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    tokenName: string;
    sourceObject: string;
    sourcePath: string;
    format: string;
    label: string;
    category: string;
  }) => Promise<void>;
}

export function NewTokenModal({ open, onClose, onSubmit }: Props) {
  const [sourceObject, setSourceObject] = useState('SUMMARY');
  const [sourcePath, setSourcePath] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [format, setFormat] = useState('TEXT');
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('Custom');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dynamically-fetched fields for CustomObject sources (Opportunity, Project).
  const [dynamicFields, setDynamicFields] = useState<FieldOption[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus management: capture previous focus on open, restore on close,
  // and set initial focus to the first form field.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    // Defer until after render so the input exists.
    const t = window.setTimeout(() => {
      firstFieldRef.current?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open]);

  // Escape to close + focus trap.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('disabled') && el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Fetch CustomField metadata for dynamic source objects when selected.
  useEffect(() => {
    if (!open) return;
    if (!DYNAMIC_SOURCE_OBJECTS.has(sourceObject)) {
      setDynamicFields([]);
      setLoadingFields(false);
      return;
    }
    let cancelled = false;
    setLoadingFields(true);
    apiClient
      .get<{ id: string; apiName: string; label: string; type: string }[]>(
        `/objects/${sourceObject.charAt(0) + sourceObject.slice(1).toLowerCase()}/fields`,
      )
      .then((res) => {
        if (cancelled) return;
        setDynamicFields(
          res.map((f) => ({
            value: f.apiName,
            label: f.label || f.apiName,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setDynamicFields([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFields(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sourceObject]);

  if (!open) return null;

  const fields: FieldOption[] = DYNAMIC_SOURCE_OBJECTS.has(sourceObject)
    ? dynamicFields
    : STATIC_SOURCE_FIELDS[sourceObject] || [];

  const handleSourceObjectChange = (val: string) => {
    setSourceObject(val);
    setSourcePath('');
    setTokenName('');
    setLabel('');
  };

  const handleSourcePathChange = (val: string) => {
    setSourcePath(val);
    const field = fields.find((f) => f.value === val);
    if (field && !tokenName) {
      setTokenName(val);
      setLabel(field.label);
    }
  };

  const handleSubmit = async () => {
    if (!tokenName.trim() || !sourcePath.trim() || !label.trim()) {
      setError('Token name, source field, and label are required.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ tokenName: tokenName.trim(), sourceObject, sourcePath, format, label: label.trim(), category });
      setSourceObject('SUMMARY');
      setSourcePath('');
      setTokenName('');
      setFormat('TEXT');
      setLabel('');
      setCategory('Custom');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create token');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onMouseDown={handleBackdropMouseDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-white rounded-xl shadow-xl w-[440px] max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 id={titleId} className="text-sm font-semibold text-gray-900">New Variable Token</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close New Variable Token dialog"
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          {/* Source Object */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Source Object</label>
            <select
              ref={firstFieldRef}
              value={sourceObject}
              onChange={(e) => handleSourceObjectChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            >
              {SOURCE_OBJECTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Source Field */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
              Source Field <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <select
              value={sourcePath}
              onChange={(e) => handleSourcePathChange(e.target.value)}
              required
              aria-required="true"
              disabled={loadingFields}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20 disabled:bg-gray-50"
            >
              <option value="">
                {loadingFields ? 'Loading fields…' : 'Select a field...'}
              </option>
              {fields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            {DYNAMIC_SOURCE_OBJECTS.has(sourceObject) && !loadingFields && fields.length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1">
                No fields defined for {sourceObject.charAt(0) + sourceObject.slice(1).toLowerCase()} yet. Add fields in Object Manager first.
              </p>
            )}
          </div>

          {/* Token Name */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
              Token Name <span aria-hidden="true" className="text-red-500">*</span>{' '}
              <span className="font-normal text-gray-400">({'{{tokenName}}'} in templates)</span>
            </label>
            <input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g., projectName"
              required
              aria-required="true"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          {/* Label */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
              Display Label <span aria-hidden="true" className="text-red-500">*</span>
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Project Name"
              required
              aria-required="true"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Format */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 rounded focus:outline-none focus:ring-2 focus:ring-brand-navy/30 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 text-xs font-semibold bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 focus:outline-none focus:ring-2 focus:ring-brand-navy/40 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
