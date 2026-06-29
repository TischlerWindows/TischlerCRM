'use client';

import { useState } from 'react';
import { Filter, Plus, Trash2, Save, X, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { useSchemaStore } from '@/lib/schema-store';
import { cn } from '@/lib/utils';
import type { FieldDef, PicklistDependencyRule, ConditionExpr } from '@/lib/schema';

interface ConditionalFormattingProps {
  objectApiName: string;
}

// ── Types ─────────────────────────────────────────────────────────

interface RuleSetDraft {
  /** api name of the picklist field whose values get filtered */
  dependentFieldApiName: string;
  /** api name of the field that controls which values show */
  controllingFieldApiName: string;
  /** matrix[controllingValue] = list of allowed dependent values */
  matrix: Record<string, string[]>;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Extract existing matrix for a (dependent field, controlling field) pair */
function extractMatrix(
  field: FieldDef,
  controllingFieldApiName: string,
): Record<string, string[]> {
  const matrix: Record<string, string[]> = {};
  for (const rule of field.picklistDependencies ?? []) {
    if (
      rule.conditions.length === 1 &&
      rule.conditions[0].left === controllingFieldApiName &&
      rule.conditions[0].op === '=='
    ) {
      matrix[rule.conditions[0].right] = rule.values;
    }
  }
  return matrix;
}

/** Rules on `field` that are NOT managed by the given controlling field */
function otherRules(field: FieldDef, controllingFieldApiName: string): PicklistDependencyRule[] {
  return (field.picklistDependencies ?? []).filter(
    (r) =>
      !(
        r.conditions.length === 1 &&
        r.conditions[0].left === controllingFieldApiName &&
        r.conditions[0].op === '=='
      ),
  );
}

/** Convert the matrix back to PicklistDependencyRule[] */
function matrixToRules(
  controllingFieldApiName: string,
  matrix: Record<string, string[]>,
): PicklistDependencyRule[] {
  return Object.entries(matrix)
    .filter(([, vals]) => vals.length > 0)
    .map(([controllingValue, vals]) => ({
      conditions: [{ left: controllingFieldApiName, op: '==' as const, right: controllingValue }],
      values: vals,
    }));
}

/** Describe what rules exist on a field, grouped by controlling field */
function summarizeRules(
  field: FieldDef,
  allFields: FieldDef[],
): { controllingFieldApiName: string; controllingFieldLabel: string; controlledValuesCount: number }[] {
  const map: Record<string, Set<string>> = {};
  for (const rule of field.picklistDependencies ?? []) {
    for (const cond of rule.conditions) {
      if (cond.op === '==') {
        if (!map[cond.left]) map[cond.left] = new Set();
        rule.values.forEach((v) => map[cond.left].add(v));
      }
    }
  }
  return Object.entries(map).map(([api, vals]) => {
    const f = allFields.find((x) => x.apiName === api);
    return {
      controllingFieldApiName: api,
      controllingFieldLabel: f?.label ?? api,
      controlledValuesCount: vals.size,
    };
  });
}

// ── Matrix editor ─────────────────────────────────────────────────

function MatrixEditor({
  draft,
  dependentField,
  controllingField,
  onChange,
}: {
  draft: RuleSetDraft;
  dependentField: FieldDef;
  controllingField: FieldDef;
  onChange: (matrix: Record<string, string[]>) => void;
}) {
  const controllingValues = controllingField.picklistValues ?? [];
  const dependentValues = dependentField.picklistValues ?? [];

  if (controllingValues.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        The controlling field has no picklist values defined. Add values to it first.
      </p>
    );
  }

  if (dependentValues.length === 0) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        The dependent field has no picklist values defined. Add values to it first.
      </p>
    );
  }

  const toggle = (controllingValue: string, depValue: string) => {
    const current = draft.matrix[controllingValue] ?? [];
    const next = current.includes(depValue)
      ? current.filter((v) => v !== depValue)
      : [...current, depValue];
    onChange({ ...draft.matrix, [controllingValue]: next });
  };

  const toggleAllForRow = (controllingValue: string) => {
    const current = draft.matrix[controllingValue] ?? [];
    const allSelected = dependentValues.every((v) => current.includes(v));
    onChange({ ...draft.matrix, [controllingValue]: allSelected ? [] : [...dependentValues] });
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {/* row header column */}
            <th className="text-left px-3 py-2 bg-gray-50 border border-gray-200 font-medium text-gray-700 min-w-[140px]">
              {controllingField.label} →
            </th>
            {dependentValues.map((depVal) => (
              <th
                key={depVal}
                className="px-2 py-2 bg-gray-50 border border-gray-200 font-medium text-gray-700 text-center whitespace-nowrap max-w-[120px]"
              >
                <span className="block truncate text-xs" title={depVal}>
                  {depVal}
                </span>
              </th>
            ))}
            <th className="px-2 py-2 bg-gray-50 border border-gray-200 text-center text-xs text-gray-500">
              All
            </th>
          </tr>
        </thead>
        <tbody>
          {controllingValues.map((ctrlVal, rowIdx) => {
            const selected = draft.matrix[ctrlVal] ?? [];
            const allChecked = dependentValues.every((v) => selected.includes(v));
            const someChecked = dependentValues.some((v) => selected.includes(v));

            return (
              <tr key={ctrlVal} className={cn(rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60')}>
                <td className="px-3 py-2 border border-gray-200 font-medium text-gray-800 whitespace-nowrap">
                  {ctrlVal}
                </td>
                {dependentValues.map((depVal) => (
                  <td key={depVal} className="border border-gray-200 text-center p-0">
                    <button
                      type="button"
                      onClick={() => toggle(ctrlVal, depVal)}
                      className={cn(
                        'w-full h-full flex items-center justify-center py-2 transition-colors',
                        selected.includes(depVal)
                          ? 'bg-brand-navy/10 hover:bg-brand-navy/20'
                          : 'hover:bg-gray-100',
                      )}
                      aria-label={`${selected.includes(depVal) ? 'Remove' : 'Allow'} ${depVal} when ${controllingField.label} is ${ctrlVal}`}
                    >
                      <div
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center',
                          selected.includes(depVal)
                            ? 'bg-brand-navy border-brand-navy'
                            : 'border-gray-300',
                        )}
                      >
                        {selected.includes(depVal) && <Check className="w-3 h-3 text-white" />}
                      </div>
                    </button>
                  </td>
                ))}
                {/* All toggle */}
                <td className="border border-gray-200 text-center p-0">
                  <button
                    type="button"
                    onClick={() => toggleAllForRow(ctrlVal)}
                    className="w-full h-full flex items-center justify-center py-2 hover:bg-gray-100 transition-colors"
                    aria-label={`Toggle all for ${ctrlVal}`}
                  >
                    <div
                      className={cn(
                        'w-4 h-4 rounded border flex items-center justify-center',
                        allChecked
                          ? 'bg-brand-navy border-brand-navy'
                          : someChecked
                          ? 'bg-brand-navy/40 border-brand-navy/40'
                          : 'border-gray-300',
                      )}
                    >
                      {(allChecked || someChecked) && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-gray-500">
        Checked = option is visible. Unchecked = hidden when controlling field has that value.
        Values not governed by any row are always visible.
      </p>
    </div>
  );
}

// ── Rule set card ─────────────────────────────────────────────────

function RuleSetCard({
  dependentField,
  controllingFieldApiName,
  allFields,
  onEdit,
  onDelete,
}: {
  dependentField: FieldDef;
  controllingFieldApiName: string;
  allFields: FieldDef[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const controllingField = allFields.find((f) => f.apiName === controllingFieldApiName);
  const rules = (dependentField.picklistDependencies ?? []).filter(
    (r) =>
      r.conditions.length === 1 &&
      r.conditions[0].left === controllingFieldApiName &&
      r.conditions[0].op === '==',
  );

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-gray-900">
            {dependentField.label}{' '}
            <span className="text-gray-400 font-normal">depends on</span>{' '}
            {controllingField?.label ?? controllingFieldApiName}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {rules.length} controlling value{rules.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="px-3 py-1.5 text-sm font-medium text-brand-navy border border-brand-navy/30 rounded-lg hover:bg-brand-navy/5 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
            aria-label="Delete rule set"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Editor panel ──────────────────────────────────────────────────

function EditorPanel({
  draft,
  allFields,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  draft: RuleSetDraft;
  allFields: FieldDef[];
  onSave: (draft: RuleSetDraft) => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  const [local, setLocal] = useState<RuleSetDraft>(draft);

  const picklistFields = allFields.filter(
    (f) => (f.type === 'Picklist' || f.type === 'MultiSelectPicklist' || f.type === 'DropdownWithCustom') && !f.readOnly,
  );

  const dependentField = allFields.find((f) => f.apiName === local.dependentFieldApiName);
  const controllingField = allFields.find((f) => f.apiName === local.controllingFieldApiName);

  // When controlling field changes, reset matrix
  const handleControllingChange = (api: string) => {
    const field = allFields.find((f) => f.apiName === api);
    if (!field) return;
    const depField = allFields.find((f) => f.apiName === local.dependentFieldApiName);
    const existing = depField ? extractMatrix(depField, api) : {};
    setLocal((prev) => ({ ...prev, controllingFieldApiName: api, matrix: existing }));
  };

  // When dependent field changes, load existing rules
  const handleDependentChange = (api: string) => {
    const depField = allFields.find((f) => f.apiName === api);
    const existing = depField && local.controllingFieldApiName
      ? extractMatrix(depField, local.controllingFieldApiName)
      : {};
    setLocal((prev) => ({ ...prev, dependentFieldApiName: api, matrix: existing }));
  };

  const canSave = local.dependentFieldApiName && local.controllingFieldApiName && local.dependentFieldApiName !== local.controllingFieldApiName;

  return (
    <div className="bg-white border border-brand-navy/20 rounded-xl p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          {isNew ? 'New Dependency Rule' : 'Edit Dependency Rule'}
        </h3>
        <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600 rounded">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dependent Field</label>
          <p className="text-xs text-gray-500 mb-1.5">This field's options will be filtered</p>
          <select
            value={local.dependentFieldApiName}
            onChange={(e) => handleDependentChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy outline-none"
          >
            <option value="">Select a picklist field…</option>
            {picklistFields.map((f) => (
              <option key={f.apiName} value={f.apiName}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Controlling Field</label>
          <p className="text-xs text-gray-500 mb-1.5">Its value determines which options appear</p>
          <select
            value={local.controllingFieldApiName}
            onChange={(e) => handleControllingChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-brand-navy/20 focus:border-brand-navy outline-none"
          >
            <option value="">Select a field…</option>
            {allFields
              .filter(
                (f) =>
                  (f.type === 'Picklist' || f.type === 'DropdownWithCustom') &&
                  f.apiName !== local.dependentFieldApiName,
              )
              .map((f) => (
                <option key={f.apiName} value={f.apiName}>
                  {f.label}
                </option>
              ))}
          </select>
        </div>
      </div>

      {dependentField && controllingField && (
        <>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Configure which <strong>{dependentField.label}</strong> values appear for each{' '}
              <strong>{controllingField.label}</strong> value
            </h4>
            <MatrixEditor
              draft={local}
              dependentField={dependentField}
              controllingField={controllingField}
              onChange={(matrix) => setLocal((prev) => ({ ...prev, matrix }))}
            />
          </div>
        </>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSave(local)}
          disabled={!canSave || saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Rules'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function ConditionalFormatting({ objectApiName }: ConditionalFormattingProps) {
  const { schema, updateField, saving } = useSchemaStore();
  const object = schema?.objects.find((o) => o.apiName === objectApiName);

  const [editing, setEditing] = useState<RuleSetDraft | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!object) return null;

  const allFields = object.fields.filter((f) => !['Id', 'CreatedDate', 'LastModifiedDate', 'CreatedById', 'LastModifiedById'].includes(f.apiName));

  // Collect all (dependentFieldApiName, controllingFieldApiName) pairs that already have rules
  const existingPairs: { dep: FieldDef; ctrl: string }[] = [];
  for (const field of allFields) {
    if (
      (field.type !== 'Picklist' && field.type !== 'MultiSelectPicklist' && field.type !== 'DropdownWithCustom') ||
      !field.picklistDependencies?.length
    ) continue;
    const ctrlFields = new Set<string>();
    for (const rule of field.picklistDependencies) {
      for (const cond of rule.conditions) {
        if (cond.op === '==') ctrlFields.add(cond.left);
      }
    }
    for (const ctrl of ctrlFields) {
      existingPairs.push({ dep: field, ctrl });
    }
  }

  const handleNew = () => {
    setEditing({ dependentFieldApiName: '', controllingFieldApiName: '', matrix: {} });
    setIsNew(true);
  };

  const handleEdit = (dep: FieldDef, ctrlApi: string) => {
    const matrix = extractMatrix(dep, ctrlApi);
    setEditing({ dependentFieldApiName: dep.apiName, controllingFieldApiName: ctrlApi, matrix });
    setIsNew(false);
  };

  const handleDelete = (dep: FieldDef, ctrlApi: string) => {
    const remaining = otherRules(dep, ctrlApi);
    updateField(objectApiName, dep.apiName, {
      picklistDependencies: remaining.length > 0 ? remaining : [],
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSave = (draft: RuleSetDraft) => {
    if (!draft.dependentFieldApiName || !draft.controllingFieldApiName) return;

    const depField = allFields.find((f) => f.apiName === draft.dependentFieldApiName);
    if (!depField) return;

    const preserved = otherRules(depField, draft.controllingFieldApiName);
    const newRules = matrixToRules(draft.controllingFieldApiName, draft.matrix);

    updateField(objectApiName, draft.dependentFieldApiName, {
      picklistDependencies: [...preserved, ...newRules],
    });

    setEditing(null);
    setIsNew(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="px-6 py-6 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
            <Filter className="w-5 h-5 text-brand-navy" />
            Conditional Field Formatting
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Filter picklist options dynamically based on the value of another field.
            When a controlling field changes, the dependent field only shows the allowed options.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNew}
          disabled={!!editing}
          className="flex items-center gap-2 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy/90 disabled:opacity-40 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </button>
      </div>

      {/* Saved banner */}
      {saved && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-2 text-sm">
          <Check className="w-4 h-4" />
          Rules saved successfully.
        </div>
      )}

      {/* Editor */}
      {editing && (
        <EditorPanel
          draft={editing}
          allFields={allFields}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsNew(false); }}
          saving={saving}
          isNew={isNew}
        />
      )}

      {/* Existing rule sets */}
      {existingPairs.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700 uppercase tracking-wider">
            Configured Rules
          </h3>
          {existingPairs.map(({ dep, ctrl }) => (
            <RuleSetCard
              key={`${dep.apiName}__${ctrl}`}
              dependentField={dep}
              controllingFieldApiName={ctrl}
              allFields={allFields}
              onEdit={() => handleEdit(dep, ctrl)}
              onDelete={() => handleDelete(dep, ctrl)}
            />
          ))}
        </div>
      ) : (
        !editing && (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <Filter className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No conditional rules yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Click <strong>New Rule</strong> to control which picklist options appear based on
              another field's value.
            </p>
          </div>
        )
      )}
    </div>
  );
}
