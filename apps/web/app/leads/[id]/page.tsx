'use client';

import { Lightbulb } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function LeadDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Lead"
      backRoute="/leads"
      backLabel="Leads"
      icon={Lightbulb}
    />
  );
}