'use client';

import { useState, useEffect } from 'react';
import { Search, GripVertical, Star, Type, X, Check, AlertCircle } from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type { FieldDef, ObjectDef } from '@/lib/schema';

interface SearchSettingsProps {
  objectApiName: string;
}

export default function SearchSettings({ objectApiName }: SearchSettingsProps) {
  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find(o => o.apiName === objectApiName);

  const [enabled, setEnabled] = useState(false);
  const [searchableFields, setSearchableFields] = useState<string[]>([]);
  const [titleField, setTitleField] = useState<string>('');
  const [subtitleFields, setSubtitleFields] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!object) return;
    const config = object.searchConfig;
    setEnabled(config?.enabled ?? false);
    setSearchableFields(config?.searchableFields ?? []);
    setTitleField(config?.titleField ?? '');
    setSubtitleFields(config?.subtitleFields ?? []);
  }, [object?.apiName]);

  if (!object) return null;

  // Fields eligible for search (text-like types)
  const textTypes = new Set([
    'Text', 'TextArea', 'LongTextArea', 'Email', 'Phone', 'URL',
    'Picklist', 'MultiPicklist', 'MultiSelectPicklist', 'PicklistText',
    'AutoNumber', 'Address', 'CompositeText', 'Number', 'Currency',
  ]);
  const eligibleFields = object.fields.filter(f => textTypes.has(f.type));
  // All fields can be title/subtitle
  const allFields = object.fields;

  const toggleSearchable = (apiName: string) => {
    setSearchableFields(prev =>
      prev.includes(apiName) ? prev.filter(n => n !== apiName) : [...prev, apiName]
    );
  };

  const toggleSubtitle = (apiName: string) => {
    setSubtitleFields(prev =>
      prev.includes(apiName) ? prev.filter(n => n !== apiName) : [...prev, apiName]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateObject(objectApiName, {
        searchConfig: {
          enabled,
          searchableFields,
          titleField: titleField || undefined,
          subtitleFields: subtitleFields.length > 0 ? subtitleFields : undefined,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = (() => {
    const c = object.searchConfig;
    if (!c) return enabled || searchableFields.length > 0;
    return (
      c.enabled !== enabled ||
      JSON.stringify(c.searchableFields || []) !== JSON.stringify(searchableFields) ||
      (c.titleField || '') !== titleField ||
      JSON.stringify(c.subtitleFields || []) !== JSON.stringify(subtitleFields)
    );
  })();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Enable toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f0f1fa] rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-brand-navy" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Global Search</h3>
              <p className="text-xs text-gray-500">Include {object.label} records in the universal search bar</p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
              enabled ? 'bg-brand-navy' : 'bg-gray-300'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                enabled ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      {enabled && (
        <>
          {/* Title field */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Title Field</h3>
            <p className="text-xs text-gray-500 mb-4">
              The primary field shown as the search result title (e.g. Name, Property Number)
            </p>
            <select
              value={titleField}
              onChange={e => setTitleField(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-navy/40"
            >
              <option value="">— Select a field —</option>
              {allFields.map(f => (
                <option key={f.apiName} value={f.apiName}>{f.label} ({f.apiName})</option>
              ))}
            </select>
          </div>

          {/* Subtitle fields */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Subtitle Fields</h3>
            <p className="text-xs text-gray-500 mb-4">
              Fields displayed below the title in search results. Select up to 4.
            </p>
            <div className="space-y-1.5">
              {allFields.map(f => {
                const selected = subtitleFields.includes(f.apiName);
                const disabled = !selected && subtitleFields.length >= 4;
                return (
                  <button
                    key={f.apiName}
                    onClick={() => !disabled && toggleSubtitle(f.apiName)}
                    disabled={disabled}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm',
                      selected
                        ? 'bg-[#f0f1fa] text-brand-navy border border-brand-navy/20'
                        : disabled
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'hover:bg-gray-50 text-gray-700'
                    )}
                  >
                    <div className={cn(
                      'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                      selected ? 'bg-brand-navy border-brand-navy' : 'border-gray-300'
                    )}>
                      {selected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1">{f.label}</span>
                    <span className="text-xs text-gray-400">{f.type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Searchable fields */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Searchable Fields</h3>
            <p className="text-xs text-gray-500 mb-4">
              Fields that are matched against the search query. Only text-compatible field types are shown.
            </p>
            {eligibleFields.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <AlertCircle className="w-4 h-4" />
                No text-compatible fields on this object.
              </div>
            ) : (
              <div className="space-y-1.5">
                {eligibleFields.map(f => {
                  const selected = searchableFields.includes(f.apiName);
                  return (
                    <button
                      key={f.apiName}
                      onClick={() => toggleSearchable(f.apiName)}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors text-sm',
                        selected
                          ? 'bg-[#f0f1fa] text-brand-navy border border-brand-navy/20'
                          : 'hover:bg-gray-50 text-gray-700'
                      )}
                    >
                      <div className={cn(
                        'w-5 h-5 rounded border flex items-center justify-center flex-shrink-0',
                        selected ? 'bg-brand-navy border-brand-navy' : 'border-gray-300'
                      )}>
                        {selected && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <span className="flex-1">{f.label}</span>
                      <span className="text-xs text-gray-400">{f.type}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Save / status bar */}
      <div className="sticky bottom-4 flex items-center justify-between bg-white rounded-2xl border border-gray-200 px-6 py-4 shadow-lg">
        <div>
          {error && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="w-4 h-4" />{error}</p>}
          {saved && <p className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" />Saved</p>}
          {!error && !saved && hasChanges && <p className="text-sm text-amber-600">Unsaved changes</p>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={cn(
            'px-5 py-2 rounded-lg text-sm font-semibold transition-colors',
            hasChanges
              ? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          )}
        >
          {saving ? 'Saving…' : 'Save Search Settings'}
        </button>
      </div>
    </div>
  );
}
