'use client';

import { AlertCircle, AlertTriangle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ProposalAssemblyResult, SpecPresetData } from '@crm/proposal-assembly';

export type LintSeverity = 'error' | 'warning';

interface LintIssue {
  id: string;
  severity: LintSeverity;
  presetId: string;
  presetTitle: string;
  message: string;
}

interface Props {
  presets: SpecPresetData[];
  result: ProposalAssemblyResult | null;
  onSelectBlock: (presetId: string) => void;
}

const STORAGE_KEY = 'proposalBuilder.lintPanelExpanded';

function deriveIssues(presets: SpecPresetData[], result: ProposalAssemblyResult | null): LintIssue[] {
  const issues: LintIssue[] = [];
  const titleFor = (presetId: string): string => {
    const p = presets.find((pp) => pp.id === presetId);
    return p?.title || '(untitled)';
  };

  // Empty active simple blocks — render as blank paragraphs which is rarely intentional.
  for (const p of presets) {
    if (!p.isActive) continue;
    if (p.driverField) {
      const variants = p.variants ?? [];
      const activeVariants = variants.filter((v) => v.isActive !== false);
      const universalBody = typeof (p.config as Record<string, unknown> | null)?.universalBody === 'string'
        ? ((p.config as Record<string, unknown>).universalBody as string).trim()
        : '';
      if (activeVariants.length === 0 && !universalBody) {
        issues.push({
          id: `no-variants:${p.id}`,
          severity: 'error',
          presetId: p.id,
          presetTitle: p.title,
          message: `Variant block has no active variants — nothing will render.`,
        });
      }
    } else if (!p.body || !p.body.trim()) {
      issues.push({
        id: `empty-body:${p.id}`,
        severity: 'warning',
        presetId: p.id,
        presetTitle: p.title,
        message: `Body is empty — block will render a blank paragraph.`,
      });
    }
  }

  // Unresolved tokens from the assembly run (depends on the active summary).
  if (result?.unresolvedTokens) {
    const seen = new Set<string>();
    for (const u of result.unresolvedTokens) {
      const key = `unresolved:${u.presetId}:${u.token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        id: key,
        severity: 'warning',
        presetId: u.presetId,
        presetTitle: titleFor(u.presetId),
        message: `Token {{${u.token}}} could not be resolved — add a mapping or remove it.`,
      });
    }
  }

  return issues;
}

export function LintPanel({ presets, result, onSelectBlock }: Props) {
  const issues = useMemo(() => deriveIssues(presets, result), [presets, result]);

  const [expanded, setExpanded] = useState<boolean>(true);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) setExpanded(raw === 'true');
    } catch {
      // ignore
    }
  }, []);
  const toggle = () => {
    setExpanded((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (issues.length === 0) return null;

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.length - errorCount;
  const summary =
    [
      errorCount > 0 ? `${errorCount} error${errorCount === 1 ? '' : 's'}` : null,
      warningCount > 0 ? `${warningCount} warning${warningCount === 1 ? '' : 's'}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || `${issues.length} issues`;

  return (
    <div
      role="region"
      aria-label="Proposal builder lints"
      className={`shrink-0 border-b ${
        errorCount > 0
          ? 'border-red-200 bg-red-50/60'
          : 'border-amber-200 bg-amber-50/60'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium text-gray-700 hover:bg-black/[0.02] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-navy/30"
      >
        {errorCount > 0 ? (
          <AlertCircle aria-hidden="true" className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
        ) : (
          <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
        )}
        <span className="flex-1 text-left">
          {summary}
          <span className="ml-1 text-gray-500 font-normal">in proposal blocks</span>
        </span>
        {expanded ? (
          <ChevronUp aria-hidden="true" className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-gray-400" />
        )}
      </button>
      {expanded && (
        <ul role="list" className="max-h-44 overflow-y-auto px-2 pb-2 space-y-1">
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => onSelectBlock(issue.presetId)}
                className={`w-full flex items-start gap-2 px-2 py-1.5 text-left text-[11px] rounded border focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-navy/30 ${
                  issue.severity === 'error'
                    ? 'border-red-200 bg-white hover:bg-red-50'
                    : 'border-amber-200 bg-white hover:bg-amber-50'
                }`}
              >
                {issue.severity === 'error' ? (
                  <AlertCircle
                    aria-hidden="true"
                    className="w-3 h-3 mt-0.5 text-red-600 flex-shrink-0"
                  />
                ) : (
                  <AlertTriangle
                    aria-hidden="true"
                    className="w-3 h-3 mt-0.5 text-amber-600 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 truncate font-medium">{issue.presetTitle}</div>
                  <div className="text-gray-600 truncate">{issue.message}</div>
                </div>
                <X aria-hidden="true" className="opacity-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
