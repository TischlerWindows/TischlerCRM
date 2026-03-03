'use client';

import { Wrench } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function ServiceDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Service"
      backRoute="/service"
      backLabel="Service"
      icon={Wrench}
    />
  );
}