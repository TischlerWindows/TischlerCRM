'use client';

import { Users } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function ContactDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Contact"
      backRoute="/contacts"
      backLabel="Contacts"
      icon={Users}
    />
  );
}