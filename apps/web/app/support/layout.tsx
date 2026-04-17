'use client';

import { CategoryCatalogProvider } from '@/lib/category-catalog-context';

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return <CategoryCatalogProvider>{children}</CategoryCatalogProvider>;
}
