'use client';

import { Pencil } from 'lucide-react';
import type { FieldDef } from '@/lib/schema';
import { useInlineEdit } from './inline-edit-context';

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
  fieldDef: FieldDef;
  /** Current raw (unformatted) value, used to seed the editor. */
  value: unknown;
  /** The normally-rendered read-only display (e.g. <MemoizedFieldValue />). */
  children: React.ReactNode;
}

/**
 * Wraps a field's read-only display with an always-visible pencil icon.
 * Clicking ANY field's pencil switches every inline-editable field on the
 * record into edit mode at once (via the shared InlineEditProvider context)
 * — there's no per-field Save/Cancel; one umbrella <InlineEditToolbar>
 * commits (or discards) every field's draft in a single batched update.
 */
export function InlineEditableField({ fieldDef, value, children }: InlineEditableFieldProps) {
  const inlineEdit = useInlineEdit();

  if (!inlineEdit || !isInlineEditableField(fieldDef)) {
    return <>{children}</>;
  }

  const { editingAll, getDraft, setDraft, startEditAll, cancelEditAll, saveAll } = inlineEdit;

  if (editingAll) {
    const draft = getDraft(fieldDef.apiName, value ?? (fieldDef.type === 'Checkbox' ? false : ''));
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && fieldDef.type !== 'TextArea' && fieldDef.type !== 'LongTextArea') {
        e.preventDefault();
        void saveAll();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditAll();
      }
    };
    return (
      <div className="min-w-0">
        {renderEditor(fieldDef, draft, (v) => setDraft(fieldDef.apiName, v), handleKeyDown)}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="min-w-0 flex-1">{children}</div>
      <button
        type="button"
        onClick={startEditAll}
        aria-label={`Edit ${fieldDef.label}`}
        className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand-navy"
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
