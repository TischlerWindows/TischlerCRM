'use client';

import { CheckSquare } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function TaskDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Task"
      backRoute="/tasks"
      backLabel="Tasks"
      icon={CheckSquare}
    />
  );
}
