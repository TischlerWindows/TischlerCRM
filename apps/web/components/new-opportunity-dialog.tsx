'use client';

import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NewOpportunityFormData, OpportunityStage } from '@/lib/types';

interface NewOpportunityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewOpportunityFormData) => void;
}

const stages: OpportunityStage[] = [
  'Qualification',
  'Proposal',
  'Negotiation',
  'Closed Won',
  'Closed Lost',
];

const owners = ['Sarah Chen', 'Michael Brown', 'David Lee', 'Jennifer Wilson'];

export function NewOpportunityDialog({ isOpen, onClose, onSubmit }: NewOpportunityDialogProps) {
  const [formData, setFormData] = useState<NewOpportunityFormData>({
    name: '',
    accountName: '',
    stage: 'Qualification',
    amount: 0,
    closeDate: '',
    ownerName: 'Sarah Chen',
    notes: '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof NewOpportunityFormData, string>>>({});

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Partial<Record<keyof NewOpportunityFormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.accountName.trim()) {
      newErrors.accountName = 'Account is required';
    }
    
    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    
    if (!formData.closeDate) {
      newErrors.closeDate = 'Close date is required';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit(formData);
    
    // Reset form
    setFormData({
      name: '',
      accountName: '',
      stage: 'Qualification',
      amount: 0,
      closeDate: '',
      ownerName: 'Sarah Chen',
      notes: '',
    });
    setErrors({});
  };

  const handleChange = (field: keyof NewOpportunityFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-xl z-50 max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 id="dialog-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            New Opportunity
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label htmlFor="opp-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Opportunity Name <span className="text-red-500">*</span>
            </label>
            <input
              id="opp-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={cn(
                'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white transition-colors',
                errors.name
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              )}
              placeholder="Enterprise Software License"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Account */}
          <div>
            <label htmlFor="opp-account" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Account <span className="text-red-500">*</span>
            </label>
            <input
              id="opp-account"
              type="text"
              value={formData.accountName}
              onChange={(e) => handleChange('accountName', e.target.value)}
              className={cn(
                'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white transition-colors',
                errors.accountName
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              )}
              placeholder="Acme Corporation"
            />
            {errors.accountName && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.accountName}</p>
            )}
          </div>

          {/* Stage & Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="opp-stage" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Stage
              </label>
              <select
                id="opp-stage"
                value={formData.stage}
                onChange={(e) => handleChange('stage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="opp-amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-gray-500">$</span>
                <input
                  id="opp-amount"
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.amount || ''}
                  onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                  className={cn(
                    'w-full pl-7 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white',
                    errors.amount
                      ? 'border-red-500 focus:ring-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  )}
                  placeholder="100000"
                />
              </div>
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
              )}
            </div>
          </div>

          {/* Close Date & Owner */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="opp-closeDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Close Date <span className="text-red-500">*</span>
              </label>
              <input
                id="opp-closeDate"
                type="date"
                value={formData.closeDate}
                onChange={(e) => handleChange('closeDate', e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white dark:[color-scheme:dark]',
                  errors.closeDate
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                )}
              />
              {errors.closeDate && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.closeDate}</p>
              )}
            </div>

            <div>
              <label htmlFor="opp-owner" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Owner
              </label>
              <select
                id="opp-owner"
                value={formData.ownerName}
                onChange={(e) => handleChange('ownerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white"
              >
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="opp-notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Notes
            </label>
            <textarea
              id="opp-notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:text-white resize-none"
              placeholder="Additional details about this opportunity..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Create Opportunity
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
