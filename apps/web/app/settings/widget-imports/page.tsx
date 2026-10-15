'use client'

import { useEffect, useMemo, useState } from 'react'
import Papa from 'papaparse'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { SettingsContentCard } from '@/components/settings/settings-content-card'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { WidgetDataImportTemplateControls } from '@/components/widget-data-import-template-controls'
import { recordsService } from '@/lib/records-service'
import type { ImportUserLookupRecord } from '@/lib/salesforce-import-values'
import {
  buildWidgetImportPayload,
  buildWorkOrderImportIndex,
  getDefaultWidgetFieldMapping,
  getDefaultWorkOrderColumn,
  resolveWorkOrderImportId,
  WIDGET_IMPORT_FIELDS,
  type WidgetImportObject,
  type WorkOrderImportRecord,
} from '@/lib/widget-data-import'

interface PreparedRow {
  rowNumber: number
  data: Record<string, unknown> | null
  errors: string[]
}

interface ImportResult {
  created: number
  errors: Array<{ row: number; error: string }>
}

interface ImportDraft {
  headers: string[]
  rows: Record<string, string>[]
  fileName: string
  workOrderColumn: string
  fieldMapping: Record<string, string>
}

function emptyImportDraft(): ImportDraft {
  return { headers: [], rows: [], fileName: '', workOrderColumn: '', fieldMapping: {} }
}

const OBJECT_LABELS: Record<WidgetImportObject, string> = {
  PunchList: 'Punch List',
  PerDiem: 'Per Diem',
}

export default function WidgetImportsPage() {
  const [objectApiName, setObjectApiName] = useState<WidgetImportObject>('PunchList')
  const [workOrders, setWorkOrders] = useState<WorkOrderImportRecord[]>([])
  const [loadingWorkOrders, setLoadingWorkOrders] = useState(true)
  const [workOrderError, setWorkOrderError] = useState<string | null>(null)
  const [importUsers, setImportUsers] = useState<ImportUserLookupRecord[] | null>(null)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [userLoadError, setUserLoadError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<WidgetImportObject, ImportDraft>>({
    PunchList: emptyImportDraft(),
    PerDiem: emptyImportDraft(),
  })
  const [busy, setBusy] = useState(false)
  const [skipRowsWithIssues, setSkipRowsWithIssues] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const activeDraft = drafts[objectApiName]
  const { headers, rows, fileName, workOrderColumn, fieldMapping } = activeDraft
  const updateDraft = (patch: Partial<ImportDraft>) => {
    setSkipRowsWithIssues(false)
    setDrafts((current) => ({
      ...current,
      [objectApiName]: { ...current[objectApiName], ...patch },
    }))
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingWorkOrders(true)
      setWorkOrderError(null)
      try {
        const allRecords: Record<string, unknown>[] = []
        const pageSize = 200
        for (let offset = 0; ; offset += pageSize) {
          const page = await apiClient.getRecords('WorkOrder', { limit: pageSize, offset })
          allRecords.push(...recordsService.flattenRecords(page))
          if (page.length < pageSize) break
        }
        if (!cancelled) setWorkOrders(allRecords as WorkOrderImportRecord[])
      } catch (cause) {
        if (!cancelled) setWorkOrderError(cause instanceof Error ? cause.message : 'Could not load Work Orders.')
      } finally {
        if (!cancelled) setLoadingWorkOrders(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    void apiClient.get<ImportUserLookupRecord[]>('/users/lookup/import')
      .then((users) => { if (!cancelled) setImportUsers(users) })
      .catch((cause: unknown) => {
        if (!cancelled) setUserLoadError(cause instanceof Error ? cause.message : 'Could not load users.')
      })
      .finally(() => { if (!cancelled) setLoadingUsers(false) })
    return () => { cancelled = true }
  }, [])

  const workOrderIndex = useMemo(() => buildWorkOrderImportIndex(workOrders), [workOrders])
  const preparedRows = useMemo<PreparedRow[]>(() => rows.map((row, index) => {
    const linkedWorkOrder = resolveWorkOrderImportId(row[workOrderColumn] ?? '', workOrderIndex)
    if (!linkedWorkOrder.workOrderId) {
      return { rowNumber: index + 2, data: null, errors: [linkedWorkOrder.error ?? 'Workorder ID could not be resolved.'] }
    }
    const payload = buildWidgetImportPayload({
      objectApiName,
      row,
      workOrderId: linkedWorkOrder.workOrderId,
      fieldMapping,
      users: importUsers ?? [],
    })
    return { rowNumber: index + 2, data: payload.data, errors: payload.errors }
  }), [rows, workOrderColumn, workOrderIndex, objectApiName, fieldMapping, importUsers])

  const importableCount = preparedRows.filter((row) => row.data).length
  const issueCount = preparedRows.reduce((count, row) => count + row.errors.length, 0)
  const skippedRowCount = preparedRows.filter((row) => !row.data).length

  const handleFile = (file?: File) => {
    if (!file) return
    setError(null)
    setResult(null)
    setSkipRowsWithIssues(false)
    updateDraft({ headers: [], rows: [], fileName: '', workOrderColumn: '', fieldMapping: {} })
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (parsed) => {
        const parsedHeaders = parsed.meta.fields ?? []
        if (parsed.errors.length > 0) {
          setError(`Could not parse CSV row ${parsed.errors[0]?.row ?? ''}: ${parsed.errors[0]?.message ?? 'Invalid CSV.'}`)
          return
        }
        if (parsedHeaders.length === 0 || parsed.data.length === 0) {
          setError('The selected CSV has no header row or data rows.')
          return
        }
        updateDraft({
          fileName: file.name,
          headers: parsedHeaders,
          rows: parsed.data,
          workOrderColumn: getDefaultWorkOrderColumn(parsedHeaders),
          fieldMapping: getDefaultWidgetFieldMapping(parsedHeaders, objectApiName),
        })
      },
      error: (cause) => setError(cause.message || 'Could not read the selected CSV.'),
    })
  }

  const changeObject = (nextObject: WidgetImportObject) => {
    setObjectApiName(nextObject)
    setSkipRowsWithIssues(false)
    setResult(null)
    setError(null)
  }

  const applyTemplate = (config: { workOrderColumn: string; fieldMapping: Record<string, string> }) => {
    const availableHeaders = new Set(headers)
    updateDraft({
      workOrderColumn: availableHeaders.has(config.workOrderColumn) ? config.workOrderColumn : '',
      fieldMapping: Object.fromEntries(Object.entries(config.fieldMapping)
        .filter(([, sourceColumn]) => availableHeaders.has(sourceColumn))),
    })
    setSkipRowsWithIssues(false)
    setResult(null)
    setError(null)
  }

  const importRows = async () => {
    if (!workOrderColumn) {
      setError('Select the CSV column containing the Workorder ID.')
      return
    }
    if (skippedRowCount > 0 && !skipRowsWithIssues) {
      setError(`Confirm that you want to skip the ${skippedRowCount} rows that cannot be imported and import the ${importableCount} valid rows.`)
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      if (objectApiName === 'PerDiem' && fieldMapping.serviceTechPerDiem && userLoadError) {
        throw new Error(`Could not load users for Service Tech Per Diem: ${userLoadError}`)
      }

      const errors: ImportResult['errors'] = []
      const validRows: Array<{ rowNumber: number; data: Record<string, unknown> }> = []
      for (const [index, row] of rows.entries()) {
        const rowNumber = index + 2
        const linkedWorkOrder = resolveWorkOrderImportId(row[workOrderColumn] ?? '', workOrderIndex)
        if (!linkedWorkOrder.workOrderId) {
          errors.push({ row: rowNumber, error: linkedWorkOrder.error ?? 'Workorder ID could not be resolved.' })
          continue
        }
        const payload = buildWidgetImportPayload({
          objectApiName,
          row,
          workOrderId: linkedWorkOrder.workOrderId,
          fieldMapping,
          users: importUsers ?? [],
        })
        errors.push(...payload.errors.map((message) => ({ row: rowNumber, error: message })))
        if (payload.data) validRows.push({ rowNumber, data: payload.data })
      }

      let created = 0
      const batchSize = 500
      for (let offset = 0; offset < validRows.length; offset += batchSize) {
        const batch = validRows.slice(offset, offset + batchSize)
        try {
          const response = await apiClient.importRecords(objectApiName, batch.map((row) => row.data))
          created += response.created
          for (const rowError of response.errors) {
            const row = batch[rowError.row - 1]
            errors.push({ row: row?.rowNumber ?? rowError.row, error: rowError.error })
          }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : 'Import batch failed.'
          errors.push(...batch.map((row) => ({ row: row.rowNumber, error: message })))
        }
      }
      setResult({ created, errors })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import widget records.')
    } finally {
      setBusy(false)
    }
  }

  const templateConfig = { workOrderColumn, fieldMapping }

  return (
    <>
      <SettingsPageHeader
        icon={Upload}
        title="Widget Data Import"
        subtitle="Import Punch List or Per Diem rows linked to Work Orders"
      />

      <SettingsContentCard>
        <div className="border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="inline-flex rounded-md border border-gray-300 bg-white p-1" role="group" aria-label="Widget object to import">
            {(['PunchList', 'PerDiem'] as const).map((object) => (
              <button
                key={object}
                type="button"
                aria-pressed={objectApiName === object}
                onClick={() => changeObject(object)}
                disabled={busy}
                className={`rounded px-4 py-2 text-sm font-medium ${objectApiName === object ? 'bg-brand-navy text-white' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                {OBJECT_LABELS[object]}
              </button>
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-600">
            Each CSV row links to an existing Work Order using its record ID or Work Order Number. Rows with missing or ambiguous IDs are skipped.
          </p>
        </div>

        <div className="space-y-5 p-4 sm:p-6">
          {workOrderError && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{workOrderError}</div>}
          {objectApiName === 'PerDiem' && userLoadError && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">Could not load users for Service Tech Per Diem: {userLoadError}</div>}
          {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <FileSpreadsheet className="h-4 w-4" />
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => {
                  handleFile(event.target.files?.[0])
                  event.target.value = ''
                }}
              />
            </label>
            {fileName && <span className="text-sm text-gray-600">{fileName} · {rows.length} rows</span>}
            {(loadingWorkOrders || (objectApiName === 'PerDiem' && loadingUsers)) && <span className="inline-flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />{loadingWorkOrders ? 'Loading Work Orders' : 'Loading users'}</span>}
            {!loadingWorkOrders && !workOrderError && <span className="text-sm text-gray-500">{workOrders.length} Work Orders available</span>}
          </div>

          {headers.length > 0 && (
            <>
              <WidgetDataImportTemplateControls
                objectApiName={objectApiName}
                config={templateConfig}
                onApply={applyTemplate}
              />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-gray-700">
                  Workorder ID column <span className="text-red-600">*</span>
                  <select
                    value={workOrderColumn}
                    onChange={(event) => updateDraft({ workOrderColumn: event.target.value })}
                    className="mt-1 block h-10 w-full rounded border border-gray-300 bg-white px-3 text-sm"
                  >
                    <option value="">Select CSV column</option>
                    {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                  </select>
                </label>
                <div className="flex items-end pb-2 text-sm text-gray-600">
                  {importableCount} rows ready · {issueCount} row issue{issueCount === 1 ? '' : 's'}
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-gray-200">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr><th className="px-3 py-2">{OBJECT_LABELS[objectApiName]} field</th><th className="px-3 py-2">CSV column</th><th className="px-3 py-2">Sample</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {WIDGET_IMPORT_FIELDS[objectApiName].map((field) => (
                      <tr key={field.apiName}>
                        <th className="px-3 py-2 font-medium text-gray-800">{field.label}</th>
                        <td className="px-3 py-2">
                          <select
                            aria-label={`CSV column for ${field.label}`}
                            value={fieldMapping[field.apiName] ?? ''}
                            onChange={(event) => updateDraft({ fieldMapping: { ...fieldMapping, [field.apiName]: event.target.value } })}
                            className="h-9 w-full rounded border border-gray-300 bg-white px-2 text-sm"
                          >
                            <option value="">Skip field</option>
                            {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                          </select>
                        </td>
                        <td className="max-w-64 truncate px-3 py-2 text-xs text-gray-500">
                          {fieldMapping[field.apiName] ? rows[0]?.[fieldMapping[field.apiName]] || '—' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-gray-900">Import preview</h2>
                <div className="max-h-56 overflow-auto rounded border border-gray-200">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="px-3 py-2">CSV row</th><th className="px-3 py-2">Workorder ID</th><th className="px-3 py-2">Status</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {preparedRows.slice(0, 8).map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="px-3 py-2">{row.rowNumber}</td>
                          <td className="px-3 py-2">{rows[row.rowNumber - 2]?.[workOrderColumn] || '—'}</td>
                          <td className={`px-3 py-2 ${row.errors.length ? 'text-amber-700' : 'text-green-700'}`}>
                            {row.errors.length ? row.errors.join('; ') : 'Ready'}
                          </td>
                        </tr>
                      ))}
                      {preparedRows.length === 0 && <tr><td colSpan={3} className="px-3 py-5 text-center text-gray-500">No rows to preview.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Rows with valid Workorder IDs and widget fields are imported; skipped rows are reported below.</p>
                  {skippedRowCount > 0 && (
                    <label className="flex items-start gap-2 text-sm text-amber-900">
                      <input
                        type="checkbox"
                        checked={skipRowsWithIssues}
                        onChange={(event) => {
                          setSkipRowsWithIssues(event.target.checked)
                          setError(null)
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-navy"
                      />
                      <span>
                        Skip the {skippedRowCount} row{skippedRowCount === 1 ? '' : 's'} that cannot be imported and import the {importableCount} valid row{importableCount === 1 ? '' : 's'}.
                      </span>
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void importRows()}
                  disabled={busy || loadingWorkOrders || !!workOrderError || (objectApiName === 'PerDiem' && loadingUsers) || !workOrderColumn || importableCount === 0 || (skippedRowCount > 0 && !skipRowsWithIssues)}
                  className="inline-flex h-10 items-center gap-2 rounded bg-brand-navy px-4 text-sm font-semibold text-white hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {skippedRowCount > 0
                    ? `Import ${importableCount} valid rows · skip ${skippedRowCount}`
                    : `Import ${importableCount} ${OBJECT_LABELS[objectApiName]} rows`}
                </button>
              </div>
            </>
          )}

          {result && (
            <div role={result.errors.length ? 'alert' : 'status'} className={`rounded border p-4 ${result.errors.length ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
              <div className="flex items-center gap-2 text-sm font-semibold">
                {result.errors.length ? <AlertTriangle className="h-4 w-4 text-amber-700" /> : <CheckCircle2 className="h-4 w-4 text-green-700" />}
                {result.created} {OBJECT_LABELS[objectApiName]} rows imported · {result.errors.length} issue{result.errors.length === 1 ? '' : 's'}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 max-h-48 space-y-1 overflow-auto text-xs text-amber-900">
                  {result.errors.map((rowError, index) => <p key={`${rowError.row}-${index}`}>Row {rowError.row}: {rowError.error}</p>)}
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsContentCard>
    </>
  )
}