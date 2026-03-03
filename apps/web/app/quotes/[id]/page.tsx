'use client';

import { FileCheck } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function QuoteDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Quote"
      backRoute="/quotes"
      backLabel="Quotes"
      icon={FileCheck}
    />
  );
}