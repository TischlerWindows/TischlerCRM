'use client';

import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export function UnsavedChangesDialog({
  open,
  onCancel,
  onDiscard,
  onSave,
}: {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Unsaved Changes</h3>
        </div>
        <div className="px-6 py-4">
          <p className="text-gray-600">
            You have unsaved changes that will be lost. Would you like to save before leaving?
          </p>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            className="text-red-600 hover:text-red-700"
          >
            Discard Changes
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            className="bg-brand-navy hover:bg-brand-navy/90 text-white"
          >
            <Save className="h-4 w-4 mr-2" />
            Save &amp; Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
