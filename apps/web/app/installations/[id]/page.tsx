'use client';

import { Zap } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function InstallationDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Installation"
      backRoute="/installations"
      backLabel="Installations"
      icon={Zap}
    />
  );
}