import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Kpi } from '@/lib/types';

interface KpiCardProps {
  kpi: Kpi;
}

export function KpiCard({ kpi }: KpiCardProps) {
  if (kpi.loading) {
    return <KpiCardSkeleton />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">
            {kpi.label}
          </p>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">
            {kpi.value}
          </p>
        </div>
        {kpi.trend && (
          <div
            className={cn(
              'flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg',
              kpi.trend.isPositive
                ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20'
                : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
            )}
          >
            {kpi.trend.isPositive ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{kpi.trend.value}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function KpiCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm animate-pulse">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3"></div>
      <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
    </div>
  );
}
