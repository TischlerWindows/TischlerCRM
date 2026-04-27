'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Star, X } from 'lucide-react';
import type { WidgetProps } from '@/lib/widgets/types';
import type { PathDef, PathStage, PathTransitionField, FieldDef } from '@/lib/schema';
import { useSchemaStore } from '@/lib/schema-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import PathTmTransitionField from '../team-member-slot/PathTmTransitionField';

function daysAgo(isoDate: string | undefined): number | null {
  if (!isoDate) return null;
  const entered = new Date(isoDate);
  if (isNaN(entered.getTime())) return null;
  const now = new Date();
  return Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDuration(days: number): string {
  if (days === 0) return 'Less than a day';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default function PathWidget({ config, record, object }: WidgetProps) {
  const schema = useSchemaStore((s) => s.schema);
  const pathId = config.pathId as string;
  const showLabel = (config.showLabel as boolean) ?? true;
  const showGuidance = (config.showGuidance as boolean) ?? true;
  const showKeyFields = (config.showKeyFields as boolean) ?? true;
  const compact = (config.compact as boolean) ?? false;

  const [popoverStageId, setPopoverStageId] = useState<string | null>(null);
  const [popoverRect, setPopoverRect] = useState<{ top: number; left: number } | null>(null);
  const [confirmBack, setConfirmBack] = useState<PathStage | null>(null);
  const [confirmReopen, setConfirmReopen] = useState<PathStage | null>(null);
  const [updating, setUpdating] = useState(false);
  const [hoveredStageId, setHoveredStageId] = useState<string | null>(null);
  const [transitionTarget, setTransitionTarget] = useState<PathStage | null>(null);
  const [transitionValues, setTransitionValues] = useState<Record<string, string>>({});
  /** Map of synthetic TM-transition keys → whether the criterion is currently filled (≥1 row). */
  const [transitionTmFilled, setTransitionTmFilled] = useState<Record<string, boolean>>({});

  const popoverRef = useRef<HTMLDivElement>(null);
  const stageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setStageRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) stageRefs.current.set(id, el);
    else stageRefs.current.delete(id);
  }, []);

  // Find the path + full object definition from schema (includes picklistValues on fields)
  const objectDef = schema?.objects.find(o => o.apiName === object.apiName);
  const pathDef = objectDef?.paths?.find(p => p.id === pathId);

  // Full field definitions from schema (has picklistValues, etc.)
  const fullFields: FieldDef[] = objectDef?.fields ?? [];

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverStageId(null);
        setPopoverRect(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!pathDef || !pathDef.active) return null;

  const sortedStages = [...pathDef.stages].sort((a, b) => a.order - b.order);
  const currentStageId = record[pathDef.trackingFieldApiName] as string | undefined;
  const currentStageIdx = sortedStages.findIndex(s => s.id === currentStageId);
  const effectiveIdx = currentStageIdx >= 0 ? currentStageIdx : 0;
  const currentStage = sortedStages[effectiveIdx];

  const isClosed = currentStage?.category === 'closed-won' || currentStage?.category === 'closed-lost';
  const isWon = currentStage?.category === 'closed-won';
  const isLost = currentStage?.category === 'closed-lost';

  // Time in current stage
  const stageEnteredAt = pathDef.stageEnteredAtFieldApiName
    ? (record[pathDef.stageEnteredAtFieldApiName] as string | undefined)
    : undefined;
  const daysInStage = daysAgo(stageEnteredAt);

  async function advanceToStage(stage: PathStage, extraFields?: Record<string, string>) {
    if (updating) return;
    const recordId = record.id as string;
    if (!recordId) return;

    setUpdating(true);
    try {
      const updateData: Record<string, unknown> = {
        [pathDef!.trackingFieldApiName]: stage.id,
      };
      if (pathDef!.stageEnteredAtFieldApiName) {
        updateData[pathDef!.stageEnteredAtFieldApiName] = new Date().toISOString();
      }
      if (extraFields) {
        Object.assign(updateData, extraFields);
      }
      await apiClient.updateRecord(object.apiName, recordId, updateData);
      record[pathDef!.trackingFieldApiName] = stage.id;
      if (pathDef!.stageEnteredAtFieldApiName) {
        record[pathDef!.stageEnteredAtFieldApiName] = updateData[pathDef!.stageEnteredAtFieldApiName];
      }
      if (extraFields) {
        Object.entries(extraFields).forEach(([k, v]) => { record[k] = v; });
      }
    } catch {
      // Silent — record stays at previous stage
    } finally {
      setUpdating(false);
      setPopoverStageId(null);
      setPopoverRect(null);
      setConfirmBack(null);
      setConfirmReopen(null);
      setTransitionTarget(null);
      setTransitionValues({});
      setTransitionTmFilled({});
    }
  }

  function tryAdvance(stage: PathStage, idx: number) {
    // Always check transition fields first — even when reopening from a closed state,
    // if the TARGET stage has transition fields they must be filled
    const tf = stage.transitionFields;
    if (tf && tf.length > 0) {
      const initial: Record<string, string> = {};
      tf.forEach(f => {
        // TM-criterion transitions don't seed from record fields — handled separately by Chunk 7.
        if (f.kind && f.kind !== 'field') return;
        if (!f.fieldApiName) return;
        const existing = record[f.fieldApiName];
        if (existing != null && existing !== '') initial[f.fieldApiName] = String(existing);
      });
      setTransitionValues(initial);
      setTransitionTarget(stage);
      setPopoverStageId(null);
      setPopoverRect(null);
      return;
    }

    // If currently closed and target has no transition fields, confirm reopen
    if (isClosed) {
      setConfirmReopen(stage);
      setPopoverStageId(null);
      setPopoverRect(null);
      return;
    }

    if (idx < effectiveIdx) {
      setConfirmBack(stage);
      setPopoverStageId(null);
      setPopoverRect(null);
    } else {
      advanceToStage(stage);
    }
  }

  function openPopover(stage: PathStage) {
    if (popoverStageId === stage.id) {
      setPopoverStageId(null);
      setPopoverRect(null);
      return;
    }
    const stageEl = stageRefs.current.get(stage.id);
    if (stageEl) {
      const rect = stageEl.getBoundingClientRect();
      setPopoverRect({
        top: rect.bottom + 8,
        left: rect.left + rect.width / 2,
      });
    }
    setPopoverStageId(stage.id);
  }

  function handleStageClick(stage: PathStage, idx: number) {
    // In closed state, route through tryAdvance so transition fields are checked
    if (isClosed) {
      tryAdvance(stage, idx);
      return;
    }

    if (compact) {
      tryAdvance(stage, idx);
    } else {
      openPopover(stage);
    }
  }

  function handleMarkStage(stage: PathStage, idx: number) {
    tryAdvance(stage, idx);
  }

  function handleTransitionSubmit() {
    if (!transitionTarget) return;
    const allTf = transitionTarget.transitionFields || [];
    const fieldTf = allTf.filter(
      (f): f is PathTransitionField & { fieldApiName: string } =>
        (!f.kind || f.kind === 'field') && typeof f.fieldApiName === 'string'
    );
    const fieldsFilled = fieldTf.every(f => !f.required || (transitionValues[f.fieldApiName]?.trim()));
    const tmFilled = allTf
      .filter(f => f.kind === 'teamMemberFlag' || f.kind === 'teamMemberRole')
      .every(f => !f.required || transitionTmFilled[tmKey(f)] === true);
    if (!fieldsFilled || !tmFilled) return;
    advanceToStage(transitionTarget, transitionValues);
  }

  function tmKey(tf: PathTransitionField): string {
    if (tf.kind === 'teamMemberFlag') return `__tm:flag:${tf.flag ?? ''}`;
    if (tf.kind === 'teamMemberRole') return `__tm:role:${tf.role ?? ''}`;
    return '';
  }

  // Render a field input for transition fields using full FieldDef from schema
  function renderTransitionField(tf: PathTransitionField) {
    // TM-criterion transitions are rendered by the slot input — extended in Chunk 7.
    if ((tf.kind && tf.kind !== 'field') || !tf.fieldApiName) return null;
    const apiName = tf.fieldApiName;
    const fieldDef = fullFields.find(fd => fd.apiName === apiName);
    const fieldType = fieldDef?.type;
    const label = fieldDef?.label || apiName;
    const picklistValues = fieldDef?.picklistValues || [];
    const isPicklist = fieldType === 'Picklist' || fieldType === 'MultiPicklist' || fieldType === 'PicklistText';
    const isLongText = fieldType === 'LongTextArea' || fieldType === 'RichTextArea' || fieldType === 'TextArea';

    return (
      <div key={apiName}>
        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
          {label}
          {tf.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {isPicklist && picklistValues.length > 0 ? (
          <select
            className="w-full h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            value={transitionValues[apiName] || ''}
            onChange={e => setTransitionValues(v => ({ ...v, [apiName]: e.target.value }))}
          >
            <option value="">Select...</option>
            {picklistValues.map((val: string) => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
        ) : isLongText ? (
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            value={transitionValues[apiName] || ''}
            onChange={e => setTransitionValues(v => ({ ...v, [apiName]: e.target.value }))}
            placeholder={`Enter ${label}...`}
          />
        ) : (
          <input
            className="w-full h-9 rounded-md border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30 focus:border-brand-navy"
            value={transitionValues[apiName] || ''}
            onChange={e => setTransitionValues(v => ({ ...v, [apiName]: e.target.value }))}
            placeholder={`Enter ${label}...`}
          />
        )}
      </div>
    );
  }

  let statusLabel = '';
  if (isWon) statusLabel = 'Closed Won';
  if (isLost) statusLabel = 'Closed Lost';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 relative">
      {/* Path name label */}
      {showLabel && (
        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
          {pathDef.name}
          {statusLabel && (
            <>
              {' — '}
              <span className={isWon ? 'text-green-500' : 'text-red-500'}>{statusLabel}</span>
            </>
          )}
        </div>
      )}

      {/* Chevron bar */}
      <div className="flex items-stretch h-9 rounded-md overflow-hidden">
        {sortedStages.map((stage, idx) => {
          const isCompleted = idx < effectiveIdx;
          const isCurrent = idx === effectiveIdx;
          const isFuture = idx > effectiveIdx;
          const isClosedWonStage = stage.category === 'closed-won';
          const isClosedLostStage = stage.category === 'closed-lost';
          const isFirst = idx === 0;
          const isLast = idx === sortedStages.length - 1;

          let bgStyle: React.CSSProperties = {};
          let textClass = '';
          let icon: React.ReactNode = null;

          if (isClosed) {
            // Tinted: all stages visible, colored by win/loss outcome
            // Using inline styles to avoid Tailwind JIT issues with unused color classes
            if (isWon) {
              if (isCompleted) { bgStyle = { backgroundColor: '#166534' }; textClass = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
              else if (isCurrent) { bgStyle = { backgroundColor: '#22c55e' }; textClass = 'text-white font-bold'; icon = <Star className="w-3 h-3 mr-0.5" />; }
              else { bgStyle = { backgroundColor: '#dcfce7' }; textClass = 'text-green-600'; }
            } else {
              if (isCompleted) { bgStyle = { backgroundColor: '#991b1b' }; textClass = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
              else if (isCurrent) { bgStyle = { backgroundColor: '#ef4444' }; textClass = 'text-white font-bold'; icon = <X className="w-3 h-3 mr-0.5" />; }
              else { bgStyle = { backgroundColor: '#fef2f2' }; textClass = 'text-red-600'; }
            }
          } else {
            if (isCompleted) { bgStyle = {}; textClass = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
            else if (isCurrent) { bgStyle = {}; textClass = 'text-white font-semibold'; }
            else if (isClosedWonStage && isFuture) { bgStyle = {}; textClass = 'text-green-700'; }
            else if (isClosedLostStage && isFuture) { bgStyle = {}; textClass = 'text-red-700'; }
            else { bgStyle = {}; textClass = 'text-gray-600'; }
          }

          // Active-state bg classes (these are known to work in the bundle)
          let bgClass = '';
          if (!isClosed) {
            if (isCompleted) bgClass = 'bg-brand-navy';
            else if (isCurrent) bgClass = 'bg-blue-500';
            else if (isClosedWonStage && isFuture) bgClass = 'bg-green-50';
            else if (isClosedLostStage && isFuture) bgClass = 'bg-red-50';
            else bgClass = 'bg-gray-200';
          }

          const clipFirst = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';
          const clipMiddle = 'polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)';
          const clipLast = 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 10px 100%, 0 50%)';
          const clipPath = isFirst ? clipFirst : isLast ? clipLast : clipMiddle;

          const isHovered = hoveredStageId === stage.id;

          return (
            <div
              key={stage.id}
              ref={(el) => setStageRef(stage.id, el)}
              className={cn(
                'flex-1 flex items-center justify-center text-xs cursor-pointer transition-opacity relative',
                bgClass, textClass,
                !isFirst && '-ml-1.5',
                (isClosedWonStage || isClosedLostStage) && 'flex-[0.8]',
                updating && 'opacity-60 pointer-events-none',
              )}
              style={{ clipPath, ...bgStyle }}
              onClick={() => handleStageClick(stage, idx)}
              onMouseEnter={() => setHoveredStageId(stage.id)}
              onMouseLeave={() => setHoveredStageId(null)}
            >
              <span className="flex items-center gap-0.5 px-2 truncate">
                {icon}
                {stage.name}
              </span>

              {/* Time-in-stage tooltip */}
              {isHovered && isCurrent && daysInStage !== null && (
                <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                  <div className="bg-brand-navy text-white text-[11px] font-medium px-3 py-1.5 rounded-md shadow-lg">
                    {formatDuration(daysInStage)} in {stage.name}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Popover — fixed position so it escapes any overflow:hidden ancestors */}
      {!compact && popoverStageId && popoverRect && (() => {
        const stage = sortedStages.find(s => s.id === popoverStageId);
        const stageIdx = sortedStages.findIndex(s => s.id === popoverStageId);
        if (!stage) return null;
        const keyFields = (showKeyFields && stage.keyFields) || [];
        const guidance = showGuidance ? stage.guidance : undefined;

        // Clamp left so popover doesn't overflow viewport
        const popoverWidth = 320;
        let left = popoverRect.left;
        if (left - popoverWidth / 2 < 8) left = popoverWidth / 2 + 8;
        if (left + popoverWidth / 2 > window.innerWidth - 8) left = window.innerWidth - popoverWidth / 2 - 8;

        return (
          <div
            ref={popoverRef}
            className="fixed z-50"
            style={{ top: popoverRect.top, left }}
          >
            {/* Arrow */}
            <div
              className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200"
              style={{ transform: 'translateX(-50%) rotate(45deg)' }}
            />
            <div
              className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 relative"
              style={{ width: popoverWidth, transform: 'translateX(-50%)' }}
            >
              <div className="font-semibold text-sm text-gray-900 mb-3">{stage.name}</div>

              {keyFields.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Fields</div>
                  <div className="grid grid-cols-2 gap-2">
                    {keyFields.map(fieldApi => {
                      const fieldDef = fullFields.find(f => f.apiName === fieldApi);
                      const value = record[fieldApi];
                      return (
                        <div key={fieldApi}>
                          <div className="text-[11px] text-gray-400">{fieldDef?.label || fieldApi}</div>
                          <div className={cn('text-sm font-medium', value ? 'text-gray-900' : 'text-red-500')}>
                            {value != null && value !== '' ? String(value) : '—'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {guidance && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Guidance for Success</div>
                  <div className="text-sm text-gray-600 leading-relaxed">{guidance}</div>
                </div>
              )}

              <button
                onClick={() => handleMarkStage(stage, stageIdx)}
                disabled={updating || stageIdx === effectiveIdx}
                className="w-full py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {stageIdx === effectiveIdx ? 'Current Stage' : 'Mark as Current Stage'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Transition fields modal */}
      {transitionTarget && (() => {
        const allTf = transitionTarget.transitionFields || [];
        const fieldTf = allTf.filter(
          (f): f is PathTransitionField & { fieldApiName: string } =>
            (!f.kind || f.kind === 'field') && typeof f.fieldApiName === 'string'
        );
        const tmTf = allTf.filter(f => f.kind === 'teamMemberFlag' || f.kind === 'teamMemberRole');
        const fieldsValid = fieldTf.every(f => !f.required || (transitionValues[f.fieldApiName]?.trim()));
        const tmValid = tmTf.every(f => !f.required || transitionTmFilled[tmKey(f)] === true);
        const allValid = fieldsValid && tmValid;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full">
              <h3 className="font-semibold text-gray-900 mb-1">
                Moving to {transitionTarget.name}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Please fill in the following before proceeding.
              </p>
              <div className="space-y-3 mb-5">
                {fieldTf.map(f => renderTransitionField(f))}
                {tmTf.map(f => (
                  <PathTmTransitionField
                    key={tmKey(f)}
                    parentObjectApiName={object.apiName}
                    parentRecordId={(record.id as string | undefined) ?? null}
                    tf={f}
                    onFilledChange={(filled) =>
                      setTransitionTmFilled(prev =>
                        prev[tmKey(f)] === filled ? prev : { ...prev, [tmKey(f)]: filled }
                      )
                    }
                  />
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setTransitionTarget(null); setTransitionValues({}); }}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTransitionSubmit}
                  disabled={!allValid || updating}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? 'Saving...' : `Move to ${transitionTarget.name}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Backward confirmation dialog */}
      {confirmBack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Move backward?</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to move back to <strong>{confirmBack.name}</strong>?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmBack(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => advanceToStage(confirmBack)}
                className="px-3 py-1.5 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen from closed state confirmation */}
      {confirmReopen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Reopen this record?</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will change the status from <strong>{isWon ? 'Closed Won' : 'Closed Lost'}</strong> and
              move to <strong>{confirmReopen.name}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmReopen(null)}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => advanceToStage(confirmReopen)}
                className="px-3 py-1.5 text-sm font-medium text-white rounded-md"
                style={{ backgroundColor: isWon ? '#16a34a' : '#dc2626' }}
              >
                Reopen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
