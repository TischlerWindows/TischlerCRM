'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Check, Star, X } from 'lucide-react';
import type { WidgetProps } from '@/lib/widgets/types';
import type { PathDef, PathStage } from '@/lib/schema';
import { useSchemaStore } from '@/lib/schema-store';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export default function PathWidget({ config, record, object }: WidgetProps) {
  const schema = useSchemaStore((s) => s.schema);
  const pathId = config.pathId as string;
  const showLabel = (config.showLabel as boolean) ?? true;
  const showGuidance = (config.showGuidance as boolean) ?? true;
  const showKeyFields = (config.showKeyFields as boolean) ?? true;
  const compact = (config.compact as boolean) ?? false;

  const [popoverStageId, setPopoverStageId] = useState<string | null>(null);
  const [confirmBack, setConfirmBack] = useState<PathStage | null>(null);
  const [updating, setUpdating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Find the path definition from schema
  const objectDef = schema?.objects.find(o => o.apiName === object.apiName);
  const pathDef = objectDef?.paths?.find(p => p.id === pathId);

  // Close popover on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverStageId(null);
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

  async function advanceToStage(stage: PathStage) {
    if (updating) return;
    const recordId = record.id as string;
    if (!recordId) return;

    setUpdating(true);
    try {
      await apiClient.updateRecord(object.apiName, recordId, {
        [pathDef!.trackingFieldApiName]: stage.id,
      });
      // Update the record in-place so the UI re-renders immediately
      record[pathDef!.trackingFieldApiName] = stage.id;
    } finally {
      setUpdating(false);
      setPopoverStageId(null);
      setConfirmBack(null);
    }
  }

  function handleStageClick(stage: PathStage, idx: number) {
    if (compact) {
      // Compact mode: click directly advances/reverts
      if (idx < effectiveIdx) {
        setConfirmBack(stage);
      } else {
        advanceToStage(stage);
      }
    } else {
      setPopoverStageId(popoverStageId === stage.id ? null : stage.id);
    }
  }

  function handleMarkStage(stage: PathStage, idx: number) {
    if (idx < effectiveIdx) {
      setConfirmBack(stage);
    } else {
      advanceToStage(stage);
    }
  }

  // Determine visual state label
  let statusLabel = '';
  if (isWon) statusLabel = 'Closed Won';
  if (isLost) statusLabel = 'Closed Lost';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
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

          let bg = '';
          let text = '';
          let icon: React.ReactNode = null;

          if (isClosed) {
            // Terminal state coloring
            if (isWon) {
              if (isCompleted) { bg = 'bg-green-900'; text = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
              else if (isCurrent && isClosedWonStage) { bg = 'bg-green-500'; text = 'text-white font-bold'; icon = <Star className="w-3 h-3 mr-0.5" />; }
              else { bg = 'bg-gray-100'; text = 'text-gray-300'; }
            } else {
              if (isCompleted) { bg = 'bg-red-900'; text = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
              else if (isCurrent && isClosedLostStage) { bg = 'bg-red-500'; text = 'text-white font-bold'; icon = <X className="w-3 h-3 mr-0.5" />; }
              else { bg = 'bg-gray-100'; text = 'text-gray-300'; }
            }
          } else {
            // Active state coloring
            if (isCompleted) { bg = 'bg-[#1e3a5f]'; text = 'text-white'; icon = <Check className="w-3 h-3 mr-0.5" />; }
            else if (isCurrent) { bg = 'bg-blue-500'; text = 'text-white font-semibold'; }
            else if (isClosedWonStage && isFuture) { bg = 'bg-green-50'; text = 'text-green-700'; }
            else if (isClosedLostStage && isFuture) { bg = 'bg-red-50'; text = 'text-red-700'; }
            else { bg = 'bg-gray-200'; text = 'text-gray-600'; }
          }

          const clipFirst = 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)';
          const clipMiddle = 'polygon(10px 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 10px 100%, 0 50%)';
          const clipLast = 'polygon(10px 0, 100% 0, 100% 100%, 0 100%, 10px 100%, 0 50%)';
          const clipPath = isFirst ? clipFirst : isLast ? clipLast : clipMiddle;

          return (
            <div
              key={stage.id}
              className={cn(
                'flex-1 flex items-center justify-center text-xs cursor-pointer transition-opacity relative',
                bg, text,
                !isFirst && '-ml-1.5',
                (isClosedWonStage || isClosedLostStage) && 'flex-[0.8]',
                updating && 'opacity-60 pointer-events-none',
              )}
              style={{ clipPath }}
              onClick={() => handleStageClick(stage, idx)}
            >
              <span className="flex items-center gap-0.5 px-2 truncate">
                {icon}
                {stage.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Popover */}
      {!compact && popoverStageId && (() => {
        const stage = sortedStages.find(s => s.id === popoverStageId);
        const stageIdx = sortedStages.findIndex(s => s.id === popoverStageId);
        if (!stage) return null;
        const keyFields = (showKeyFields && stage.keyFields) || [];
        const guidance = showGuidance ? stage.guidance : undefined;

        return (
          <div ref={popoverRef} className="relative mt-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
              <div className="font-semibold text-sm text-gray-900 mb-3">{stage.name}</div>

              {keyFields.length > 0 && (
                <div className="mb-3">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Fields</div>
                  <div className="grid grid-cols-2 gap-2">
                    {keyFields.map(fieldApi => {
                      const fieldDef = object.fields.find(f => f.apiName === fieldApi);
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
    </div>
  );
}
