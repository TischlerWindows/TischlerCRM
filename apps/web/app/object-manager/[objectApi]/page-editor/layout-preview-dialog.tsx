'use client';

import React, { useEffect, useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import DynamicForm from '@/components/dynamic-form';
import { PreviewDetailView } from '@/components/record-detail/preview-detail-view';
import { recordsService } from '@/lib/records-service';
import type { FieldDef, ObjectDef, PageLayout } from '@/lib/schema';
import { useEditorStore } from './editor-store';
import type { PreviewMode } from './store/selection-slice';

type LoadStatus = 'idle' | 'loading' | 'loaded' | 'empty' | 'error';

export interface LayoutPreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The current in-memory layout from the editor store (may be unsaved). */
  layout: PageLayout | null;
  /** The object being edited — used to fetch a sample record and render view-mode widgets. */
  objectApiName: string;
  objectDef: ObjectDef | undefined;
  objectLabel: string;
  /** Preserved for backwards-compat callers; not used directly by the new renderer. */
  allFields?: FieldDef[];
}

function formatRecordLabel(record: Record<string, any> | null, objectDef: ObjectDef | undefined): string {
  if (!record) return '';
  // Try common name-like fields; fall back to ID.
  const candidates = ['name', 'Name', 'label'];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  // Walk object fields to find the first Text-like populated field.
  const nameField = objectDef?.fields.find(
    (f) => /name/i.test(f.apiName) || /name/i.test(f.label),
  );
  if (nameField) {
    const unprefixed = nameField.apiName.replace(/^[A-Za-z]+__/, '');
    const value = record[nameField.apiName] ?? record[unprefixed];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return (record.id as string) || '(unnamed record)';
}

export function LayoutPreviewDialog({
  open,
  onOpenChange,
  layout,
  objectApiName,
  objectDef,
  objectLabel,
}: LayoutPreviewDialogProps) {
  const previewMode = useEditorStore((s) => s.previewMode);
  const setPreviewMode = useEditorStore((s) => s.setPreviewMode);

  const [sampleRecord, setSampleRecord] = useState<Record<string, any> | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [toast, setToast] = useState<string | null>(null);

  // Fetch the most recent record when the dialog first opens.
  useEffect(() => {
    if (!open || !objectApiName) return;
    let cancelled = false;
    setLoadStatus('loading');
    recordsService
      .getRecords(objectApiName, { limit: 1 })
      .then((records) => {
        if (cancelled) return;
        if (!records || records.length === 0) {
          setSampleRecord(null);
          setLoadStatus('empty');
        } else {
          // Flatten the nested `{ id, data: {...} }` shape to the flat form that
          // DynamicForm / RecordTabRenderer expect.
          setSampleRecord(recordsService.flattenRecord(records[0]));
          setLoadStatus('loaded');
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSampleRecord(null);
        setLoadStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, objectApiName]);

  // Dismiss the toast after a couple of seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const previewNoop = async () => {
    setToast("Preview mode — changes aren't saved");
  };

  const close = () => onOpenChange(false);

  if (!layout) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Preview</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Nothing to preview yet.</p>
        </DialogContent>
      </Dialog>
    );
  }

  const modes: PreviewMode[] = ['new', 'view', 'edit'];

  const needsRecord = previewMode === 'view' || previewMode === 'edit';
  const isLoading = loadStatus === 'loading' || (needsRecord && loadStatus === 'idle');
  const isEmpty = needsRecord && loadStatus === 'empty';
  const isError = loadStatus === 'error';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-gray-500" />
              Preview — {objectLabel}
            </DialogTitle>
            <div
              className="flex items-center rounded-md border border-gray-200 bg-gray-100 p-0.5"
              role="radiogroup"
              aria-label="Preview mode"
            >
              {modes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={previewMode === mode}
                  onClick={() => setPreviewMode(mode)}
                  className={`rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    previewMode === mode
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {isError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">
              Failed to load a record to preview against. Try closing and reopening the preview.
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading a sample record…
            </div>
          ) : isEmpty ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-600">
              <p className="font-medium text-gray-800">No records yet for {objectLabel}.</p>
              <p className="mt-2">
                Create a record first, then reopen this preview to see the{' '}
                <span className="font-semibold capitalize">{previewMode}</span> layout in action.
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Tip: switch to <span className="font-semibold">New</span> mode to preview the create
                form — it doesn&apos;t need an existing record.
              </p>
            </div>
          ) : previewMode === 'view' ? (
            <PreviewDetailView
              layout={layout}
              record={sampleRecord}
              objectDef={objectDef}
            />
          ) : previewMode === 'new' ? (
            <DynamicForm
              objectApiName={objectApiName}
              layoutType="create"
              layoutOverride={layout}
              recordData={{}}
              onSubmit={previewNoop}
              onCancel={close}
            />
          ) : (
            <DynamicForm
              objectApiName={objectApiName}
              layoutType="edit"
              layoutOverride={layout}
              recordData={sampleRecord ?? {}}
              onSubmit={previewNoop}
              onCancel={close}
            />
          )}
        </div>

        <div className="border-t border-gray-200 pt-3 text-xs text-gray-500 flex items-center justify-between gap-3">
          <div>
            {needsRecord && sampleRecord ? (
              <>
                Previewing record:{' '}
                <span className="font-medium text-gray-700">
                  {formatRecordLabel(sampleRecord, objectDef)}
                </span>
              </>
            ) : previewMode === 'new' ? (
              <>New Record form — no sample data used.</>
            ) : null}
          </div>
          <div className="italic">Interactions don&apos;t save in preview.</div>
        </div>

        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg">
            {toast}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
