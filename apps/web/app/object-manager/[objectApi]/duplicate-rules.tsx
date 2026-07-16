'use client';

import { useState, useEffect } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';

interface DuplicateRulesProps {
  objectApiName: string;
}

export default function DuplicateRules({ objectApiName }: DuplicateRulesProps) {
  const { schema, updateObject } = useSchemaStore();
  const object = schema?.objects.find(o => o.apiName === objectApiName);

  const [enabled, setEnabled] = useState(false);
  const [matchFields, setMatchFields] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!object) return;
    const rule = object.duplicateRule;
    setEnabled(rule?.enabled ?? false);
    setMatchFields(rule?.matchFields ?? []);
  }, [object?.apiName]);

  if (!object) return null;

  // Only text-like/identifying field types make sense to compare for duplicates.
  const textTypes = new Set([
    'Text', 'TextArea', 'Email', 'Phone', 'URL',
    'Picklist', 'PicklistText', 'AutoNumber', 'CompositeText',
  ]);
  const eligibleFields = object.fields.filter(f => textTypes.has(f.type));

  const toggleMatchField = (apiName: string) => {
    setMatchFields(prev =>
      prev.includes(apiName) ? prev.filter(n => n !== apiName) : [...prev, apiName]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updateObject(objectApiName, {
        duplicateRule: { enabled, matchFields },
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
    const r = object.duplicateRule;
    if (!r) return enabled || matchFields.length > 0;
    return (
      r.enabled !== enabled ||
      JSON.stringify(r.matchFields || []) !== JSON.stringify(matchFields)
    );
  })();

  return (
    <div className="max-w-3xl space-y-6">
      {/* Enable toggle */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#f0f1fa] rounded-lg flex items-center justify-center">
              <Copy className="w-5 h-5 text-brand-navy" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Don&apos;t Allow Duplicates</h3>
              <p className="text-xs text-gray-500">
                Warn users when creating a {object.label} that looks like an existing record
              </p>
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
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Match Fields</h3>
          <p className="text-xs text-gray-500 mb-4">
            When creating a new {object.label}, these fields are compared against existing
            records. A match — exact or a very close near-match (e.g. a typo) — prompts the
            user to confirm before the record is created.
          </p>
          {eligibleFields.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <AlertCircle className="w-4 h-4" />
              No text-compatible fields on this object.
            </div>
          ) : (
            <div className="space-y-1.5">
              {eligibleFields.map(f => {
                const selected = matchFields.includes(f.apiName);
                return (
                  <button
                    key={f.apiName}
                    onClick={() => toggleMatchField(f.apiName)}
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
          {enabled && matchFields.length === 0 && (
            <p className="mt-3 text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> Select at least one field, or duplicate
              checking has nothing to compare.
            </p>
          )}
        </div>
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
          {saving ? 'Saving…' : 'Save Duplicate Rule'}
        </button>
      </div>
    </div>
  );
}
