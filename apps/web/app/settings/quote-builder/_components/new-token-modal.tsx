'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

const SOURCE_OBJECTS = [
  { value: 'SUMMARY', label: 'Summary' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'OPPORTUNITY', label: 'Opportunity' },
  { value: 'SYSTEM', label: 'System' },
];

const SOURCE_FIELDS: Record<string, { value: string; label: string }[]> = {
  SUMMARY: [
    { value: 'name', label: 'Project Name' },
    { value: 'opportunityNumber', label: 'Opportunity Number' },
    { value: 'jobType', label: 'Job Type' },
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
  OPPORTUNITY: [
    { value: 'name', label: 'Name' },
    { value: 'number', label: 'Number' },
    { value: 'stage', label: 'Stage' },
    { value: 'amount', label: 'Amount' },
  ],
  SYSTEM: [
    { value: 'currentDate', label: 'Current Date' },
    { value: 'companyName', label: 'Company Name' },
    { value: 'companyAddress', label: 'Company Address' },
  ],
};

const FORMATS = [
  { value: 'TEXT', label: 'Text' },
  { value: 'CURRENCY', label: 'Currency ($1,234.56)' },
  { value: 'DATE', label: 'Date' },
  { value: 'PHONE', label: 'Phone' },
  { value: 'PERCENTAGE', label: 'Percentage' },
];

const CATEGORIES = ['Project', 'Contact', 'Pricing', 'Materials', 'Add-ons', 'Custom'];

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

  if (!open) return null;

  const fields = SOURCE_FIELDS[sourceObject] || [];

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-[440px] max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">New Variable Token</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>
          )}

          {/* Source Object */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Source Object</label>
            <select
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
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Source Field</label>
            <select
              value={sourcePath}
              onChange={(e) => handleSourcePathChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            >
              <option value="">Select a field...</option>
              {fields.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          {/* Token Name */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
              Token Name <span className="font-normal text-gray-400">({'{{tokenName}}'} in templates)</span>
            </label>
            <input
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g., projectName"
              className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-brand-navy/20"
            />
          </div>

          {/* Label */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Display Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g., Project Name"
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
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 py-1.5 text-xs font-semibold bg-[#1e3a5f] text-white rounded-lg hover:bg-[#1e3a5f]/90 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Create Token'}
          </button>
        </div>
      </div>
    </div>
  );
}
