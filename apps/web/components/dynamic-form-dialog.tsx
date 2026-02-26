'use client';

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DynamicForm from './dynamic-form';

interface DynamicFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectApiName: string;
  layoutType: 'create' | 'edit';
  layoutId?: string;
  recordData?: Record<string, any>;
  onSubmit: (data: Record<string, any>, layoutId?: string) => void;
  title?: string;
}

export default function DynamicFormDialog({
  open,
  onOpenChange,
  objectApiName,
  layoutType,
  layoutId,
  recordData,
  onSubmit,
  title,
}: DynamicFormDialogProps) {
  const handleSubmit = (data: Record<string, any>, layoutId?: string) => {
    onSubmit(data, layoutId);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>
            {title ||
              `${layoutType === 'create' ? 'Create New' : 'Edit'} ${
                objectApiName.charAt(0).toUpperCase() + objectApiName.slice(1)
              }`}
          </DialogTitle>
        </DialogHeader>
        <div className="overflow-hidden" style={{ height: 'calc(90vh - 80px)' }}>
          <DynamicForm
            objectApiName={objectApiName}
            layoutType={layoutType}
            layoutId={layoutId}
            recordData={recordData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
