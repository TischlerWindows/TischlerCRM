'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { LayoutResolveResult } from '@/lib/layout-resolver';

type ErrorResult = Extract<LayoutResolveResult, { kind: 'error' }>;

export function LayoutErrorDialog({
  open,
  onOpenChange,
  result,
  objectLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: ErrorResult | null;
  objectLabel: string;
}) {
  if (!result) return null;

  const title =
    result.reason === 'no-layouts'
      ? `No page layouts for ${objectLabel}`
      : `No layout available for you`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            {title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-700">{result.message}</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
