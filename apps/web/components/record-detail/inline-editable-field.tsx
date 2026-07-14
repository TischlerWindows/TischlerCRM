'use client';

import { useState } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import type { FieldDef } from '@/lib/schema';
import { recordsService } from '@/lib/records-service';
import { useToast } from '@/components/toast';
import { cn } from '@/lib/utils';

/**
 * Field types safe to edit inline (a simple, single-value input/select).
 * Everything else (Lookup, MultiPicklist, RichTextArea, Address,
 * CompositeText, AutoNumber, Formula, RollupSummary, TeamMemberSlot, etc.)
 * keeps its existing view-only rendering and still requires the full Edit
 * form, since those need specialized UI this lightweight editor can't
 * reasonably replicate.
 */
const INLINE_EDITABLE_TYPES = new Set<string>([
  'Text', 'TextArea', 'LongTextArea',
  'Number', 'Currency', 'Percent',
  'Email', 'Phone', 'URL',
  'Date', 'DateTime', 'Time',
  'Checkbox', 'Picklist',
]);

export function isInlineEditableField(fieldDef: FieldDef | undefined, readOnly?: boolean): boolean {
  if (!fieldDef) return false;
  if (readOnly) return false;
  if ((fieldDef as any).readOnly) return false;
  return INLINE_EDITABLE_TYPES.has(fieldDef.type);
}

interface InlineEditableFieldProps {
  objectApiName: string;
  recordId: string | undefined;
  fieldDef: FieldDef;
  /** Current raw (unformatted) value, used to seed the editor. */
  value: unknown;
  /** The normally-rendered read-only display (e.g. <MemoizedFieldValue />). */
  children: React.ReactNode;
  /** Called after a successful save so the parent can update its local record state. */
  onSaved: (apiName: string, newValue: unknown) => void;
}

/**
 * Wraps a field's read-only display with a hover-revealed pencil icon.
 * Clicking it swaps the display for a type-appropriate inline input, with
 * Save/Cancel controls (or Enter/Escape) — saving PATCHes just this one
 * field via recordsService.updateRecord instead of opening the full Edit form.
 */
export function InlineEditableField({ objectApiName, recordId, fieldDef, value, children, onSaved }: InlineEditableFieldProps) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<unknown>(value);
  const [saving, setSaving] = useState(false);

  if (!isInlineEditableField(fieldDef) || !recordId) {
    return <>{children}</>;
  }

  const startEdit = () => {
    setDraft(value ?? (fieldDef.type === 'Checkbox' ? false : ''));
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    setSaving(true);
    try {
      await recordsService.updateRecord(objectApiName, recordId, { data: { [fieldDef.apiName]: draft } });
      onSaved(fieldDef.apiName, draft);
      setEditing(false);
    } catch (err: any) {
      showToast(err?.message || `Failed to save ${fieldDef.label}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && fieldDef.type !== 'TextArea' && fieldDef.type !== 'LongTextArea') {
      e.preventDefault();
      void save();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  };

  if (editing) {
    return (
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">{renderEditor(fieldDef, draft, setDraft, handleKeyDown)}</div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            aria-label={`Save ${fieldDef.label}`}
            className="rounded p-1 text-green-600 hover:bg-green-50 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            aria-label="Cancel"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group/inline-edit flex items-center gap-1.5">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={startEdit}
        aria-label={`Edit ${fieldDef.label}`}
        className={cn(
          'shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity',
          'hover:bg-gray-100 hover:text-brand-navy group-hover/inline-edit:opacity-100 focus-visible:opacity-100',
        )}
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}

function renderEditor(
  fieldDef: FieldDef,
  draft: unknown,
  setDraft: (v: unknown) => void,
  onKeyDown: (e: React.KeyboardEvent) => void,
): React.ReactNode {
  const common =
    'w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy';

  switch (fieldDef.type) {
    case 'Checkbox':
      return (
        <input
          type="checkbox"
          checked={!!draft}
          onChange={(e) => setDraft(e.target.checked)}
          onKeyDown={onKeyDown}
          className="h-4 w-4 rounded border-gray-300"
          autoFocus
        />
      );
    case 'Picklist':
      return (
        <select
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        >
          <option value="">—</option>
          {(fieldDef.picklistValues ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case 'TextArea':
    case 'LongTextArea':
      return (
        <textarea
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          className={common}
          autoFocus
        />
      );
    case 'Number':
    case 'Currency':
    case 'Percent':
      return (
        <input
          type="number"
          value={draft === '' || draft === null || draft === undefined ? '' : Number(draft)}
          onChange={(e) => setDraft(e.target.value === '' ? '' : Number(e.target.value))}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    case 'Date':
      return (
        <input
          type="date"
          value={toDateInputValue(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    case 'DateTime':
      return (
        <input
          type="datetime-local"
          value={toDateTimeInputValue(draft)}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    case 'Time':
      return (
        <input
          type="time"
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    case 'Email':
      return (
        <input
          type="email"
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    case 'Phone':
      return (
        <input
          type="tel"
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    case 'URL':
      return (
        <input
          type="url"
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
    default:
      return (
        <input
          type="text"
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
          autoFocus
        />
      );
  }
}

function toDateInputValue(v: unknown): string {
  if (!v) return '';
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : '';
}

function toDateTimeInputValue(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
