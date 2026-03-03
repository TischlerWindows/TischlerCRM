'use client';

import { Package } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function ProductDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Product"
      backRoute="/products"
      backLabel="Products"
      icon={Package}
    />
  );
}