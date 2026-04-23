'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertCircle,
  CheckCircle, Loader2, Download, Link2, ChevronDown, ChevronRight, X,
  Database,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';
import type { FieldDef, ObjectDef } from '@/lib/schema';

// ── Constants ──────────────────────────────────────────────────────────────

/**
 * Canonical import order — dependencies must come before dependents.
 * Objects not in this list are imported after, in schema order.
 */
const IMPORT_ORDER = [
  'Account',
  'Contact',
  'Property',
  'Lead',
  'Opportunity',
  'Quote',
  'Project',
  'Installation',
  'Service',
  'WorkOrder',
];

/**
 * Common Salesforce → CRM field name synonyms used for auto-mapping.
 */
const SF_FIELD_SYNONYMS: Record<string, string[]> = {
  firstname: ['firstName'],
  lastname: ['lastName'],
  name: ['accountName', 'contactName', 'opportunityName', 'projectName', 'leadName', 'name'],
  email: ['email'],
  phone: ['phone'],
  mobilephone: ['mobile', 'mobilePhone'],
  title: ['title'],
  company: ['accountName', 'company'],
  website: ['website'],
  industry: ['industry'],
  description: ['description'],
  billingstreet: ['street', 'billingStreet'],
  billingcity: ['city', 'billingCity'],
  billingstate: ['state', 'billingState'],
  billingpostalcode: ['zipCode', 'billingZip'],
  billingcountry: ['country', 'billingCountry'],
  street: ['street'],
  city: ['city'],
  state: ['state'],
  postalcode: ['zipCode'],
  country: ['country'],
  leadsource: ['leadSource', 'source'],
  status: ['status'],
  stagename: ['stage', 'stageName'],
  amount: ['amount', 'value'],
  closedate: ['closeDate', 'expectedCloseDate'],
  probability: ['probability'],
  type: ['type'],
  rating: ['rating'],
  priority: ['priority'],
  subject: ['subject'],
  duedate: ['dueDate'],
};

// ── Types ──────────────────────────────────────────────────────────────────

type WizardStep = 'upload' | 'detect' | 'map' | 'import' | 'results';

interface FileEntry {
  file: File;
  headers: string[];
  rows: Record<string, string>[];
  /** Detected or user-set CRM object apiName */
  detectedObject: string | null;
  /** Column → CRM field apiName mapping ('' = skip) */
  columnMapping: Record<string, string>;
  /** Which column holds the Salesforce record Id */
  sfIdColumn: string | null;
}

interface ObjectResult {
  objectApiName: string;
  objectLabel: string;
  created: number;
  errors: Array<{ row: number; error: string }>;
  idMap: Record<string, string>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function detectObject(headers: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase());

  const checks: [string, string[]][] = [
    ['Account', ['accountname', 'billingcity', 'website', 'industry', 'annualrevenue']],
    ['Contact', ['firstname', 'lastname', 'accountid', 'department', 'leadsource', 'mailingcity']],
    ['Lead', ['company', 'leadsource', 'converteddate', 'isconverted']],
    ['Opportunity', ['stagename', 'closedate', 'probability', 'accountid', 'amount']],
    ['Quote', ['quotenumber', 'subtotal', 'totalprice', 'opportunityid']],
    ['Project', ['projectnumber', 'opportunityid', 'startdate', 'expectedcompletion']],
    ['Property', ['propertynumber', 'propertytype', 'squarefootage', 'yearbuilt']],
    ['Installation', ['installationnumber', 'installationdate', 'projectid']],
    ['Service', ['servicenumber', 'servicetype', 'scheduleddate']],
    ['WorkOrder', ['workordernumber', 'workordertype', 'installationid']],
  ];

  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const [obj, signals] of checks) {
    const score = signals.filter((s) => lower.some((h) => h.includes(s))).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = obj;
    }
  }
  return bestScore > 0 ? bestMatch : null;
}

function detectSfIdColumn(headers: string[]): string | null {
  // Prefer exact 'Id' or 'ID', then anything ending in 'id' that looks like SF
  const exact = headers.find((h) => h === 'Id' || h === 'ID');
  if (exact) return exact;
  const sfStyle = headers.find((h) => /^[A-Z][a-z]+Id$/.test(h) === false && /^Id$/i.test(h));
  return sfStyle ?? null;
}

function autoMap(
  headers: string[],
  objectDef: ObjectDef,
  objectApiName: string,
): Record<string, string> {
  const fields = objectDef.fields
    .filter((f) => !f.readOnly && f.apiName !== 'Id')
    .map((f) => ({
      apiName: f.apiName.replace(`${objectApiName}__`, ''),
      label: f.label,
      type: f.type,
    }));

  const mapping: Record<string, string> = {};

  for (const header of headers) {
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    let match: (typeof fields)[0] | undefined;

    // Exact field name
    match = fields.find(
      (f) => f.apiName.toLowerCase() === key || f.label.toLowerCase().replace(/[^a-z0-9]/g, '') === key,
    );

    // SF synonyms
    if (!match) {
      const candidates = SF_FIELD_SYNONYMS[key] ?? [];
      for (const c of candidates) {
        match = fields.find((f) => f.apiName.toLowerCase() === c.toLowerCase());
        if (match) break;
      }
    }

    // Partial/contains
    if (!match) {
      match = fields.find(
        (f) =>
          f.apiName.toLowerCase().includes(key) ||
          key.includes(f.apiName.toLowerCase()) ||
          f.label.toLowerCase().replace(/[^a-z0-9]/g, '').includes(key) ||
          key.includes(f.label.toLowerCase().replace(/[^a-z0-9]/g, '')),
      );
    }

    if (match) {
      const alreadyUsed = Object.values(mapping).includes(match.apiName);
      if (!alreadyUsed) {
        mapping[header] = match.apiName;
      }
    }
  }

  return mapping;
}

/** Given the schema, return lookup fields for an object: fieldApiName → lookupObject */
function getLookupFields(objectDef: ObjectDef, objectApiName: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const f of objectDef.fields) {
    if ((f.type === 'Lookup' || f.type === 'ExternalLookup') && f.lookupObject) {
      const stripped = f.apiName.replace(`${objectApiName}__`, '');
      result[stripped] = f.lookupObject;
    }
  }
  return result;
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function SalesforceImportPage() {
  const { schema } = useSchemaStore();
  const [step, setStep] = useState<WizardStep>('upload');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importProgress, setImportProgress] = useState<Record<string, number>>({});
  const [results, setResults] = useState<ObjectResult[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const crmObjects = useMemo(() => schema?.objects ?? [], [schema]);

  // ── File handling ──────────────────────────────────────────────

  const parseFile = useCallback(
    (file: File): Promise<FileEntry | string> => {
      return new Promise((resolve) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h: string) => h.trim(),
          complete: (result: Papa.ParseResult<Record<string, string>>) => {
            const headers = result.meta.fields ?? [];
            const rows = result.data as Record<string, string>[];

            if (headers.length === 0) {
              resolve(`${file.name}: No columns found.`);
              return;
            }
            if (rows.length === 0) {
              resolve(`${file.name}: No data rows found.`);
              return;
            }

            const detectedObject = detectObject(headers);
            const sfIdColumn = detectSfIdColumn(headers) ?? headers[0] ?? null;
            const objectDef = detectedObject
              ? crmObjects.find((o) => o.apiName === detectedObject)
              : undefined;

            const columnMapping = objectDef
              ? autoMap(headers, objectDef, detectedObject!)
              : {};

            resolve({
              file,
              headers,
              rows,
              detectedObject,
              columnMapping,
              sfIdColumn,
            });
          },
          error: (err: Error) => resolve(`${file.name}: ${err.message}`),
        });
      });
    },
    [crmObjects],
  );

  const handleFilesSelected = useCallback(
    async (selectedFiles: FileList | null) => {
      if (!selectedFiles || selectedFiles.length === 0) return;
      const fileArray = Array.from(selectedFiles);
      const newErrors: string[] = [];
      const newEntries: FileEntry[] = [];

      for (const file of fileArray) {
        if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
          newErrors.push(`${file.name}: Not a CSV file.`);
          continue;
        }
        if (file.size > 50 * 1024 * 1024) {
          newErrors.push(`${file.name}: File too large (max 50MB).`);
          continue;
        }
        const result = await parseFile(file);
        if (typeof result === 'string') {
          newErrors.push(result);
        } else {
          newEntries.push(result);
        }
      }

      setParseErrors(newErrors);
      setFiles((prev) => [...prev, ...newEntries]);
      if (newEntries.length > 0) setStep('detect');
    },
    [parseFile],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFilesSelected(e.dataTransfer.files);
  };

  // ── Detect step helpers ────────────────────────────────────────

  const updateFileObject = (idx: number, objectApiName: string) => {
    setFiles((prev) => {
      const updated = [...prev];
      const entry = { ...updated[idx]! };
      entry.detectedObject = objectApiName;
      const objectDef = crmObjects.find((o) => o.apiName === objectApiName);
      if (objectDef) {
        entry.columnMapping = autoMap(entry.headers, objectDef, objectApiName);
      }
      updated[idx] = entry;
      return updated;
    });
  };

  const updateSfIdColumn = (idx: number, col: string) => {
    setFiles((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx]!, sfIdColumn: col };
      return updated;
    });
  };

  const updateColumnMapping = (fileIdx: number, csvCol: string, targetField: string) => {
    setFiles((prev) => {
      const updated = [...prev];
      const entry = { ...updated[fileIdx]! };
      entry.columnMapping = { ...entry.columnMapping, [csvCol]: targetField };
      updated[fileIdx] = entry;
      return updated;
    });
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (activeFileIdx >= idx && activeFileIdx > 0) setActiveFileIdx((v) => v - 1);
  };

  // ── Sorted import order ────────────────────────────────────────

  const sortedFiles = useMemo(() => {
    const withOrder = files.map((f, originalIdx) => {
      const obj = f.detectedObject ?? '';
      const orderIdx = IMPORT_ORDER.indexOf(obj);
      return { entry: f, originalIdx, orderIdx: orderIdx === -1 ? 999 : orderIdx };
    });
    return withOrder.sort((a, b) => a.orderIdx - b.orderIdx);
  }, [files]);

  // ── Run import ────────────────────────────────────────────────

  const runImport = useCallback(async () => {
    setIsImporting(true);
    setStep('import');
    setImportProgress({});

    // Global idMap that accumulates across all objects
    const globalIdMap: Record<string, string> = {};
    const allResults: ObjectResult[] = [];

    for (const { entry } of sortedFiles) {
      if (!entry.detectedObject) continue;
      const objectApiName = entry.detectedObject;
      const objectDef = crmObjects.find((o) => o.apiName === objectApiName);
      const objectLabel = objectDef?.label ?? objectApiName;
      const lookupFields = objectDef ? getLookupFields(objectDef, objectApiName) : {};

      setImportProgress((prev) => ({ ...prev, [objectApiName]: 0 }));

      // Build records — apply column mapping and substitute SF ids with CRM ids
      const records = entry.rows.map((row) => {
        const mapped: Record<string, any> = {};
        for (const [csvCol, targetField] of Object.entries(entry.columnMapping)) {
          if (!targetField || targetField === '__skip__') continue;
          const val = row[csvCol];
          if (val === undefined || val === null || val === '') continue;

          // Check if this mapped field is a lookup and if the value is a known SF id
          const lookedUpObject = lookupFields[targetField];
          if (lookedUpObject && globalIdMap[val]) {
            // Substitute with CRM id
            mapped[targetField] = globalIdMap[val];
          } else if (lookedUpObject && val) {
            // Unresolved lookup — skip as agreed
            // (don't add the field at all)
          } else {
            mapped[targetField] = val;
          }
        }
        return mapped;
      });

      // Send in batches of 500
      const BATCH_SIZE = 500;
      const totalBatches = Math.ceil(records.length / BATCH_SIZE);
      let totalCreated = 0;
      const allErrors: Array<{ row: number; error: string }> = [];

      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batch = records.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
        const offset = batchIdx * BATCH_SIZE;

        // Build the corresponding raw rows for this batch to extract SF ids
        const rawBatch = entry.rows.slice(offset, offset + batch.length);

        // Add sfId → row mapping so the API can return idMap
        if (entry.sfIdColumn) {
          batch.forEach((rec, i) => {
            const sfId = rawBatch[i]?.[entry.sfIdColumn!];
            if (sfId) (rec as any).__sfId = sfId;
          });
        }

        try {
          const result = await apiClient.importRecords(objectApiName, batch, entry.sfIdColumn ?? undefined);
          totalCreated += result.created;

          // Merge returned idMap into global map
          for (const [sfId, crmId] of Object.entries(result.idMap ?? {})) {
            globalIdMap[sfId] = crmId;
          }

          for (const err of result.errors) {
            allErrors.push({ row: err.row + offset, error: err.error });
          }
        } catch (err: any) {
          for (let i = 0; i < batch.length; i++) {
            allErrors.push({ row: offset + i + 1, error: err.message || 'Batch failed' });
          }
        }

        setImportProgress((prev) => ({
          ...prev,
          [objectApiName]: Math.round(((batchIdx + 1) / totalBatches) * 100),
        }));
      }

      allResults.push({ objectApiName, objectLabel, created: totalCreated, errors: allErrors, idMap: {} });
    }

    setResults(allResults);
    setIsImporting(false);
    setStep('results');
  }, [sortedFiles, crmObjects]);

  // ── Derived ────────────────────────────────────────────────────

  const allFilesHaveObjects = files.every((f) => !!f.detectedObject);
  const totalRows = files.reduce((sum, f) => sum + f.rows.length, 0);

  const activeEntry = files[activeFileIdx];
  const activeObjectDef = activeEntry?.detectedObject
    ? crmObjects.find((o) => o.apiName === activeEntry.detectedObject)
    : undefined;

  const activeTargetFields = useMemo(() => {
    if (!activeObjectDef || !activeEntry) return [];
    return activeObjectDef.fields
      .filter((f) => !f.readOnly && f.apiName !== 'Id')
      .map((f) => ({
        apiName: f.apiName.replace(`${activeEntry.detectedObject}__`, ''),
        label: f.label,
        type: f.type,
      }));
  }, [activeObjectDef, activeEntry]);

  const downloadErrorReport = (result: ObjectResult) => {
    const csv = Papa.unparse(result.errors.map((e) => ({ Row: e.row, Error: e.error })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${result.objectApiName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-brand-navy text-white px-6 py-4 flex items-center gap-4">
        <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
          <Database className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Salesforce Migration Import</h1>
          <p className="text-sm text-white/70">One-time relational data ingestion from Salesforce exports</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center gap-2 text-sm">
          {(['upload', 'detect', 'map', 'import', 'results'] as WizardStep[]).map((s, i, arr) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s
                    ? 'bg-brand-navy text-white'
                    : arr.indexOf(step) > i
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {arr.indexOf(step) > i ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={step === s ? 'font-semibold text-gray-900' : 'text-gray-500'}>
                {s === 'upload' ? 'Upload' : s === 'detect' ? 'Detect Objects' : s === 'map' ? 'Map Fields' : s === 'import' ? 'Importing' : 'Results'}
              </span>
              {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-gray-400" />}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── STEP: UPLOAD ── */}
        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Upload Salesforce CSV Exports</h2>
              <p className="text-sm text-gray-500 mb-6">
                Upload one CSV per Salesforce object (Account, Contact, Opportunity, etc.). Each file must include the Salesforce <code className="bg-gray-100 px-1 rounded">Id</code> column so related records can be linked.
              </p>

              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-brand-navy/50 hover:bg-blue-50/30 transition-colors"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="font-medium text-gray-700 mb-1">Drop CSV files here or click to browse</p>
                <p className="text-sm text-gray-400">Multiple files accepted · Max 50MB each · Max 5,000 rows per file</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
              </div>

              {parseErrors.length > 0 && (
                <div className="mt-4 space-y-1">
                  {parseErrors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {err}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP: DETECT ── */}
        {step === 'detect' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Confirm Object Detection</h2>
                <p className="text-sm text-gray-500">Verify the detected CRM object for each file and set which column is the Salesforce ID.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Upload className="w-4 h-4" /> Add more files
                </button>
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" multiple className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
                <button
                  onClick={() => setStep('map')}
                  disabled={!allFilesHaveObjects}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium disabled:opacity-40 hover:bg-brand-dark transition-colors"
                >
                  Next: Map Fields <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {files.map((entry, idx) => (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <FileSpreadsheet className="w-8 h-8 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-medium text-gray-900 truncate">{entry.file.name}</span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                          {entry.rows.length.toLocaleString()} rows · {entry.headers.length} cols
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">CRM Object</label>
                          <select
                            value={entry.detectedObject ?? ''}
                            onChange={(e) => updateFileObject(idx, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
                          >
                            <option value="">— Select object —</option>
                            {[...IMPORT_ORDER, ...crmObjects.map((o) => o.apiName).filter((a) => !IMPORT_ORDER.includes(a))].map(
                              (apiName) => {
                                const obj = crmObjects.find((o) => o.apiName === apiName);
                                if (!obj) return null;
                                return (
                                  <option key={apiName} value={apiName}>
                                    {obj.label} ({apiName})
                                  </option>
                                );
                              },
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Salesforce ID Column</label>
                          <select
                            value={entry.sfIdColumn ?? ''}
                            onChange={(e) => updateSfIdColumn(idx, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
                          >
                            <option value="">— None —</option>
                            {entry.headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => removeFile(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Import order preview */}
            {files.length > 1 && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-medium text-blue-800 mb-2">Import order (dependencies first):</p>
                <div className="flex flex-wrap items-center gap-2">
                  {sortedFiles.map(({ entry }, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-sm bg-white border border-blue-200 text-blue-800 px-3 py-1 rounded-full">
                        {entry.detectedObject ?? entry.file.name}
                      </span>
                      {i < sortedFiles.length - 1 && <ArrowRight className="w-3 h-3 text-blue-400" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: MAP ── */}
        {step === 'map' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Map Columns to Fields</h2>
                <p className="text-sm text-gray-500">
                  Review auto-mapped fields. Lookup columns pointing to SF Ids will be resolved automatically.
                </p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep('detect')} className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={runImport}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  <Database className="w-4 h-4" /> Start Import ({totalRows.toLocaleString()} rows)
                </button>
              </div>
            </div>

            {/* File tab selector */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {files.map((entry, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveFileIdx(idx)}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeFileIdx === idx
                      ? 'bg-brand-navy text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {entry.detectedObject ?? entry.file.name}
                  <span className="ml-2 text-xs opacity-60">{entry.rows.length.toLocaleString()} rows</span>
                </button>
              ))}
            </div>

            {activeEntry && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <span className="font-medium text-gray-800">{activeEntry.file.name}</span>
                  <span className="text-sm text-gray-500">
                    {Object.values(activeEntry.columnMapping).filter((v) => v && v !== '__skip__').length} of{' '}
                    {activeEntry.headers.length} columns mapped
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 w-1/3">CSV Column</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600 w-16">Sample</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-600">Maps to CRM Field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {activeEntry.headers.map((header) => {
                        const sample = activeEntry.rows[0]?.[header] ?? '';
                        const mapped = activeEntry.columnMapping[header] ?? '';
                        const isSfIdCol = header === activeEntry.sfIdColumn;
                        const targetField = activeTargetFields.find((f) => f.apiName === mapped);
                        const isLookup = targetField?.type === 'Lookup' || targetField?.type === 'ExternalLookup';

                        return (
                          <tr key={header} className={isSfIdCol ? 'bg-amber-50' : 'hover:bg-gray-50'}>
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-700">
                              {header}
                              {isSfIdCol && (
                                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">SF Id</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[120px] truncate">
                              {sample}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <select
                                  value={mapped}
                                  onChange={(e) => updateColumnMapping(activeFileIdx, header, e.target.value)}
                                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-64 focus:ring-2 focus:ring-brand-navy/40 focus:border-transparent"
                                  disabled={isSfIdCol}
                                >
                                  <option value="">— Skip —</option>
                                  <option value="__skip__">— Skip —</option>
                                  {activeTargetFields.map((f) => (
                                    <option key={f.apiName} value={f.apiName}>
                                      {f.label} ({f.apiName})
                                    </option>
                                  ))}
                                </select>
                                {isLookup && !isSfIdCol && (
                                  <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                    <Link2 className="w-3 h-3" /> Lookup – SF Id auto-resolved
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP: IMPORTING ── */}
        {step === 'import' && (
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Loader2 className="w-10 h-10 text-brand-navy animate-spin mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Importing…</h2>
              <p className="text-sm text-gray-500 mb-6">Do not close this tab. Lookup IDs are being resolved as each object completes.</p>
              <div className="space-y-4">
                {sortedFiles.map(({ entry }) => {
                  const obj = entry.detectedObject ?? entry.file.name;
                  const progress = importProgress[obj] ?? 0;
                  return (
                    <div key={obj}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{obj}</span>
                        <span className="text-gray-500">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="bg-brand-navy h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: RESULTS ── */}
        {step === 'results' && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Import Complete</h2>
              <p className="text-sm text-gray-500">Summary of all imported objects. Lookups to unresolved SF Ids were skipped as configured.</p>
            </div>

            {/* Summary header */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-500">Total Created</p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {results.reduce((s, r) => s + r.created, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-500">Total Errors</p>
                <p className="text-3xl font-bold text-red-500 mt-1">
                  {results.reduce((s, r) => s + r.errors.length, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-sm text-gray-500">Objects Imported</p>
                <p className="text-3xl font-bold text-brand-navy mt-1">{results.length}</p>
              </div>
            </div>

            {/* Per-object results */}
            <div className="space-y-3">
              {results.map((result) => {
                const hasErrors = result.errors.length > 0;
                const isExpanded = expandedErrors.has(result.objectApiName);
                return (
                  <div key={result.objectApiName} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div
                      className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                      onClick={() => {
                        if (!hasErrors) return;
                        setExpandedErrors((prev) => {
                          const next = new Set(prev);
                          if (next.has(result.objectApiName)) next.delete(result.objectApiName);
                          else next.add(result.objectApiName);
                          return next;
                        });
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {hasErrors ? (
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                        ) : (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        <span className="font-medium text-gray-900">{result.objectLabel}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-green-600 font-medium">{result.created.toLocaleString()} created</span>
                        {hasErrors && (
                          <>
                            <span className="text-sm text-red-500">{result.errors.length} errors</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); downloadErrorReport(result); }}
                              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-2 py-1 rounded"
                            >
                              <Download className="w-3 h-3" /> Download
                            </button>
                            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </>
                        )}
                      </div>
                    </div>
                    {hasErrors && isExpanded && (
                      <div className="border-t border-gray-100 px-5 py-3 bg-red-50 max-h-48 overflow-y-auto">
                        {result.errors.slice(0, 50).map((err, i) => (
                          <div key={i} className="text-xs text-red-700 py-0.5">
                            Row {err.row}: {err.error}
                          </div>
                        ))}
                        {result.errors.length > 50 && (
                          <div className="text-xs text-red-500 mt-1">…and {result.errors.length - 50} more (download for full list)</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => { setFiles([]); setResults([]); setStep('upload'); }}
                className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Start New Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
