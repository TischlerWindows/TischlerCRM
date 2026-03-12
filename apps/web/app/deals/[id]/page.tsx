'use client';

import { FileText } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function DealDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Deal"
      backRoute="/deals"
      backLabel="Opportunities"
      icon={FileText}
    />
  );
}