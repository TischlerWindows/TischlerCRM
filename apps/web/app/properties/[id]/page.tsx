'use client';

import { MapPin } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function PropertyDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Property"
      backRoute="/properties"
      backLabel="Properties"
      icon={MapPin}
    />
  );
}