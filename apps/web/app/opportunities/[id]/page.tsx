'use client';

import { FileText } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';
import { useSchemaStore } from '@/lib/schema-store';

export default function OpportunityDetailPage() {
  const { schema } = useSchemaStore();
  const oppObject = schema?.objects.find(obj => obj.apiName === 'Opportunity');
  const pluralLabel = oppObject?.pluralLabel || (oppObject?.label ? oppObject.label + 's' : 'Opportunities');

  return (
    <RecordDetailPage
      objectApiName="Opportunity"
      backRoute="/opportunities"
      backLabel={pluralLabel}
      icon={FileText}
    />
  );
}
