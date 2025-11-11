'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import type { Opportunity, OpportunityStage } from '@/lib/types';

interface OpportunitiesTableProps {
  opportunities: Opportunity[];
  onRowClick: (opportunity: Opportunity) => void;
  loading?: boolean;
}

type SortField = 'stage' | 'amount' | 'closeDate';
type SortDirection = 'asc' | 'desc';

const stageColors: Record<OpportunityStage, string> = {
  'Qualification': 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  'Proposal': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Negotiation': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Closed Won': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Closed Lost': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export function OpportunitiesTable({ opportunities, onRowClick, loading }: OpportunitiesTableProps) {
  const [sortField, setSortField] = useState<SortField>('closeDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedOpportunities = [...opportunities].sort((a, b) => {
    let comparison = 0;
    
    if (sortField === 'amount') {
      comparison = a.amount - b.amount;
    } else if (sortField === 'closeDate') {
      comparison = a.closeDate.getTime() - b.closeDate.getTime();
    } else if (sortField === 'stage') {
      comparison = a.stage.localeCompare(b.stage);
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const paginatedOpportunities = sortedOpportunities.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(opportunities.length / itemsPerPage);

  if (loading) {
    return <TableSkeleton />;
  }

  if (opportunities.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No opportunities found. Create your first opportunity to get started.
        </p>
      </div>
    );
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Account
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => handleSort('stage')}
              >
                <div className="flex items-center gap-1">
                  Stage
                  <SortIcon field="stage" />
                </div>
              </th>
              <th
                className="text-right py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => handleSort('amount')}
              >
                <div className="flex items-center justify-end gap-1">
                  Amount
                  <SortIcon field="amount" />
                </div>
              </th>
              <th
                className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                onClick={() => handleSort('closeDate')}
              >
                <div className="flex items-center gap-1">
                  Close Date
                  <SortIcon field="closeDate" />
                </div>
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Owner
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedOpportunities.map((opp) => (
              <tr
                key={opp.id}
                onClick={() => onRowClick(opp)}
                className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer transition-colors"
              >
                <td className="py-3 px-4 text-sm font-medium text-gray-900 dark:text-white">
                  {opp.name}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                  {opp.accountName}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      stageColors[opp.stage]
                    )}
                  >
                    {opp.stage}
                  </span>
                </td>
                <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white text-right">
                  {formatCurrency(opp.amount)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                  {formatDate(opp.closeDate)}
                </td>
                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                  {opp.ownerName}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {paginatedOpportunities.map((opp) => (
          <div
            key={opp.id}
            onClick={() => onRowClick(opp)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                {opp.name}
              </h3>
              <span
                className={cn(
                  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
                  stageColors[opp.stage]
                )}
              >
                {opp.stage}
              </span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{opp.accountName}</p>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-gray-900 dark:text-white">
                {formatCurrency(opp.amount)}
              </span>
              <span className="text-gray-500 dark:text-gray-400">{formatDate(opp.closeDate)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
            {Math.min(currentPage * itemsPerPage, opportunities.length)} of {opportunities.length}{' '}
            opportunities
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded animate-pulse"></div>
      ))}
    </div>
  );
}
