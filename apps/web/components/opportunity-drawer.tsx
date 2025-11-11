'use client';

import { X, Edit } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Opportunity, OpportunityStage } from '@/lib/types';

interface OpportunityDrawerProps {
  opportunity: Opportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (opportunity: Opportunity) => void;
}

const stageColors: Record<OpportunityStage, string> = {
  'Qualification': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'Proposal': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Negotiation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Closed Won': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Closed Lost': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function OpportunityDrawer({ opportunity, isOpen, onClose, onEdit }: OpportunityDrawerProps) {
  if (!isOpen || !opportunity) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full sm:w-96 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-y-auto transition-transform',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 id="drawer-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Opportunity Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Opportunity Name
            </label>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{opportunity.name}</p>
          </div>

          {/* Account */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Account
            </label>
            <p className="text-base text-gray-900 dark:text-white">{opportunity.accountName}</p>
          </div>

          {/* Stage */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Stage
            </label>
            <span
              className={cn(
                'inline-flex items-center px-3 py-1 rounded-full text-sm font-medium',
                stageColors[opportunity.stage]
              )}
            >
              {opportunity.stage}
            </span>
          </div>

          {/* Amount & Probability */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Amount
              </label>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatCurrency(opportunity.amount)}
              </p>
            </div>
            {opportunity.probability !== undefined && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Probability
                </label>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {opportunity.probability}%
                </p>
              </div>
            )}
          </div>

          {/* Close Date */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Expected Close Date
            </label>
            <p className="text-base text-gray-900 dark:text-white">
              {formatDate(opportunity.closeDate)}
            </p>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Owner
            </label>
            <p className="text-base text-gray-900 dark:text-white">{opportunity.ownerName}</p>
          </div>

          {/* Notes */}
          {opportunity.notes && (
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                Notes
              </label>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {opportunity.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          {onEdit && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => onEdit(opportunity)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                <Edit className="w-4 h-4" />
                Edit Opportunity
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
