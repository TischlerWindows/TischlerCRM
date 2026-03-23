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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Save changes?</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-gray-600">
            You have unsaved changes. Save before leaving, or leave without saving?
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onKeepEditing}
            disabled={isSaving}
          >
            Keep editing
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLeaveWithoutSaving}
            disabled={isSaving}
            className="text-red-600 hover:text-red-700 border-red-200"
          >
            Leave without saving
          </Button>
          <Button
            size="sm"
            onClick={onSaveAndLeave}
            disabled={isSaving}
            className="bg-brand-navy hover:bg-brand-navy/90 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving…' : 'Save and leave'}
          </Button>
        </div>
      </div>
    </div>
  );
}
