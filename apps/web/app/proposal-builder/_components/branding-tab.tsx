'use client';

import {
  AlertCircle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowUpFromLine,
  ArrowDownFromLine,
  GripVertical,
  Image as ImageIcon,
  Loader2,
  Plus,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  parsePageSelector,
  isSelectorError,
  type PageLogoRule,
} from '@crm/types';
import { apiClient } from '@/lib/api-client';

interface BrandLogoRef {
  id: string;
  name: string;
  role: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  updatedAt: string;
}

interface Props {
  templateId: string | null;
  initialRules: PageLogoRule[];
  onSaved: (rules: PageLogoRule[]) => void;
}

const apiBase = (): string =>
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function newRuleId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `rule_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function defaultRule(logoId: string, order: number): PageLogoRule {
  return {
    id: newRuleId(),
    pageSelector: 'first',
    logoId,
    position: 'header',
    alignment: 'left',
    maxWidthPt: 300,
    maxHeightPt: 70,
    order,
  };
}

function describeSelector(input: string, fallback = 'No pages'): string {
  const parsed = parsePageSelector(input);
  if (isSelectorError(parsed)) return fallback;
  switch (parsed.kind) {
    case 'first':
      return 'Page 1 only';
    case 'last':
      return 'Final page only';
    case 'rest':
      return 'Pages not matched by any other rule';
    case 'all':
      return 'Every page';
    case 'even':
      return 'Every even page (2, 4, 6, …)';
    case 'odd':
      return 'Every odd page (1, 3, 5, …)';
    case 'single':
      return `Page ${parsed.page} only`;
    case 'range':
      return `Pages ${parsed.from}–${parsed.to}`;
  }
}

export function BrandingTab({ templateId, initialRules, onSaved }: Props) {
  const [rules, setRules] = useState<PageLogoRule[]>(initialRules);
  const [logos, setLogos] = useState<BrandLogoRef[]>([]);
  const [loadingLogos, setLoadingLogos] = useState(true);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const initialRef = useRef<string>(JSON.stringify(initialRules));

  useEffect(() => {
    setRules(initialRules);
    initialRef.current = JSON.stringify(initialRules);
  }, [initialRules]);

  useEffect(() => {
    let cancelled = false;
    setLoadingLogos(true);
    apiClient
      .get<BrandLogoRef[]>('/company-resources/logos')
      .then((rows) => {
        if (!cancelled) setLogos(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLogoError(
            err instanceof Error ? err.message : 'Failed to load logos',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLogos(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(rules) !== initialRef.current,
    [rules],
  );

  const updateRule = useCallback(
    (id: string, patch: Partial<PageLogoRule>) => {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [],
  );

  const addRule = useCallback(() => {
    const firstLogo = logos[0];
    if (!firstLogo) return;
    setRules((prev) => [...prev, defaultRule(firstLogo.id, prev.length)]);
  }, [logos]);

  const deleteRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.filter((r) => r.id !== id).map((r, i) => ({ ...r, order: i })),
    );
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, overIdx: number) => {
      e.preventDefault();
      if (dragIdx === null || dragIdx === overIdx) return;
      setRules((prev) => {
        const next = [...prev];
        const [moved] = next.splice(dragIdx, 1);
        next.splice(overIdx, 0, moved);
        return next.map((r, i) => ({ ...r, order: i }));
      });
      setDragIdx(overIdx);
    },
    [dragIdx],
  );

  const onSave = useCallback(async () => {
    if (!templateId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await apiClient.patch(`/quote-templates/${templateId}/page-logos`, {
        pageLogos: rules,
      });
      initialRef.current = JSON.stringify(rules);
      onSaved(rules);
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to save page logos',
      );
    } finally {
      setSaving(false);
    }
  }, [templateId, rules, onSaved]);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-100">
      <div className="mx-auto my-6 max-w-4xl px-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Per-page logo placement
            </h2>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed max-w-2xl">
              Drop a different logo on each page of the proposal. Use{' '}
              <SelectorChip>first</SelectorChip>,{' '}
              <SelectorChip>last</SelectorChip>,{' '}
              <SelectorChip>rest</SelectorChip>,{' '}
              <SelectorChip>all</SelectorChip>,{' '}
              <SelectorChip>even</SelectorChip>,{' '}
              <SelectorChip>odd</SelectorChip>, a single page number like{' '}
              <SelectorChip>3</SelectorChip>, or a range like{' '}
              <SelectorChip>2-5</SelectorChip>. Rules later in the list paint
              on top of earlier ones.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || saving || !templateId}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#151f6d] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1e3a5f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              'Save'
            )}
            {!saving && (isDirty ? ' changes' : ' (no changes)')}
          </button>
        </div>

        {logoError && (
          <Banner kind="error">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {logoError}
          </Banner>
        )}
        {saveError && (
          <Banner kind="error">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
            {saveError}
          </Banner>
        )}

        {loadingLogos ? (
          <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-400">
            <Loader2 className="mx-auto mb-2 h-4 w-4 animate-spin" />
            Loading logos…
          </div>
        ) : logos.length === 0 ? (
          <EmptyLogos />
        ) : (
          <>
            <ul className="space-y-2">
              {rules.map((rule, idx) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  logos={logos}
                  isDragging={dragIdx === idx}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={() => setDragIdx(null)}
                  onChange={(patch) => updateRule(rule.id, patch)}
                  onDelete={() => deleteRule(rule.id)}
                />
              ))}
            </ul>

            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={addRule}
                className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add rule
              </button>
              <a
                href="/settings/company-resources"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
              >
                Upload new logo
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {rules.length === 0 && (
              <p className="mt-4 text-center text-xs text-gray-400">
                No rules yet — the renderer will fall back to the text wordmark
                on page 1. Add a rule to place a logo.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  logos,
  isDragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onChange,
  onDelete,
}: {
  rule: PageLogoRule;
  logos: BrandLogoRef[];
  isDragging: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onChange: (patch: Partial<PageLogoRule>) => void;
  onDelete: () => void;
}) {
  const parsed = parsePageSelector(rule.pageSelector);
  const selectorOk = !isSelectorError(parsed);
  const logo = logos.find((l) => l.id === rule.logoId);

  return (
    <li
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`group flex items-stretch gap-3 rounded-lg border bg-white p-3 shadow-sm transition-shadow ${
        isDragging
          ? 'border-[#151f6d] ring-1 ring-[#151f6d]/30'
          : 'border-gray-200 hover:shadow-md'
      }`}
    >
      <div className="flex items-center text-gray-300 group-hover:text-gray-500 cursor-grab active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </div>

      {/* Logo thumbnail */}
      <div className="flex h-16 w-20 flex-shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 p-1">
        {logo ? (
          <img
            src={`${apiBase()}/company-resources/logos/${logo.id}/bytes?v=${encodeURIComponent(logo.updatedAt)}`}
            alt={logo.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-gray-300" aria-hidden="true" />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 min-w-0">
        {/* Row 1: page selector + logo picker */}
        <div className="flex items-center gap-2">
          <label className="flex-1 min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Pages
            </span>
            <input
              type="text"
              value={rule.pageSelector}
              onChange={(e) => onChange({ pageSelector: e.target.value })}
              placeholder="first / rest / 2-5"
              className={`mt-0.5 w-full rounded-md border px-2 py-1 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 ${
                selectorOk
                  ? 'border-gray-300 focus:ring-[#151f6d]/30'
                  : 'border-red-400 focus:ring-red-300'
              }`}
            />
            <span
              className={`mt-0.5 block text-[10px] ${
                selectorOk ? 'text-gray-400' : 'text-red-500'
              }`}
            >
              {selectorOk
                ? describeSelector(rule.pageSelector)
                : (parsed as { error: string }).error}
            </span>
          </label>

          <label className="flex-[2] min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Logo
            </span>
            <select
              value={rule.logoId}
              onChange={(e) => onChange({ logoId: e.target.value })}
              className="mt-0.5 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#151f6d]/30"
            >
              {logos.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.role ? `${l.name} · ${l.role}` : l.name}
                </option>
              ))}
            </select>
            <span className="mt-0.5 block text-[10px] text-gray-400">
              {logo
                ? `${logo.width ?? '?'} × ${logo.height ?? '?'} px`
                : 'Logo not found — pick another'}
            </span>
          </label>
        </div>

        {/* Row 2: position + alignment + size + delete */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Position
            </span>
            <div className="mt-0.5 inline-flex overflow-hidden rounded-md border border-gray-300">
              <PositionButton
                active={rule.position === 'header'}
                onClick={() => onChange({ position: 'header' })}
                title="Header (top of page)"
              >
                <ArrowUpFromLine className="h-3.5 w-3.5" />
              </PositionButton>
              <PositionButton
                active={rule.position === 'footer'}
                onClick={() => onChange({ position: 'footer' })}
                title="Footer (bottom of page)"
              >
                <ArrowDownFromLine className="h-3.5 w-3.5" />
              </PositionButton>
            </div>
          </div>

          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Align
            </span>
            <div className="mt-0.5 inline-flex overflow-hidden rounded-md border border-gray-300">
              <AlignButton
                active={rule.alignment === 'left'}
                onClick={() => onChange({ alignment: 'left' })}
                title="Left"
              >
                <AlignLeft className="h-3.5 w-3.5" />
              </AlignButton>
              <AlignButton
                active={rule.alignment === 'center'}
                onClick={() => onChange({ alignment: 'center' })}
                title="Center"
              >
                <AlignCenter className="h-3.5 w-3.5" />
              </AlignButton>
              <AlignButton
                active={rule.alignment === 'right'}
                onClick={() => onChange({ alignment: 'right' })}
                title="Right"
              >
                <AlignRight className="h-3.5 w-3.5" />
              </AlignButton>
            </div>
          </div>

          <SizeInput
            label="W"
            value={rule.maxWidthPt}
            onChange={(v) => onChange({ maxWidthPt: v })}
          />
          <SizeInput
            label="H"
            value={rule.maxHeightPt}
            onChange={(v) => onChange({ maxHeightPt: v })}
          />

          <span className="text-[10px] text-gray-400 ml-1">pt (1pt ≈ 1/72&quot;)</span>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md border border-transparent px-2 py-1 text-xs text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete rule"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function PositionButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-[#151f6d] text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function AlignButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`px-2 py-1 text-xs transition-colors ${
        active
          ? 'bg-[#151f6d] text-white'
          : 'bg-white text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  );
}

function SizeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      <input
        type="number"
        min={24}
        max={600}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="mt-0.5 w-16 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#151f6d]/30"
      />
    </label>
  );
}

function SelectorChip({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[11px] text-gray-700">
      {children}
    </code>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: 'error' | 'info';
  children: React.ReactNode;
}) {
  const cls =
    kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-blue-200 bg-blue-50 text-blue-700';
  return (
    <div
      role="alert"
      className={`mb-3 inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${cls}`}
    >
      {children}
    </div>
  );
}

function EmptyLogos() {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
      <ImageIcon className="mx-auto mb-2 h-6 w-6 text-gray-300" aria-hidden="true" />
      <p className="text-sm font-medium text-gray-700">No logos uploaded yet</p>
      <p className="mt-1 text-xs text-gray-500">
        Upload at least one brand logo to start placing it on proposal pages.
      </p>
      <a
        href="/settings/company-resources"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[#151f6d] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1e3a5f]"
      >
        Upload logos
        <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}
