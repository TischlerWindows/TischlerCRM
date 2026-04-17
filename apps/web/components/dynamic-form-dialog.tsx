'use client';

import React, { useState, useRef, useCallback } from 'react';
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
  onSubmit: (data: Record<string, any>, layoutId?: string) => string | void | Promise<string | void>;
  title?: string;
  /**
   * Called after the record is created AND all pending widget data has
   * been saved. Use this for navigation (router.push) instead of
   * navigating inside onSubmit, so pending data is saved first.
   */
  onCreated?: (recordId: string) => void;
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
  onCreated,
}: DynamicFormDialogProps) {
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const formTouchedRef = useRef(false);

  const handleSubmit = async (data: Record<string, any>, layoutId?: string) => {
    formTouchedRef.current = false;
    const result = await onSubmit(data, layoutId);
    return result;
  };

  const requestClose = useCallback(() => {
    if (formTouchedRef.current) {
      setShowExitConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  const handleCancel = () => {
    requestClose();
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      requestClose();
    } else {
      onOpenChange(true);
    }
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    formTouchedRef.current = false;
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-4xl max-h-[90vh] p-0"
          onPointerDownOutside={(e) => {
            if (formTouchedRef.current) {
              e.preventDefault();
              requestClose();
            }
          }}
          onEscapeKeyDown={(e) => {
            if (formTouchedRef.current) {
              e.preventDefault();
              requestClose();
            }
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>
              {title ||
                `${layoutType === 'create' ? 'Create New' : 'Edit'} ${
                  objectApiName.charAt(0).toUpperCase() + objectApiName.slice(1)
                }`}
            </DialogTitle>
          </DialogHeader>
          <div
            className="overflow-hidden"
            style={{ height: 'calc(90vh - 80px)', pointerEvents: 'auto' }}
            onChange={() => { formTouchedRef.current = true; }}
            onClick={(e) => {
              // Mark touched on interactive element clicks (selects, checkboxes, picklists)
              const tag = (e.target as HTMLElement).tagName.toLowerCase();
              if (tag === 'select' || tag === 'input' || tag === 'button') {
                formTouchedRef.current = true;
              }
            }}
          >
            <DynamicForm
              objectApiName={objectApiName}
              layoutType={layoutType}
              layoutId={layoutId}
              recordData={recordData}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              onCreated={onCreated}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsaved changes confirmation */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-2">
            You have unsaved changes. Are you sure you want to exit? Any data you&apos;ve entered will be lost.
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              onClick={() => setShowExitConfirm(false)}
            >
              Keep Editing
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              onClick={confirmExit}
            >
              Discard & Exit
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
