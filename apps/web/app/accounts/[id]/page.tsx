'use client';

import { Building2 } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function AccountDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Account"
      backRoute="/accounts"
      backLabel="Accounts"
      icon={Building2}
    />
  );
}