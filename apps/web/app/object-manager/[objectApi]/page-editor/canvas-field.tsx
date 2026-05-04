'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Eye } from 'lucide-react';
import { useParams } from 'next/navigation';
import type { PanelField } from './types';
import { useEditorStore } from './editor-store';
import { CanvasErrorBoundary } from './canvas-error-boundary';
import { useSchemaStore } from '@/lib/schema-store';
import { getFieldTypeLabel } from '@/lib/schema';

interface CanvasFieldCardProps {
  field: PanelField;
  panelId: string;
  panelColumns: number;
}

const FIELD_RESIZE_STEP_PX = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toBehaviorLabel(behavior: PanelField['behavior']): string {
  switch (behavior) {
    case 'readOnly':
      return 'Read only';
    case 'required':
      return 'Required';
    case 'hidden':
      return 'Hidden';
    default:
      return 'None';
  }
}

const EMPTY_RULES: never[] = [];

export function CanvasFieldCard({ field, panelId, panelColumns }: CanvasFieldCardProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const resizeField = useEditorStore((s) => s.resizeField);
  const formattingRules = useEditorStore((s) => s.layout.formattingRules ?? EMPTY_RULES);
  const previewMode = useEditorStore((s) => s.previewMode);

  const routeParams = useParams();
  const objectApi = typeof routeParams?.objectApi === 'string' ? routeParams.objectApi : undefined;
  const fieldType = useSchemaStore((s) => {
    if (!objectApi) return undefined;
    const obj = s.schema?.objects.find((o) => o.apiName === objectApi);
    return obj?.fields.find((f) => f.apiName === field.fieldApiName)?.type;
  });

  const isSlot = field.kind === 'teamMemberSlot' && !!field.slotConfig;
  const isLookupFields = field.kind === 'lookupFields';
  const slotDisplayLabel = (() => {
    if (!isSlot || !field.slotConfig) return null;
    if (field.slotConfig.label) return field.slotConfig.label;
    const c = field.slotConfig.criterion;
    if (c.kind === 'flag') {
      return c.flag === 'primaryContact'
        ? 'Primary Contact'
        : c.flag === 'contractHolder'
          ? 'Contract Holder'
          : 'Quote Recipient';
    }
    return c.role;
  })();

  const isHiddenInPreviewMode =
    (previewMode === 'new' && field.hideOnNew) ||
    (previewMode === 'view' && ((field as any).hideOnView || field.hideOnExisting)) ||
    (previewMode === 'edit' && ((field as any).hideOnEdit || field.hideOnExisting));

  const hasVisibilityRule = useMemo(
    () =>
      formattingRules.some(
        (r) =>
          r.active !== false &&
          r.target.kind === 'field' &&
          r.target.fieldApiName === field.fieldApiName &&
          r.when.length > 0,
      ),
    [formattingRules, field.fieldApiName],
  );

  const [dragSpan, setDragSpan] = useState<number | null>(null);
  const resizeSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startSpan: number;
  } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `field-${field.fieldApiName}`,
    data: { type: 'field', panelId, fieldApiName: field.fieldApiName },
  });

  useEffect(() => {
    return () => {
      resizeSessionRef.current = null;
    };
  }, []);

  const isSelected =
    selectedElement?.type === 'field' &&
    selectedElement.id === field.fieldApiName &&
    selectedElement.panelId === panelId;

  const currentSpan = clamp(dragSpan ?? field.colSpan, 1, panelColumns);

  const labelStyle = useMemo<React.CSSProperties>(
    () => ({
      ...(field.labelStyle.color ? { color: field.labelStyle.color } : {}),
      ...(field.labelStyle.bold ? { fontWeight: 700 } : {}),
      ...(field.labelStyle.italic ? { fontStyle: 'italic' } : {}),
      ...(field.labelStyle.uppercase ? { textTransform: 'uppercase' } : {}),
      ...(field.labelStyle.fontSize ? { fontSize: `${field.labelStyle.fontSize}px` } : {}),
    }),
    [field.labelStyle],
  );

  const valueStyle = useMemo<React.CSSProperties>(
    () => ({
      ...(field.valueStyle.color ? { color: field.valueStyle.color } : {}),
      ...(field.valueStyle.background ? { backgroundColor: field.valueStyle.background } : {}),
      ...(field.valueStyle.bold ? { fontWeight: 700 } : {}),
      ...(field.valueStyle.italic ? { fontStyle: 'italic' } : {}),
      ...(field.valueStyle.fontSize ? { fontSize: `${field.valueStyle.fontSize}px` } : {}),
    }),
    [field.valueStyle],
  );

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
    gridColumn: `span ${currentSpan}`,
  };

  const getPointerStep = (dx: number) =>
    dx >= 0 ? Math.floor(dx / FIELD_RESIZE_STEP_PX) : Math.ceil(dx / FIELD_RESIZE_STEP_PX);

  const getSpanFromPointer = (startSpan: number, startX: number, clientX: number) =>
    clamp(startSpan + getPointerStep(clientX - startX), 1, panelColumns);

  const endResizeGesture = (target: HTMLButtonElement) => {
    const session = resizeSessionRef.current;
    if (!session) return;
    if (target.releasePointerCapture) {
      try {
        if (target.hasPointerCapture(session.pointerId)) {
          target.releasePointerCapture(session.pointerId);
        }
      } catch {
        // Ignore pointer capture errors for stale pointers.
      }
    }
    resizeSessionRef.current = null;
    setDragSpan(null);
  };

  const onResizePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startSpan = clamp(field.colSpan, 1, panelColumns);
    resizeSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startSpan,
    };
    setDragSpan(startSpan);
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onResizePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextSpan = getSpanFromPointer(session.startSpan, session.startX, event.clientX);
    setDragSpan(nextSpan);
  };

  const onResizePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextSpan = getSpanFromPointer(session.startSpan, session.startX, event.clientX);
    if (nextSpan !== session.startSpan) {
      resizeField(field.fieldApiName, panelId, nextSpan);
    }
    endResizeGesture(event.currentTarget);
  };

  const onResizePointerCancel = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = resizeSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    endResizeGesture(event.currentTarget);
  };

  const onResizeKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextSpan = clamp(field.colSpan + delta, 1, panelColumns);
    if (nextSpan !== field.colSpan) {
      resizeField(field.fieldApiName, panelId, nextSpan);
    }
  };

  return (
    <CanvasErrorBoundary label="Field">
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative min-h-10 rounded-md border bg-white px-2 py-2 text-xs transition-colors ${
        isSelected
          ? 'border-brand-navy bg-brand-navy/5 shadow-sm'
          : 'border-gray-200 hover:border-gray-300'
      } ${isHiddenInPreviewMode ? 'opacity-40' : ''}`}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedElement({
          type: 'field',
          id: field.fieldApiName,
          panelId,
        });
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Drag ${field.fieldApiName}`}
          className="shrink-0 cursor-grab rounded px-1 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
          onPointerDown={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm" style={labelStyle}>
            {isSlot
              ? (field.labelOverride || slotDisplayLabel || 'Connection Slot')
              : isLookupFields
                ? (field.labelOverride || (field as any).lookupFieldsConfig?.sourceLookupApiName
                    ? `Fields from: ${(field as any).lookupFieldsConfig?.sourceLookupApiName || '(unconfigured)'}`
                    : 'Lookup Fields')
                : field.fieldApiName}
          </div>
          <div className="mt-1 flex items-center gap-2">
            {isSlot ? (
              <span
                className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-purple-700"
                title="Connection Slot — synthetic field"
              >
                Connection
              </span>
            ) : isLookupFields ? (
              <span
                className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-700"
                title="Lookup Fields — displays fields from a linked record"
              >
                LF
              </span>
            ) : fieldType && (
              <span
                className="rounded-full bg-brand-navy/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-brand-navy"
                title={`Field type: ${getFieldTypeLabel(fieldType)}`}
              >
                {getFieldTypeLabel(fieldType)}
              </span>
            )}
            {field.behavior !== 'none' && (
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                {toBehaviorLabel(field.behavior)}
              </span>
            )}
            {isHiddenInPreviewMode && (
              <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-blue-600">
                Hide on {previewMode === 'new' ? 'New' : previewMode === 'view' ? 'View' : 'Edit'}
              </span>
            )}
            {hasVisibilityRule && (
              <span className="flex items-center gap-0.5 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600" title="Has visibility rule">
                <Eye className="h-2.5 w-2.5" />
              </span>
            )}
            <span
              className="rounded px-1.5 py-0.5 text-[10px] leading-none ring-1 ring-gray-200"
              style={valueStyle}
            >
              Value
            </span>
          </div>
        </div>
      </div>

      {panelColumns > 1 && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 w-6 cursor-col-resize rounded-r-md border-0 bg-gray-200/70 p-0 opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 touch-none"
          onPointerDown={onResizePointerDown}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerCancel}
          onKeyDown={onResizeKeyDown}
          onClick={(event) => event.stopPropagation()}
          role="slider"
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={panelColumns}
          aria-valuenow={currentSpan}
          aria-valuetext={`Span ${currentSpan} of ${panelColumns}`}
          aria-label={`Resize ${field.fieldApiName} field span`}
          title={`Resize ${field.fieldApiName} field span`}
        />
      )}
    </div>
    </CanvasErrorBoundary>
  );
}
