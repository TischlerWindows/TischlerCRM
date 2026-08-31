'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { recordsService } from '@/lib/records-service';
import { useToast } from '@/components/toast';
import type { TeamMemberSlotHandle } from '@/widgets/internal/team-member-slot/TeamMemberSlotField';

interface InlineEditContextValue {
  /** True once any field's pencil icon has been clicked — every inline-editable
   * field on the record switches into edit mode simultaneously. */
  editingAll: boolean;
  saving: boolean;
  /** Snapshot of all current draft values — merging this into the visibility
   * context makes conditional-formatting react live while inline editing. */
  drafts: Record<string, unknown>;
  getDraft: (apiName: string, fallback: unknown) => unknown;
  setDraft: (apiName: string, value: unknown) => void;
  startEditAll: () => void;
  cancelEditAll: () => void;
  saveAll: () => Promise<void>;
  /** Returns a stable ref for a TeamMemberSlot field (creating it on first
   * call). Slot widgets render in `staged` mode during bulk edit — they
   * buffer changes locally instead of saving immediately — and `saveAll()`
   * calls each registered ref's `applyChanges()` to actually persist them. */
  registerSlotRef: (apiName: string) => React.RefObject<TeamMemberSlotHandle>;
}

const InlineEditContext = createContext<InlineEditContextValue | null>(null);

/** Returns null when not inside an <InlineEditProvider> — callers use this
 * to decide whether inline editing is enabled at all in this render tree. */
export function useInlineEdit(): InlineEditContextValue | null {
  return useContext(InlineEditContext);
}

interface InlineEditProviderProps {
  objectApiName: string;
  recordId: string | undefined;
  /** Called once after a successful bulk save with every changed field's new value. */
  onSaved: (changed: Record<string, unknown>) => void;
  children: React.ReactNode;
}

/**
 * Coordinates "edit every inline-editable field at once" across all
 * <InlineEditableField> instances rendered beneath it. Clicking any single
 * field's pencil icon puts every field on the record into edit mode; one
 * umbrella Save/Cancel (rendered via <InlineEditToolbar>) commits every
 * field's draft in a single batched update, or discards them all.
 */
/** The app's main content area scrolls internally (#app-scroll-container in
 * app-wrapper.tsx) — the browser window itself never scrolls. Falls back to
 * the window/documentElement so this still works outside that layout. */
function getScrollContainer(): HTMLElement | { scrollTop: number } {
  const el = typeof document !== 'undefined' ? document.getElementById('app-scroll-container') : null;
  if (el) return el;
  const root = typeof document !== 'undefined' ? (document.scrollingElement as HTMLElement | null) : null;
  return root ?? { scrollTop: 0 };
}

export function InlineEditProvider({ objectApiName, recordId, onSaved, children }: InlineEditProviderProps) {
  const { showToast } = useToast();
  const [editingAll, setEditingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const slotRefsRef = useRef<Map<string, React.RefObject<TeamMemberSlotHandle>>>(new Map());
  // Scroll position captured the moment editing starts. Entering/exiting bulk
  // edit mode changes every field's rendered height at once (editable controls
  // are taller than the compact read-only display), which shifts content above
  // the current viewport and moves the page even though the user didn't scroll.
  // Restoring to THIS single anchor on both start and end (rather than a value
  // re-captured at cancel/save time, which would already reflect the shifted/
  // taller edit-mode layout) keeps the view visually stationary end-to-end.
  const scrollAnchorRef = useRef<number | null>(null);

  const registerSlotRef = useCallback((apiName: string) => {
    if (!slotRefsRef.current.has(apiName)) {
      slotRefsRef.current.set(apiName, { current: null });
    }
    return slotRefsRef.current.get(apiName)!;
  }, []);

  const getDraft = useCallback(
    (apiName: string, fallback: unknown) => (apiName in drafts ? drafts[apiName] : fallback),
    [drafts],
  );

  const setDraft = useCallback((apiName: string, value: unknown) => {
    setDrafts((prev) => ({ ...prev, [apiName]: value }));
  }, []);

  const startEditAll = useCallback(() => {
    const container = getScrollContainer();
    const y = container.scrollTop;
    scrollAnchorRef.current = y;
    setDrafts({});
    setEditingAll(true);
    requestAnimationFrame(() => { container.scrollTop = y; });
  }, []);

  const cancelEditAll = useCallback(() => {
    const container = getScrollContainer();
    const y = scrollAnchorRef.current ?? container.scrollTop;
    setDrafts({});
    setEditingAll(false);
    requestAnimationFrame(() => { container.scrollTop = y; });
  }, []);

  const saveAll = useCallback(async () => {
    if (!recordId) return;
    const container = getScrollContainer();
    const scrollY = scrollAnchorRef.current ?? container.scrollTop;
    setSaving(true);
    try {
      if (Object.keys(drafts).length > 0) {
        // Records store field values under the BARE key (the API strips the
        // "ObjectName__" prefix on write) — dynamic-form.tsx's regular save
        // path already does this stripping before submitting. Drafts here
        // are keyed by the field's raw schema apiName, which for
        // pre-existing prefixed fields (e.g. "Project__architect_contact")
        // still has that prefix. Sending it as-is silently wrote to the
        // wrong key, so the record looked unchanged after Save — the value
        // reads back to a comparison test. Newer "__c"-suffixed fields
        // (e.g. "Architect__c") have no leading prefix to strip, so they
        // were unaffected by this specific mismatch.
        const bareDrafts: Record<string, unknown> = {};
        for (const [apiName, val] of Object.entries(drafts)) {
          bareDrafts[apiName.replace(/^[A-Za-z]+__/, '')] = val;
        }
        await recordsService.updateRecord(objectApiName, recordId, { data: bareDrafts });
        onSaved(drafts);
      }
      // Apply any staged TeamMemberSlot changes now that the main record save
      // (if any) succeeded — mirrors the full edit form's save sequence.
      for (const slotRef of slotRefsRef.current.values()) {
        if (slotRef.current?.applyChanges) {
          await slotRef.current.applyChanges();
        }
      }
      setDrafts({});
      setEditingAll(false);
      requestAnimationFrame(() => { container.scrollTop = scrollY; });
    } catch (err: any) {
      showToast(err?.message || 'Failed to save changes', 'error');
    } finally {
      setSaving(false);
    }
  }, [objectApiName, recordId, drafts, onSaved, showToast]);

  const value = useMemo<InlineEditContextValue>(
    () => ({ editingAll, saving, drafts, getDraft, setDraft, startEditAll, cancelEditAll, saveAll, registerSlotRef }),
    [editingAll, saving, drafts, getDraft, setDraft, startEditAll, cancelEditAll, saveAll, registerSlotRef],
  );

  return <InlineEditContext.Provider value={value}>{children}</InlineEditContext.Provider>;
}

/** Fixed bottom "Save" / "Cancel" bar shown only once bulk edit mode is active. */
export function InlineEditToolbar() {
  const ctx = useInlineEdit();
  if (!ctx || !ctx.editingAll) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-brand-navy/20 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <div className="relative flex items-center justify-center">
        <span className="absolute left-0 text-base font-medium text-brand-navy">Editing fields&hellip;</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={ctx.cancelEditAll}
            disabled={ctx.saving}
            className="min-w-[160px] rounded-lg border border-gray-300 bg-white px-10 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void ctx.saveAll()}
            disabled={ctx.saving}
            className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-lg bg-brand-navy px-10 py-3 text-base font-medium text-white hover:bg-brand-navy/90 disabled:opacity-50"
          >
            {ctx.saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** Reserves space at the bottom of the page while <InlineEditToolbar> is
 * fixed over the content, so it doesn't cover the last panel's fields. */
export function InlineEditBottomSpacer() {
  const ctx = useInlineEdit();
  if (!ctx || !ctx.editingAll) return null;
  return <div className="h-20" aria-hidden="true" />;
}
