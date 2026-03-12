'use client';

import { FileText } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';
import { useSchemaStore } from '@/lib/schema-store';

export default function DealDetailPage() {
  const { schema } = useSchemaStore();
  const dealObject = schema?.objects.find(obj => obj.apiName === 'Deal');
  const pluralLabel = dealObject?.pluralLabel || (dealObject?.label ? dealObject.label + 's' : 'Deals');

  return (
    <RecordDetailPage
      objectApiName="Deal"
      backRoute="/deals"
      backLabel={pluralLabel}
      icon={FileText}
    />
  );
}