'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { Database } from 'lucide-react';
import Link from 'next/link';
import { useSchemaStore } from '@/lib/schema-store';
import RecordDetailPage from '@/components/record-detail-page';

export default function CustomObjectDetailPage() {
  const params = useParams();
  const { schema } = useSchemaStore();
  const slug = params.slug as string;

  const objectDef = useMemo(() => {
    if (!schema) return null;
    return schema.objects.find(
      (obj) =>
        obj.apiName.toLowerCase() === slug.toLowerCase() ||
        obj.label.toLowerCase().replace(/\s+/g, '-') === slug.toLowerCase()
    );
  }, [schema, slug]);

  if (!objectDef) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Database className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Object Not Found</h2>
          <p className="text-gray-600 mb-6">The object &quot;{slug}&quot; does not exist.</p>
          <Link
            href="/object-manager"
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go to Object Manager
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RecordDetailPage
      objectApiName={objectDef.apiName}
      backRoute={`/objects/${slug}`}
      backLabel={objectDef.pluralLabel || objectDef.label}
      icon={Database}
    />
  );
}