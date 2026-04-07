'use client';

import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export function UnsavedChangesDialog({
  open,
  isSaving,
  onKeepEditing,
  onLeaveWithoutSaving,
  onSaveAndLeave,
}: {
  open: boolean;
  isSaving?: boolean;
  onKeepEditing: () => void;
  onLeaveWithoutSaving: () => void;
  onSaveAndLeave: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onKeepEditing}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-dialog-title"
        className="bg-white rounded-lg shadow-lg w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 id="unsaved-dialog-title" className="text-lg font-semibold text-gray-900">
            Save changes?
          </h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            You have unsaved changes. Save now, keep editing, or leave and discard them.
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200">
          <div className="mx-auto flex w-full max-w-lg flex-wrap justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onKeepEditing}
              disabled={isSaving}
              className="min-w-[8rem]"
            >
              Keep editing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onLeaveWithoutSaving}
              disabled={isSaving}
              className="min-w-[8rem] text-red-600 hover:text-red-700 border-red-200"
            >
              Discard and leave
            </Button>
            <Button
              size="sm"
              onClick={onSaveAndLeave}
              disabled={isSaving}
              className="min-w-[8rem] bg-brand-navy hover:bg-brand-navy/90 text-white"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving…' : 'Save and leave'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
