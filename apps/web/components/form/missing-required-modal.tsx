'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MissingRequiredModalProps {
  open: boolean;
  labels: string[];
  onClose: () => void;
}

export function MissingRequiredModal({ open, labels, onClose }: MissingRequiredModalProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Required fields missing
          </DialogTitle>
          <DialogDescription>
            Before this record can be saved, the fields below need a value on the
            current page layout.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-6 text-sm text-gray-800">
          {labels.map((label) => (
            <li key={label}>{label}</li>
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>OK</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
