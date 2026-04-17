'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  LifeBuoy,
  GripVertical,
  Plus,
  Trash2,
  Loader2,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import {
  categoriesClient,
  CATEGORY_COLORS,
  CATEGORY_COLOR_CLASSES,
  type CategoryColor,
  type OrphanInfo,
  type TicketCategory,
} from '@/lib/support-ticket-categories-client';

interface Row extends TicketCategory {
  _uiId: string;
}

function makeUiId() {
  return Math.random().toString(36).slice(2);
}

function slugKey(label: string): string {
  const k = label.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return k || 'CATEGORY';
}

export default function SupportTicketSettingsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [orphans, setOrphans] = useState<OrphanInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSavedAt, setJustSavedAt] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<{
    index: number;
    orphan: OrphanInfo | null;
  } | null>(null);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const { items, orphans: orphanList } = await categoriesClient.listAdmin();
      setRows(items.map((i) => ({ ...i, _uiId: makeUiId() })));
      setOrphans(orphanList);
      setDirty(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (index: number, patch: Partial<TicketCategory>) => {
    setRows((prev) => {
      const next = prev.slice();
      const cur = next[index];
      if (!cur) return prev;
      next[index] = { ...cur, ...patch };
      return next;
    });
    setDirty(true);
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `CATEGORY_${prev.length + 1}`,
        label: '',
        color: 'gray',
        order: prev.length + 1,
        _uiId: makeUiId(),
      },
    ]);
    setDirty(true);
  };

  const requestDelete = (index: number) => {
    const row = rows[index];
    if (!row) return;
    const orphan = orphans.find((o) => o.key === row.key) ?? null;
    setPendingDelete({ index, orphan });
  };

  const confirmDelete = () => {
    if (pendingDelete == null) return;
    setRows((prev) => prev.filter((_, i) => i !== pendingDelete.index));
    setDirty(true);
    setPendingDelete(null);
  };

  const handleDragStart = (idx: number) => setDragFromIndex(idx);

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragFromIndex == null || dragFromIndex === idx) return;
    setRows((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(dragFromIndex, 1);
      if (!moved) return prev;
      next.splice(idx, 0, moved);
      return next.map((r, i) => ({ ...r, order: i + 1 }));
    });
    setDragFromIndex(idx);
    setDirty(true);
  };

  const handleDragEnd = () => setDragFromIndex(null);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: TicketCategory[] = rows.map((r, i) => ({
        key: r.key.trim() || slugKey(r.label),
        label: r.label.trim(),
        color: r.color,
        order: i + 1,
      }));
      const { items, orphans: nextOrphans } = await categoriesClient.save(payload);
      setRows(items.map((c) => ({ ...c, _uiId: makeUiId() })));
      setOrphans(nextOrphans);
      setDirty(false);
      setJustSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-navy" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-8 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center">
            <LifeBuoy className="w-6 h-6 text-sky-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">Support Tickets</h1>
            <p className="text-sm text-brand-gray mt-0.5">
              Manage the category list that users pick from when they submit a ticket.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {dirty && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">You have unsaved changes.</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-gray-50 text-brand-dark/80"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-brand-navy text-white rounded-md hover:bg-brand-navy-light flex items-center gap-2"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save changes
            </button>
          </div>
        </div>
      )}

      {justSavedAt && !dirty && Date.now() - justSavedAt < 3000 && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex items-center gap-2 text-sm text-emerald-800">
          <Check className="w-4 h-4" /> Saved.
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-gray mb-3">
          Categories
        </h2>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <ul>
            {rows.map((row, idx) => {
              const orphan = orphans.find((o) => o.key === row.key);
              return (
                <li
                  key={row._uiId}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-100 last:border-b-0"
                >
                  <GripVertical className="w-4 h-4 text-gray-400 cursor-move flex-shrink-0" />
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => updateRow(idx, { label: e.target.value })}
                    onBlur={(e) => {
                      if (!row.key || row.key.startsWith('CATEGORY_')) {
                        updateRow(idx, { key: slugKey(e.target.value) });
                      }
                    }}
                    placeholder="Label"
                    className="flex-1 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/30"
                  />
                  <span className="font-mono text-[11px] text-gray-500 w-40 truncate" title={row.key}>
                    {row.key}
                  </span>
                  <select
                    value={row.color}
                    onChange={(e) => updateRow(idx, { color: e.target.value as CategoryColor })}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm bg-white"
                  >
                    {CATEGORY_COLORS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLOR_CLASSES[row.color]}`}
                  >
                    Preview
                  </span>
                  {orphan && (
                    <span
                      className="text-[10px] text-amber-700 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded"
                      title={`${orphan.ticketCount} ticket(s) use this key`}
                    >
                      {orphan.ticketCount} in use
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => requestDelete(idx)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50/70">
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-brand-navy hover:text-brand-red"
            >
              <Plus className="w-4 h-4" /> Add category
            </button>
          </div>
        </div>
      </section>

      {pendingDelete && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setPendingDelete(null)}
        >
          <div
            className="bg-white rounded-lg w-full max-w-md mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-brand-dark">Delete category?</h3>
            </div>
            <div className="px-5 py-4 text-sm text-brand-dark/80 space-y-2">
              <p>
                The category will be removed from the picklist. This does not change any existing
                tickets that already use this key.
              </p>
              {pendingDelete.orphan && pendingDelete.orphan.ticketCount > 0 && (
                <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <strong>{pendingDelete.orphan.ticketCount} ticket(s)</strong> still use this category.
                  They&apos;ll show the key as a greyed &ldquo;(deleted)&rdquo; pill until an admin
                  re-categorizes them.
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 text-sm font-medium border border-gray-300 rounded-md hover:bg-gray-50 text-brand-dark/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
