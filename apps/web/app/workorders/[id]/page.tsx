'use client';

import { useCallback, useRef, useState } from 'react';
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

  // Resolve / reject refs let the async onBeforeAdvance callback wait for the
  // modal to close before returning to the Path widget.
  const resolveRef = useRef<((extra: Record<string, string> | null) => void) | null>(null);

  const handleBeforeAdvance = useCallback<PathInterceptCallback>(
    (stageName) => {
      const mode = INTERCEPT_STAGES[stageName];
      if (!mode) {
        // Not an intercepted stage — proceed immediately with no extra fields.
        return Promise.resolve({});
      }

      // Show the modal and wait for the user to confirm or cancel.
      return new Promise<Record<string, string> | null>((resolve) => {
        resolveRef.current = resolve;
        setModalMode(mode);
      });
    },
    [],
  );

  const handleConfirm = useCallback(
    (reason: string, notes: string) => {
      setModalMode(null);
      if (!resolveRef.current) return;
      const mode = modalMode;
      resolveRef.current(
        mode === 'hold'
          ? { holdReason: reason, holdNotes: notes }
          : { cancelReason: reason, cancelNotes: notes },
      );
      resolveRef.current = null;
    },
    [modalMode],
  );

  const handleCancel = useCallback(() => {
    setModalMode(null);
    resolveRef.current?.(null);
    resolveRef.current = null;
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
