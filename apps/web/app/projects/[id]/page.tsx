'use client';

import { Folder } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';

export default function ProjectDetailPage() {
  return (
    <RecordDetailPage
      objectApiName="Project"
      backRoute="/projects"
      backLabel="Projects"
      icon={Folder}
    />
  );
}