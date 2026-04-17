'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { usePermissions } from '@/lib/permissions-context';
import { TicketDetailPanel } from '@/components/support/ticket-detail-panel';

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hasAppPermission } = usePermissions();
  const id = params?.id;

  if (!id) return null;

  const isAdmin = hasAppPermission('manageSupportTickets');

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={isAdmin ? '/support/tickets' : '/'}
          className="inline-flex items-center text-sm text-brand-dark/70 hover:text-brand-dark"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {isAdmin ? 'Back to tickets' : 'Back'}
        </Link>
      </div>

      <TicketDetailPanel
        ticketId={id}
        mode={isAdmin ? 'admin' : 'user'}
        onClose={() => router.back()}
      />
    </div>
  );
}
