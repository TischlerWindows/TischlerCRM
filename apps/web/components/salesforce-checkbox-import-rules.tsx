'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { SalesforceCheckboxImportRule } from '@/lib/salesforce-import-templates'

export interface CheckboxImportFieldOption {
  apiName: string
  label: string
}

export function SalesforceCheckboxImportRules({
  headers,
  checkboxFields,
  rules,
  onChange,
}: {
  headers: string[]
  checkboxFields: CheckboxImportFieldOption[]
  rules: SalesforceCheckboxImportRule[]
  onChange: (rules: SalesforceCheckboxImportRule[]) => void
}) {
  const addRule = () => {
    const availableTarget = checkboxFields.find((field) => !rules.some((rule) => rule.targetField === field.apiName))
    if (!availableTarget || headers.length === 0) return
    onChange([...rules, {
      id: crypto.randomUUID(),
      targetField: availableTarget.apiName,
      sourceColumn: headers[0]!,
      condition: 'has-value',
    }])
  }

  if (checkboxFields.length === 0) return null

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Checkbox rules</h3>
          <p className="mt-1 text-xs text-gray-500">
            Set a CRM checkbox from whether a Salesforce source column is populated or blank.
          </p>
        </div>
        <button
          type="button"
          onClick={addRule}
          disabled={!headers.length || rules.length >= checkboxFields.length}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-gray-300 bg-white px-3 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add rule
        </button>
      </div>

      {rules.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">No checkbox rules configured.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rules.map((rule) => {
            const targetOptions = checkboxFields.filter((field) =>
              field.apiName === rule.targetField || !rules.some((other) => other.id !== rule.id && other.targetField === field.apiName),
            )
            return (
              <div key={rule.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_2.25rem]">
                <label className="text-xs font-medium text-gray-700">
                  CRM checkbox
                  <select
                    aria-label="CRM checkbox field"
                    value={rule.targetField}
                    onChange={(event) => onChange(rules.map((item) => item.id === rule.id ? { ...item, targetField: event.target.value } : item))}
                    className="mt-1 block h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
                  >
                    {targetOptions.map((field) => <option key={field.apiName} value={field.apiName}>{field.label}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-gray-700">
                  Salesforce source column
                  <select
                    aria-label="Salesforce source column"
                    value={rule.sourceColumn}
                    onChange={(event) => onChange(rules.map((item) => item.id === rule.id ? { ...item, sourceColumn: event.target.value } : item))}
                    className="mt-1 block h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
                  >
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-gray-700">
                  Check when source is
                  <select
                    aria-label="Checkbox rule condition"
                    value={rule.condition}
                    onChange={(event) => onChange(rules.map((item) => item.id === rule.id ? { ...item, condition: event.target.value as SalesforceCheckboxImportRule['condition'] } : item))}
                    className="mt-1 block h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
                  >
                    <option value="has-value">Populated</option>
                    <option value="is-blank">Blank</option>
                  </select>
                </label>
                <button
                  type="button"
                  aria-label={`Remove checkbox rule for ${rule.targetField}`}
                  title="Remove rule"
                  onClick={() => onChange(rules.filter((item) => item.id !== rule.id))}
                  className="inline-flex h-9 w-9 items-center justify-center self-end rounded border border-gray-300 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
