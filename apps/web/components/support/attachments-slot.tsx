'use client';

import { Paperclip } from 'lucide-react';
import type { TicketAttachment } from '@/lib/tickets-client';

/**
 * Phase 1 placeholder for the attachment dropzone. Michael's Dropbox
 * integration replaces this component's internals when ready. The public
 * contract is:
 *
 *   - ticketId: which ticket to attach files to (null during the create flow)
 *   - folderRef: opaque storage reference (e.g. Dropbox folder path); null until set
 *   - attachments: existing attachments for display
 *   - onAttachmentAdded: callback once Michael's code POSTs /tickets/:id/attachments
 *
 * When this component is replaced, the surrounding UI (ticket modal, detail
 * panel) does not need to change.
 */
interface AttachmentsSlotProps {
  ticketId: string | null;
  folderRef?: string | null;
  attachments?: TicketAttachment[];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAttachmentAdded?: (attachment: TicketAttachment) => void;
}

export function AttachmentsSlot({ attachments = [] }: AttachmentsSlotProps) {
  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <ul className="space-y-1.5">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 text-sm text-brand-dark/80 bg-gray-50 border border-gray-200 rounded-md px-3 py-2"
            >
              <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span className="truncate">{a.fileName}</span>
              {a.sizeBytes != null && (
                <span className="ml-auto text-xs text-gray-500">
                  {(a.sizeBytes / 1024).toFixed(1)} KB
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
        <Paperclip className="w-6 h-6 text-gray-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-brand-dark/70">Attachments coming soon</p>
        <p className="text-xs text-gray-500 mt-1">
          Dropbox integration pending — you&apos;ll be able to drop screenshots here.
        </p>
      </div>
    </div>
  );
}
