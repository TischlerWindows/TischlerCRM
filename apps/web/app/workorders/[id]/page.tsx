'use client';

import { ClipboardList } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function WorkOrderDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="WorkOrder"
      backRoute="/workorders"
      backLabel="Work Orders"
      icon={ClipboardList}
    />
  );
}
