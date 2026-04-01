'use client';

import React from 'react';
import type { FormattingRule } from '@/lib/schema';

interface RulePreviewProps {
  rule: FormattingRule;
}

const badgeColorMap: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  destructive: 'bg-red-100 text-red-800 border-red-200',
};

const highlightColorMap: Record<string, string> = {
  subtle: 'bg-gray-50 border-gray-200',
  attention: 'bg-amber-50 border-amber-200',
  positive: 'bg-emerald-50 border-emerald-200',
  critical: 'bg-red-50 border-red-200',
};

export function RulePreview({ rule }: RulePreviewProps) {
  const { effects } = rule;
  const hasBadge = !!effects.badge;
  const hasHighlight = !!effects.highlightToken && effects.highlightToken !== 'none';
  const hasAnyVisualEffect = hasBadge || hasHighlight || effects.hidden || effects.readOnly;

  if (!hasAnyVisualEffect) {
    return (
      <div className="rounded-md border border-dashed border-gray-300 p-3 text-xs text-gray-500">
        No visual effects configured. Select effects above to see a preview.
      </div>
    );
  }

  const highlightClass = hasHighlight
    ? highlightColorMap[effects.highlightToken!] ?? ''
    : '';

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-700">Preview</p>
      <div
        className={`rounded-md border p-3 ${highlightClass || 'border-gray-200 bg-white'}`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`text-sm ${effects.hidden ? 'line-through text-gray-400' : 'text-gray-900'} ${effects.readOnly ? 'italic' : ''}`}
          >
            Sample field value
          </span>
          {hasBadge && (
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${badgeColorMap[effects.badge!] ?? ''}`}
            >
              {effects.badge}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
          {effects.hidden && <span>Hidden</span>}
          {effects.readOnly && <span>Read-only</span>}
          {hasHighlight && <span>Highlight: {effects.highlightToken}</span>}
        </div>
      </div>
    </div>
  );
}
