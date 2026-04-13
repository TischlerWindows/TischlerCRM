'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import Papa from 'papaparse';
import {
  X, Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check,
  AlertCircle, CheckCircle, Loader2, Download
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectApiName: string;
  objectLabel: string;
  onImportComplete: () => void;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

interface ImportResult {
  created: number;
  errors: Array<{ row: number; error: string }>;
}

export default function CsvImportDialog({
  open,
  onOpenChange,
  objectApiName,
  objectLabel,
  onImportComplete,
}: CsvImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { schema } = useSchemaStore();
  const objectDef = schema?.objects.find(o => o.apiName === objectApiName);

  // Get target fields from the schema
  const targetFields = useMemo(() => {
    if (!objectDef?.fields) return [];
    return objectDef.fields
      .filter(f => !f.readOnly && f.apiName !== 'Id')
      .map(f => ({
        apiName: f.apiName.replace(`${objectApiName}__`, ''),
        label: f.label,
        type: f.type,
        required: !!f.required,
        isAutoNumber: !!f.autoNumber,
      }));
  }, [objectDef, objectApiName]);

  const reset = useCallback(() => {
    setStep('upload');
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMapping({});
    setImportResult(null);
    setParseError(null);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  // ── Auto-map columns using fuzzy matching ──
  const autoMapColumns = useCallback((headers: string[]) => {
    const mapping: Record<string, string> = {};

    for (const header of headers) {
      const headerLower = header.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Try exact match first
      let match = targetFields.find(f =>
        f.apiName.toLowerCase() === headerLower ||
        f.label.toLowerCase().replace(/[^a-z0-9]/g, '') === headerLower
      );

      // Try common Salesforce → CRM field name mappings
      if (!match) {
        const sfMappings: Record<string, string[]> = {
          // Salesforce standard field names → possible CRM field names
          firstname: ['firstName', 'first_name', 'contactFirstName'],
          lastname: ['lastName', 'last_name', 'contactLastName'],
          name: ['name', 'accountName', 'contactName', 'leadName', 'opportunityName', 'projectName'],
          email: ['email', 'contactEmail', 'leadEmail'],
          phone: ['phone', 'contactPhone', 'leadPhone'],
          mobilephone: ['mobile', 'mobilePhone'],
          title: ['title', 'contactTitle', 'leadTitle'],
          company: ['company', 'accountName', 'leadCompany'],
          website: ['website'],
          industry: ['industry'],
          description: ['description'],
          street: ['street', 'address_street'],
          city: ['city', 'address_city'],
          state: ['state', 'address_state'],
          postalcode: ['zipCode', 'postalCode', 'address_zip'],
          country: ['country', 'address_country'],
          leadsource: ['leadSource', 'source'],
          status: ['status'],
          rating: ['rating'],
          amount: ['amount', 'value'],
          closedate: ['closeDate', 'expectedCloseDate'],
          stagename: ['stage', 'stageName'],
          probability: ['probability'],
          type: ['type'],
          ownerid: ['assignedToUserId', 'ownerId'],
          subject: ['subject'],
          priority: ['priority'],
          duedate: ['dueDate'],
        };

        const sfKey = headerLower;
        const possibleNames = sfMappings[sfKey] || [];
        for (const candidate of possibleNames) {
          match = targetFields.find(f =>
            f.apiName.toLowerCase() === candidate.toLowerCase()
          );
          if (match) break;
        }
      }

      // Try partial/contains match
      if (!match) {
        match = targetFields.find(f =>
          f.apiName.toLowerCase().includes(headerLower) ||
          headerLower.includes(f.apiName.toLowerCase()) ||
          f.label.toLowerCase().replace(/[^a-z0-9]/g, '').includes(headerLower) ||
          headerLower.includes(f.label.toLowerCase().replace(/[^a-z0-9]/g, ''))
        );
      }

      if (match && !match.isAutoNumber) {
        // Don't double-map the same target
        const alreadyMapped = Object.values(mapping).includes(match.apiName);
        if (!alreadyMapped) {
          mapping[header] = match.apiName;
        }
      }
    }

    return mapping;
  }, [targetFields]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      setParseError('Please select a CSV file.');
      return;
    }

    // 20MB limit
    if (file.size > 20 * 1024 * 1024) {
      setParseError('File is too large. Maximum size is 20MB.');
      return;
    }

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
      complete: (results: Papa.ParseResult<Record<string, string>>) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setParseError(`CSV parse error: ${results.errors[0]?.message || 'Unknown error'}`);
          return;
        }

        const headers = results.meta.fields || [];
        if (headers.length === 0) {
          setParseError('No columns found in CSV file.');
          return;
        }

        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          setParseError('No data rows found in CSV file.');
          return;
        }

        if (rows.length > 5000) {
          setParseError('Maximum 5,000 records per import. Please split your file.');
          return;
        }

        setCsvHeaders(headers);
        setCsvRows(rows);
        setColumnMapping(autoMapColumns(headers));
        setStep('mapping');
      },
      error: (err: Error) => {
        setParseError(`Failed to parse CSV: ${err.message}`);
      },
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Count how many columns are mapped
  const mappedCount = Object.values(columnMapping).filter(v => v !== '' && v !== '__skip__').length;
  const requiredMapped = targetFields
    .filter(f => f.required && !f.isAutoNumber)
    .every(f => Object.values(columnMapping).includes(f.apiName));

  // Build preview data with mapped column names
  const previewRows = useMemo(() => {
    return csvRows.slice(0, 10).map(row => {
      const mapped: Record<string, any> = {};
      for (const [csvCol, targetField] of Object.entries(columnMapping)) {
        if (targetField && targetField !== '__skip__') {
          mapped[targetField] = row[csvCol] ?? '';
        }
      }
      return mapped;
    });
  }, [csvRows, columnMapping]);

  const mappedFieldLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const targetApiName of Object.values(columnMapping)) {
      if (targetApiName && targetApiName !== '__skip__') {
        const field = targetFields.find(f => f.apiName === targetApiName);
        labels[targetApiName] = field?.label || targetApiName;
      }
    }
    return labels;
  }, [columnMapping, targetFields]);

  const handleImport = async () => {
    setStep('importing');
    setImportProgress(0);

    // Build the records using the column mapping
    const records = csvRows.map(row => {
      const mapped: Record<string, any> = {};
      for (const [csvCol, targetField] of Object.entries(columnMapping)) {
        if (targetField && targetField !== '__skip__') {
          const val = row[csvCol];
          if (val !== undefined && val !== null && val !== '') {
            mapped[targetField] = val;
          }
        }
      }
      return mapped;
    });

    // Send in batches of 200
    const BATCH_SIZE = 200;
    let totalCreated = 0;
    const allErrors: Array<{ row: number; error: string }> = [];
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
      const batch = records.slice(batchIdx * BATCH_SIZE, (batchIdx + 1) * BATCH_SIZE);
      const offset = batchIdx * BATCH_SIZE;

      try {
        const result = await apiClient.importRecords(objectApiName, batch);
        totalCreated += result.created;
        // Adjust row numbers to be global
        for (const err of result.errors) {
          allErrors.push({ row: err.row + offset, error: err.error });
        }
      } catch (err: any) {
        // If the entire batch fails, add errors for all rows
        for (let i = 0; i < batch.length; i++) {
          allErrors.push({ row: offset + i + 1, error: err.message || 'Batch failed' });
        }
      }

      setImportProgress(Math.round(((batchIdx + 1) / totalBatches) * 100));
    }

    setImportResult({ created: totalCreated, errors: allErrors });
    setStep('results');
    if (totalCreated > 0) onImportComplete();
  };

  const downloadErrorReport = () => {
    if (!importResult?.errors.length) return;
    const csv = Papa.unparse(importResult.errors.map(e => ({ Row: e.row, Error: e.error })));
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${objectApiName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const headers = targetFields
      .filter(f => !f.isAutoNumber)
      .map(f => f.label);
    const csv = Papa.unparse({ fields: headers, data: [] });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${objectApiName}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Import {objectLabel} Records</h2>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'upload' && 'Upload a CSV file to import records'}
              {step === 'mapping' && `Map CSV columns to ${objectLabel} fields`}
              {step === 'preview' && 'Review data before importing'}
              {step === 'importing' && 'Importing records...'}
              {step === 'results' && 'Import complete'}
            </p>
          </div>
          <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            {(['upload', 'mapping', 'preview', 'results'] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className="w-8 h-px bg-gray-300" />}
                <div className={`flex items-center gap-1.5 text-sm ${
                  step === s ? 'text-brand-navy font-semibold' :
                  (['upload', 'mapping', 'preview', 'importing', 'results'].indexOf(step) > ['upload', 'mapping', 'preview', 'importing', 'results'].indexOf(s)) ? 'text-green-600' :
                  'text-gray-400'
                }`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step === s ? 'bg-brand-navy text-white' :
                    (['upload', 'mapping', 'preview', 'importing', 'results'].indexOf(step) > ['upload', 'mapping', 'preview', 'importing', 'results'].indexOf(s)) ? 'bg-green-100 text-green-700' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {(['upload', 'mapping', 'preview', 'importing', 'results'].indexOf(step) > ['upload', 'mapping', 'preview', 'importing', 'results'].indexOf(s)) ? <Check className="w-3 h-3" /> : i + 1}
                  </div>
                  <span className="hidden sm:inline">{s === 'upload' ? 'Upload' : s === 'mapping' ? 'Map Fields' : s === 'preview' ? 'Preview' : 'Results'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ── Upload Step ── */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-brand-navy transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-1">Drop your CSV file here</p>
                <p className="text-sm text-gray-500 mb-4">or click to browse</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <p className="text-xs text-gray-400">Supports Salesforce Data Loader exports, Excel CSV, and standard CSV files. Max 5,000 rows / 20MB.</p>
              </div>

              {parseError && (
                <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">{parseError}</span>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Tips for a successful import</h3>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li className="flex items-start gap-2">
                    <FileSpreadsheet className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                    Use the first row as column headers. Salesforce export files work out of the box.
                  </li>
                  <li className="flex items-start gap-2">
                    <FileSpreadsheet className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                    Auto-number fields (like {objectLabel} #) are generated automatically — no need to include them.
                  </li>
                  <li className="flex items-start gap-2">
                    <FileSpreadsheet className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" />
                    Dates should be in a recognizable format (YYYY-MM-DD, MM/DD/YYYY, etc.).
                  </li>
                </ul>
                <button
                  onClick={downloadTemplate}
                  className="mt-4 inline-flex items-center text-sm text-brand-navy hover:text-brand-dark font-medium"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Download CSV template for {objectLabel}
                </button>
              </div>
            </div>
          )}

          {/* ── Mapping Step ── */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <strong>{csvRows.length}</strong> rows found with <strong>{csvHeaders.length}</strong> columns.
                  {' '}<strong>{mappedCount}</strong> columns mapped.
                </p>
                <button
                  onClick={() => setColumnMapping(autoMapColumns(csvHeaders))}
                  className="text-sm text-brand-navy hover:text-brand-dark font-medium"
                >
                  Auto-map columns
                </button>
              </div>

              <div className="border border-gray-200 rounded-lg divide-y divide-gray-200">
                {csvHeaders.map(header => {
                  const sampleValues = csvRows.slice(0, 3).map(r => r[header]).filter(Boolean);
                  return (
                    <div key={header} className="flex items-center gap-4 p-4">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 truncate">{header}</div>
                        {sampleValues.length > 0 && (
                          <div className="text-xs text-gray-400 truncate mt-0.5">
                            e.g. {sampleValues.slice(0, 2).join(', ')}
                          </div>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1">
                        <select
                          value={columnMapping[header] || '__skip__'}
                          onChange={e => setColumnMapping({ ...columnMapping, [header]: e.target.value })}
                          className={`w-full border rounded-lg px-3 py-2 text-sm ${
                            columnMapping[header] && columnMapping[header] !== '__skip__'
                              ? 'border-green-300 bg-green-50 text-green-900'
                              : 'border-gray-300 text-gray-700'
                          }`}
                        >
                          <option value="__skip__">— Skip this column —</option>
                          {targetFields
                            .filter(f => !f.isAutoNumber)
                            .map(f => (
                              <option key={f.apiName} value={f.apiName}>
                                {f.label}{f.required ? ' *' : ''} ({f.type})
                              </option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!requiredMapped && (
                <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  Some required fields are not mapped. Records missing these values will fail to import.
                </div>
              )}
            </div>
          )}

          {/* ── Preview Step ── */}
          {step === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Previewing first {previewRows.length} of <strong>{csvRows.length}</strong> records. Review the data before importing.
              </p>
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase">#</th>
                      {Object.entries(mappedFieldLabels).map(([apiName, label]) => (
                        <th key={apiName} className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase whitespace-nowrap">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                        {Object.keys(mappedFieldLabels).map(apiName => (
                          <td key={apiName} className="px-4 py-2 text-gray-900 max-w-48 truncate">{row[apiName] || '-'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {csvRows.length > 10 && (
                <p className="text-xs text-gray-400 text-center">... and {csvRows.length - 10} more rows</p>
              )}
            </div>
          )}

          {/* ── Importing Step ── */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-brand-navy animate-spin mb-6" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Importing records...</h3>
              <p className="text-sm text-gray-500 mb-6">Please don&apos;t close this dialog.</p>
              <div className="w-full max-w-sm">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-brand-navy h-3 rounded-full transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-gray-500 mt-2">{importProgress}%</p>
              </div>
            </div>
          )}

          {/* ── Results Step ── */}
          {step === 'results' && importResult && (
            <div className="space-y-6">
              {importResult.created > 0 && (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-green-900">
                      Successfully imported {importResult.created} record{importResult.created !== 1 ? 's' : ''}
                    </h3>
                    {importResult.errors.length > 0 && (
                      <p className="text-sm text-green-700 mt-0.5">
                        {importResult.errors.length} row{importResult.errors.length !== 1 ? 's' : ''} had errors.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {importResult.created === 0 && (
                <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-medium text-red-900">Import failed</h3>
                    <p className="text-sm text-red-700 mt-0.5">
                      No records were created. {importResult.errors.length} error{importResult.errors.length !== 1 ? 's' : ''} occurred.
                    </p>
                  </div>
                </div>
              )}

              {importResult.errors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-gray-900">Errors ({importResult.errors.length})</h4>
                    <button
                      onClick={downloadErrorReport}
                      className="inline-flex items-center text-sm text-brand-navy hover:text-brand-dark font-medium"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Download error report
                    </button>
                  </div>
                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Row</th>
                          <th className="px-4 py-2 text-left text-xs font-bold text-gray-600">Error</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {importResult.errors.slice(0, 50).map((err, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-gray-500">{err.row}</td>
                            <td className="px-4 py-2 text-red-700">{err.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importResult.errors.length > 50 && (
                      <div className="px-4 py-2 text-xs text-gray-500 bg-gray-50 text-center">
                        Showing first 50 of {importResult.errors.length} errors. Download the error report for the full list.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between flex-shrink-0 bg-white rounded-b-lg">
          <div>
            {step === 'mapping' && (
              <button onClick={() => { reset(); }} className="inline-flex items-center px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back
              </button>
            )}
            {step === 'preview' && (
              <button onClick={() => setStep('mapping')} className="inline-flex items-center px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Mapping
              </button>
            )}
          </div>
          <div className="flex gap-3">
            {step !== 'importing' && (
              <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                {step === 'results' ? 'Close' : 'Cancel'}
              </button>
            )}
            {step === 'mapping' && (
              <button
                onClick={() => setStep('preview')}
                disabled={mappedCount === 0}
                className="inline-flex items-center px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </button>
            )}
            {step === 'preview' && (
              <button
                onClick={handleImport}
                className="inline-flex items-center px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Import {csvRows.length} Record{csvRows.length !== 1 ? 's' : ''}
              </button>
            )}
            {step === 'results' && importResult && importResult.errors.length > 0 && importResult.created > 0 && (
              <button
                onClick={() => { reset(); }}
                className="inline-flex items-center px-4 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-dark"
              >
                Import More
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
