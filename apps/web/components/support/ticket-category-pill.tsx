'use client';

import { useCategoryCatalog } from '@/lib/category-catalog-context';

export function TicketCategoryPill({ category }: { category: string }) {
  const { getDisplay } = useCategoryCatalog();
  const { label, className, isOrphan } = getDisplay(category);

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${className}`}
      title={isOrphan ? `Deleted category: ${category}` : undefined}
    >
      {label}
      {isOrphan && <span className="ml-1 text-[10px]">(deleted)</span>}
    </span>
  );
}
