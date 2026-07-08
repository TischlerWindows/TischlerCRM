'use client';

/**
 * Full aggregate "Project List" report — one row per Project record, columns
 * mirroring the Tischler master project-tracking spreadsheet. Read-only;
 * edits are made per-project via the Project List widget on the record page.
 */
import { X, Printer } from 'lucide-react';

interface Column {
  key: string;
  label: string;
}

const COLUMNS: Column[] = [
  { key: 'projectName', label: 'Customer' },
  { key: 'tusOrderNumber', label: 'TUS Order #' },
  { key: 'factory', label: 'Factory' },
  { key: 'standardProductType', label: 'ST' },
  { key: 'dadeCountyProductType', label: 'DC' },
  { key: 'doubleHungProductType', label: 'DH' },
  { key: 'screenFlag', label: 'Screen' },
  { key: 'lutronFlag', label: 'Lutron' },
  { key: 'checkFlag', label: 'Check' },
  { key: 'tischlerPM', label: 'Tischler PM' },
  { key: 'factoryPM', label: 'Factory PM' },
  { key: 'projectSalesman', label: 'Salesman' },
  { key: 'projectLocation', label: 'Location' },
  { key: 'woodSpecies', label: 'Wood Species' },
  { key: 'dcSilicone', label: 'DC Silicone' },
  { key: 'solarControl', label: 'Solar Ctrl' },
  { key: 'finishColor', label: 'Finish Color' },
  { key: 'changeOrderEstimToClient', label: 'Change Order' },
  { key: 'set1Row1', label: 'Set 1' },
  { key: 'set2Row1', label: 'Set 2' },
  { key: 'set3Row1', label: 'Set 3' },
  { key: 'set4Row1', label: 'Set 4' },
  { key: 'finalSetRow1', label: 'Final' },
  { key: 'installSetRow1', label: 'Install Set' },
  { key: 'jobStatusOrderDate', label: 'Job Status / Order Date' },
  { key: 'onHoldUnits', label: 'On-Hold Units' },
  { key: 'customHardware', label: 'Custom Hardware' },
  { key: 'factoryOC', label: 'Factory O.C.' },
  { key: 'installationMaterialNotes', label: 'Installation Material' },
  { key: 'installationInstructionNotes', label: 'Installation Instruction' },
  { key: 'shippingWeek', label: 'Shipping Wk' },
  { key: 'estimatedDeliveryWeek', label: 'Est. Delivery Wk' },
  { key: 'loadingListRFRow1', label: 'RF' },
  { key: 'loadingListRSRow1', label: 'RS' },
  { key: 'loadingListOFRow1', label: 'OF' },
  { key: 'completionSignOff', label: 'Completion Sign-off' },
];

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✓' : '';
  return String(value);
}

export default function ProjectListReportModal({
  projects,
  onClose,
}: {
  projects: Record<string, any>[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:relative print:bg-white print:p-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-list-report-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col print:max-w-full print:max-h-full print:shadow-none print:rounded-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <h2 id="project-list-report-title" className="text-lg font-bold text-brand-navy">
            Project List Report ({projects.length})
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              Print
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1">
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr key={p.id ?? i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  {COLUMNS.map(col => (
                    <td key={col.key} className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-700">
                      {formatCell(p[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
              {projects.length === 0 && (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-gray-400">
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
