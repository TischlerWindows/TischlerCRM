'use client';

/**
 * Full aggregate "Project List" report — one block of rows per Project
 * record, columns mirroring the Tischler master project-tracking
 * spreadsheet. Read-only; edits are made per-project via the Project List
 * widget on the record page.
 *
 * Several source-sheet columns bundle multiple stacked values into one
 * cell (e.g. Shop Drawings' Set 1-4 + Final + Install Set, Change Order's
 * CO Down/Out/Back, Loading List's RF/RS/OF) — these are stored as
 * `<keyPrefix>Row1`..`Row{N}` custom fields (see the Project List widget,
 * apps/web/widgets/internal/project-list/index.tsx, which is the source of
 * truth for these keys/row-counts). This report renders one sub-row per
 * physical sheet row so every stacked value is visible, with the
 * non-stacked ("simple") columns visually merged (rowSpan) down the
 * project's whole block, matching the master spreadsheet's layout.
 */
import { X, Printer } from 'lucide-react';

/** A column whose value is a single field, shown once per project (spans all sub-rows). */
interface SimpleColumn {
  kind: 'simple';
  key: string;
  label: string;
}

/** A column stacking `rowCount` physical sheet rows into keys `${keyPrefix}Row1..Row{rowCount}`. */
interface StackedColumn {
  kind: 'stacked';
  keyPrefix: string;
  label: string;
  rowCount: number;
}

type Column = SimpleColumn | StackedColumn;

const simple = (key: string, label: string): SimpleColumn => ({ kind: 'simple', key, label });
const stacked = (keyPrefix: string, label: string, rowCount: number): StackedColumn => ({
  kind: 'stacked',
  keyPrefix,
  label,
  rowCount,
});

const COLUMNS: Column[] = [
  simple('projectName', 'Customer'),
  simple('tusOrderNumber', 'TUS Order #'),
  simple('factory', 'Factory'),
  simple('standardProductType', 'ST'),
  simple('dadeCountyProductType', 'DC'),
  simple('doubleHungProductType', 'DH'),
  simple('screenFlag', 'Screen'),
  simple('lutronFlag', 'Lutron'),
  simple('checkFlag', 'Check'),
  simple('tischlerPM', 'Tischler PM'),
  simple('factoryPM', 'Factory PM'),
  simple('projectSalesman', 'Salesman'),
  simple('projectLocation', 'Location'),
  simple('woodSpecies', 'Wood Species'),
  simple('dcSilicone', 'DC Silicone'),
  simple('solarControl', 'Solar Ctrl'),
  simple('finishColor', 'Finish Color'),
  stacked('changeOrder', 'Change Order', 4),
  stacked('set1', 'Set 1', 5),
  stacked('set2', 'Set 2', 5),
  stacked('set3', 'Set 3', 5),
  stacked('set4', 'Set 4', 5),
  stacked('finalSet', 'Final', 5),
  stacked('installSet', 'Install Set', 5),
  stacked('jobStatusOrderDate', 'Job Status / Order Date', 3),
  simple('onHoldUnits', 'On-Hold Units'),
  simple('customHardware', 'Custom Hardware'),
  stacked('factoryOC', 'Factory O.C.', 2),
  stacked('installationMaterial', 'Installation Material', 2),
  stacked('installationInstruction', 'Installation Instruction', 3),
  stacked('shippingWeek', 'Shipping Wk', 5),
  stacked('estimatedDeliveryWeek', 'Est. Delivery Wk', 5),
  stacked('loadingListRF', 'RF', 5),
  stacked('loadingListRS', 'RS', 5),
  stacked('loadingListOF', 'OF', 5),
  simple('completionSignOff', 'Completion Sign-off'),
];

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✓' : '';
  return String(value);
}

/** How many sub-rows a project's block needs: the highest Row index across all
 * stacked columns that actually has a value, at least 1 (never fewer than 1
 * so every project gets at least one row). */
function subRowCountFor(project: Record<string, any>): number {
  let max = 1;
  for (const col of COLUMNS) {
    if (col.kind !== 'stacked') continue;
    for (let n = col.rowCount; n >= 1; n--) {
      const v = project[`${col.keyPrefix}Row${n}`];
      if (v !== null && v !== undefined && v !== '') {
        if (n > max) max = n;
        break;
      }
    }
  }
  return max;
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
                    key={col.kind === 'simple' ? col.key : col.keyPrefix}
                    className="text-left font-semibold text-gray-600 px-3 py-2 border-b border-gray-200 whitespace-nowrap"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projects.map((p, pi) => {
                const subRows = subRowCountFor(p);
                return Array.from({ length: subRows }, (_, ri) => (
                  <tr
                    key={`${p.id ?? pi}-${ri}`}
                    className={`${pi % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                      ri === subRows - 1 ? 'border-b-2 border-gray-300' : ''
                    }`}
                  >
                    {COLUMNS.map(col => {
                      if (col.kind === 'simple') {
                        // Simple columns only carry one value per project — render it
                        // once, visually spanning every sub-row in the project's block.
                        if (ri !== 0) return null;
                        return (
                          <td
                            key={col.key}
                            rowSpan={subRows}
                            className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-700 align-top"
                          >
                            {formatCell(p[col.key])}
                          </td>
                        );
                      }
                      const value = ri < col.rowCount ? p[`${col.keyPrefix}Row${ri + 1}`] : undefined;
                      return (
                        <td
                          key={col.keyPrefix}
                          className="px-3 py-1.5 border-b border-gray-100 whitespace-nowrap text-gray-700"
                        >
                          {formatCell(value)}
                        </td>
                      );
                    })}
                  </tr>
                ));
              })}
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

