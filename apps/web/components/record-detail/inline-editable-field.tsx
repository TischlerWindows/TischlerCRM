'use client';

import { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import type { FieldDef } from '@/lib/schema';
import { useInlineEdit } from './inline-edit-context';
import { useSchemaStore } from '@/lib/schema-store';
import { recordsService } from '@/lib/records-service';
import { apiClient } from '@/lib/api-client';
import {
  PicklistInput,
  MultiPicklistInput,
  PicklistTextInput,
  DropdownWithCustomInput,
  PicklistTextDropdown,
  filterPicklistValues,
} from '../form/picklist-fields';
import { LookupSearch, LookupUserSearch, getLookupTargetApi, getRecordLabel } from '../form/lookup-search';
import type { VisibilityContext } from '@/lib/field-visibility';

/**
 * Field types safe to edit inline. Excluded: computed/system types
 * (AutoNumber, Formula, RollupSummary, AutoUser, LookupFields), the
 * TeamMemberSlot widget, DropboxFiles, and Geolocation/LocationSearch (need
 * a map UI) — those keep their existing view-only rendering and still
 * require the full Edit form.
 */
const INLINE_EDITABLE_TYPES = new Set<string>([
  'Text', 'TextArea', 'LongTextArea', 'RichTextArea', 'EncryptedText',
  'Number', 'Currency', 'Percent',
  'Email', 'Phone', 'URL',
  'Date', 'DateTime', 'Time',
  'Checkbox',
  'Picklist', 'MultiPicklist', 'MultiSelectPicklist', 'PicklistText', 'DropdownWithCustom',
  'Lookup', 'ExternalLookup', 'LookupUser', 'PicklistLookup',
  'Address', 'CompositeText',
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

  const { editingAll, getDraft, setDraft, cancelEditAll, saveAll, startEditAll } = inlineEdit;

  if (editingAll) {
    const draft = getDraft(fieldDef.apiName, value ?? (fieldDef.type === 'Checkbox' ? false : ''));
    const handleKeyDown = (e: React.KeyboardEvent) => {
      const isMultilineOrComplex = [
        'TextArea', 'LongTextArea', 'RichTextArea', 'Address', 'CompositeText',
        'Lookup', 'ExternalLookup', 'LookupUser', 'PicklistLookup',
      ].includes(fieldDef.type);
      if (e.key === 'Enter' && !isMultilineOrComplex) {
        e.preventDefault();
        void saveAll();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelEditAll();
      }
    };
    return (
      <div className="min-w-0">
        <FieldEditor
          fieldDef={fieldDef}
          draft={draft}
          setDraft={(v) => setDraft(fieldDef.apiName, v)}
          onKeyDown={handleKeyDown}
        />
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

const NO_VISIBILITY_CTX: VisibilityContext = {};

function FieldEditor({
  fieldDef,
  draft,
  setDraft,
  onKeyDown,
}: {
  fieldDef: FieldDef;
  draft: unknown;
  setDraft: (v: unknown) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}): React.ReactNode {
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
        />
      );

    // Dependent-picklist filtering normally reads other CURRENT field values
    // via `formData` — inline editing doesn't have the full record's live
    // draft state wired through, so it passes an empty context, which
    // `filterPicklistValues` treats the same as "no controlling value set"
    // and shows every option (a disclosed simplification, not a bug).
    case 'Picklist':
      return (
        <PicklistInput
          fieldDef={fieldDef}
          value={draft}
          onChange={setDraft}
          formData={{}}
          visibilityCtx={NO_VISIBILITY_CTX}
        />
      );
    case 'MultiPicklist':
    case 'MultiSelectPicklist':
      return (
        <MultiPicklistInput
          fieldDef={fieldDef}
          value={draft}
          onChange={setDraft}
          formData={{}}
          visibilityCtx={NO_VISIBILITY_CTX}
        />
      );
    case 'PicklistText':
      return (
        <PicklistTextInput
          fieldDef={fieldDef}
          value={draft}
          onChange={setDraft}
          formData={{}}
          visibilityCtx={NO_VISIBILITY_CTX}
        />
      );
    case 'DropdownWithCustom':
      return (
        <DropdownWithCustomInput
          fieldDef={fieldDef}
          value={draft}
          onChange={setDraft}
          formData={{}}
          visibilityCtx={NO_VISIBILITY_CTX}
        />
      );

    case 'Lookup':
    case 'ExternalLookup':
      return <InlineLookupEditor fieldDef={fieldDef} value={draft} onChange={setDraft} />;
    case 'LookupUser':
      return <InlineLookupUserEditor fieldDef={fieldDef} value={draft} onChange={setDraft} />;
    case 'PicklistLookup':
      return <InlinePicklistLookupEditor fieldDef={fieldDef} value={draft} onChange={setDraft} />;

    case 'Address':
      return <InlineAddressEditor value={draft} onChange={setDraft} />;
    case 'CompositeText':
      return <InlineCompositeTextEditor fieldDef={fieldDef} value={draft} onChange={setDraft} />;

    case 'TextArea':
    case 'LongTextArea':
      return (
        <textarea
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={3}
          className={common}
        />
      );
    case 'RichTextArea':
      return (
        <textarea
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={6}
          className={common}
        />
      );
    case 'EncryptedText':
      return (
        <input
          type="password"
          value={typeof draft === 'string' ? draft : ''}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          className={common}
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
        />
      );
  }
}

// ── Lookup fetch helpers ─────────────────────────────────────────────

/** Fetches and flattens up to 200 candidate records for a lookup target
 * object. Kept local to each editor instance (not shared/cached) since
 * inline edits are short-lived — simplicity over reuse here. */
function useLookupCandidates(targetApi: string | undefined) {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!targetApi) return;
    let cancelled = false;
    recordsService
      .getRecords(targetApi, { limit: 200 })
      .then((raw) => {
        if (!cancelled) setRecords(recordsService.flattenRecords(raw));
      })
      .catch((err) => {
        console.error(`Failed to load ${targetApi} records for inline lookup:`, err);
      });
    return () => {
      cancelled = true;
    };
  }, [targetApi]);

  return records;
}

function useLookupUserCandidates() {
  const [records, setRecords] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get<any[]>('/admin/users')
      .then((users) => {
        if (!cancelled) setRecords(Array.isArray(users) ? users : []);
      })
      .catch((err) => {
        console.error('Failed to load users for inline lookup:', err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return records;
}

function InlineLookupEditor({
  fieldDef,
  value,
  onChange,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
}) {
  const { schema } = useSchemaStore();
  const targetApi = getLookupTargetApi(fieldDef, [], schema?.objects);
  const records = useLookupCandidates(targetApi);
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);

  return (
    <LookupSearch
      fieldDef={fieldDef}
      value={value}
      onChange={onChange}
      records={records}
      lookupQuery={query}
      isActive={isActive}
      onQueryChange={setQuery}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      schemaObjects={schema?.objects}
    />
  );
}

function InlineLookupUserEditor({
  fieldDef,
  value,
  onChange,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
}) {
  const userRecords = useLookupUserCandidates();
  const [query, setQuery] = useState('');
  const [isActive, setIsActive] = useState(false);

  return (
    <LookupUserSearch
      fieldDef={fieldDef}
      value={value}
      onChange={onChange}
      userRecords={userRecords}
      lookupQuery={query}
      isActive={isActive}
      onQueryChange={setQuery}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
    />
  );
}

function InlinePicklistLookupEditor({
  fieldDef,
  value,
  onChange,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
}) {
  const { schema } = useSchemaStore();
  const targetApi = getLookupTargetApi(fieldDef, [], schema?.objects);
  const records = useLookupCandidates(targetApi);
  const [query, setQuery] = useState('');

  const plkValue = typeof value === 'object' && value !== null ? value : { picklist: '', lookup: '' };
  const options = filterPicklistValues(fieldDef.picklistValues || [], fieldDef, {}, NO_VISIBILITY_CTX);
  const colors = (fieldDef as any).picklistColors as Record<string, string> | undefined;

  const selectedRecord = plkValue.lookup
    ? records.find((r) => String(r.id) === String(plkValue.lookup))
    : null;
  const filteredRecords = records.filter((r) => {
    if (!query) return true;
    const label = getRecordLabel(r);
    return typeof label === 'string' && label.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="flex flex-col gap-1.5">
      <PicklistTextDropdown
        options={options}
        value={plkValue.picklist || ''}
        onChange={(val) => onChange({ ...plkValue, picklist: val })}
        colors={colors}
      />
      <div className="relative">
        <input
          type="text"
          value={selectedRecord ? getRecordLabel(selectedRecord) : query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange({ ...plkValue, lookup: '' });
          }}
          placeholder="Search..."
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
        {query && !selectedRecord && (
          <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filteredRecords.slice(0, 20).map((r) => (
              <button
                type="button"
                key={r.id}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100"
                onClick={() => {
                  onChange({ ...plkValue, lookup: r.id });
                  setQuery('');
                }}
              >
                {getRecordLabel(r)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Address ────────────────────────────────────────────────────────

const ADDRESS_SUBFIELDS: Array<{ key: string; label: string }> = [
  { key: 'street', label: 'Street' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'postalCode', label: 'Postal Code' },
  { key: 'country', label: 'Country' },
];

function InlineAddressEditor({ value, onChange }: { value: any; onChange: (val: any) => void }) {
  const addr = typeof value === 'object' && value !== null ? value : {};
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {ADDRESS_SUBFIELDS.map(({ key, label }) => (
        <input
          key={key}
          type="text"
          value={addr[key] || ''}
          onChange={(e) => onChange({ ...addr, [key]: e.target.value })}
          placeholder={label}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      ))}
    </div>
  );
}

// ── CompositeText ──────────────────────────────────────────────────

function InlineCompositeTextEditor({
  fieldDef,
  value,
  onChange,
}: {
  fieldDef: FieldDef;
  value: any;
  onChange: (val: any) => void;
}) {
  const composite = typeof value === 'object' && value !== null ? value : {};
  const subFields = fieldDef.subFields ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      {subFields.map((sf) => (
        <input
          key={sf.apiName}
          type="text"
          value={composite[sf.apiName] || ''}
          onChange={(e) => onChange({ ...composite, [sf.apiName]: e.target.value })}
          placeholder={sf.label}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      ))}
    </div>
  );
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
