'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import RecordDetailPage from '@/components/record-detail-page';
import { WorkOrderReasonModal, type ReasonModalMode } from '@/components/work-order-reason-modal';
import { PathInterceptProvider, type PathInterceptCallback } from '@/lib/path-intercept-context';

/** Stages that require a reason modal before the status change is committed. */
const INTERCEPT_STAGES: Record<string, ReasonModalMode> = {
  'On Hold': 'hold',
  'Cancelled': 'cancel',
};

/**
 * WorkOrder detail page.
 *
 * Wraps the generic RecordDetailPage in a PathInterceptProvider so that
 * transitions to "On Hold" or "Cancelled" in the path widget show
 * WorkOrderReasonModal before the status change is committed.
 *
 * Other transitions (Open, Scheduled, In Progress, Completed, Closed) are
 * passed through immediately with no modal.
 */
export default function WorkOrderDetailPage() {
  const [modalMode, setModalMode] = useState<ReasonModalMode | null>(null);

  // pendingRef stores both the modal mode and resolve function together so
  // handleConfirm never has to read from React state (avoids stale-closure
  // bugs under React 18 batching).
  const pendingRef = useRef<{
    mode: ReasonModalMode;
    resolve: (v: Record<string, string> | null) => void;
  } | null>(null);

  // Issue 3: cancel any pending transition when the page unmounts.
  useEffect(() => {
    return () => {
      pendingRef.current?.resolve(null);
      pendingRef.current = null;
    };
  }, []);

  const handleBeforeAdvance = useCallback<PathInterceptCallback>((stageName) => {
    const mode = INTERCEPT_STAGES[stageName];
    if (!mode) {
      // Not an intercepted stage — proceed immediately with no extra fields.
      return Promise.resolve({});
    }

    // Show the modal and wait for the user to confirm or cancel.
    return new Promise<Record<string, string> | null>((resolve) => {
      // If an earlier modal was somehow still pending, abort it (Issue 4).
      pendingRef.current?.resolve(null);
      pendingRef.current = { mode, resolve };
      setModalMode(mode);
    });
  }, []);

  const handleConfirm = useCallback((reason: string, notes: string) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setModalMode(null);
    if (!pending) return;
    pending.resolve(
      pending.mode === 'hold'
        ? { holdReason: reason, holdNotes: notes }
        : { cancelReason: reason, cancelNotes: notes },
    );
  }, []);

  const handleCancel = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setModalMode(null);
    pending?.resolve(null);
  }, []);

  return (
    <PathInterceptProvider onBeforeAdvance={handleBeforeAdvance}>
      <RecordDetailPage
        objectApiName="WorkOrder"
        backRoute="/workorders"
        backLabel="Work Orders"
        icon={ClipboardList}
      />

      <WorkOrderReasonModal
        open={modalMode !== null}
        mode={modalMode ?? 'hold'}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </PathInterceptProvider>
  );
}
