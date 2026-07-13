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
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { X, Printer } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

/** A column whose value is a single field, shown once per project (spans all sub-rows). */
interface SimpleColumn {
  kind: 'simple';
  key: string;
  label: string;
  /** If set, this column's header is nested under a shared umbrella header
   * spanning every column with the same umbrella (e.g. "Product Type" over ST/DC/DH). */
  umbrella?: string;
}

/** A column stacking `rowCount` physical sheet rows into keys `${keyPrefix}Row1..Row{rowCount}`. */
interface StackedColumn {
  kind: 'stacked';
  keyPrefix: string;
  label: string;
  rowCount: number;
  umbrella?: string;
}

type Column = SimpleColumn | StackedColumn;

const simple = (key: string, label: string, umbrella?: string): SimpleColumn => ({
  kind: 'simple',
  key,
  label,
  umbrella,
});
const stacked = (keyPrefix: string, label: string, rowCount: number, umbrella?: string): StackedColumn => ({
  kind: 'stacked',
  keyPrefix,
  label,
  rowCount,
  umbrella,
});

const COLUMNS: Column[] = [
  simple('projectName', 'Customer'),
  simple('tusOrderNumber', 'TUS Order #'),
  simple('factory', 'Factory'),
  simple('standardProductType', 'ST', 'Product Type'),
  simple('dadeCountyProductType', 'DC', 'Product Type'),
  simple('doubleHungProductType', 'DH', 'Product Type'),
  simple('screenFlag', 'Screen', 'Roll System'),
  simple('lutronFlag', 'Lutron', 'Roll System'),
  simple('checkFlag', 'Check', 'Roll System'),
  simple('tischlerPM', 'Tischler PM'),
  simple('factoryPM', 'Factory PM'),
  simple('projectSalesman', 'Salesman'),
  simple('projectLocation', 'Location'),
  simple('woodSpecies', 'Wood Species'),
  simple('dcSilicone', 'DC Silicone'),
  simple('solarControl', 'Solar Ctrl'),
  simple('finishColor', 'Finish Color'),
  stacked('changeOrder', 'Change Order in Estim. / To Client', 5),
  stacked('set1', 'Set 1', 5, 'Shop Drawings'),
  stacked('set2', 'Set 2', 5, 'Shop Drawings'),
  stacked('set3', 'Set 3', 5, 'Shop Drawings'),
  stacked('set4', 'Set 4', 5, 'Shop Drawings'),
  stacked('finalSet', 'Final', 5, 'Shop Drawings'),
  stacked('installSet', 'Install Set', 5, 'Shop Drawings'),
  stacked('jobStatusOrderDate', 'Job Status / Order Date', 3),
  simple('onHoldUnits', 'On-Hold Units'),
  simple('customHardware', 'Custom Hardware'),
  stacked('factoryOC', 'Factory O.C.', 2),
  stacked('installationMaterial', 'Installation Material', 2),
  stacked('installationInstruction', 'Installation Instruction', 3),
  stacked('shippingWeek', 'Shipping Week', 5),
  stacked('estimatedDeliveryWeek', 'Estimated Delivery Wk', 5),
  stacked('loadingListRF', 'RF', 5, 'Loading List'),
  stacked('loadingListRS', 'RS', 5, 'Loading List'),
  stacked('loadingListOF', 'OF', 5, 'Loading List'),
  stacked('completionSignOff', 'Completion Sign-off', 2),
];

/** Consecutive columns sharing the same `umbrella` are rendered under one
 * shared header cell (colSpan = group size); columns without an umbrella
 * render as their own standalone, row-spanning header. */
interface HeaderGroup {
  umbrella: string | null;
  columns: Column[];
}

const HEADER_GROUPS: HeaderGroup[] = (() => {
  const groups: HeaderGroup[] = [];
  for (const column of COLUMNS) {
    const prev = groups[groups.length - 1];
    if (column.umbrella && prev?.umbrella === column.umbrella) {
      prev.columns.push(column);
    } else {
      groups.push({ umbrella: column.umbrella ?? null, columns: [column] });
    }
  }
  return groups;
})();

/** "Customer" is the only standalone column whose header reads normally
 * (horizontally); every other standalone column is rotated to save
 * horizontal space, matching the master spreadsheet. */
const VERTICAL_HEADER_STYLE: CSSProperties = {
  writingMode: 'vertical-rl',
  transform: 'rotate(180deg)',
  whiteSpace: 'pre-line',
  // `writing-mode` has no effect on non-atomic inline boxes (e.g. a plain
  // <span>) per the CSS spec — it must be an atomic inline (or block) box
  // for the rotation to actually apply.
  display: 'inline-block',
};
const HORIZONTAL_HEADER_STYLE: CSSProperties = { whiteSpace: 'pre-line' };

/** TUS Order # data values are rotated sideways (not the header) to let that
 * column stay narrow and save horizontal space. */
const VERTICAL_CELL_STYLE: CSSProperties = {
  writingMode: 'vertical-rl',
  transform: 'rotate(180deg)',
  display: 'inline-block',
};

/** Long header labels are split across two lines (at the space closest to the
 * middle of the string) instead of one long line, so rotated headers don't
 * need excessive height to fit the whole label in a single vertical run. */
function wrapLabel(label: string, threshold = 14): string {
  if (label.length <= threshold) return label;
  const mid = Math.floor(label.length / 2);
  let bestIndex = -1;
  let bestDistance = Infinity;
  for (let i = 0; i < label.length; i++) {
    if (label[i] === ' ') {
      const distance = Math.abs(i - mid);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
  }
  if (bestIndex === -1) return label;
  return `${label.slice(0, bestIndex)}\n${label.slice(bestIndex + 1)}`;
}

function columnKey(column: Column): string {
  return column.kind === 'simple' ? column.key : column.keyPrefix;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✓' : '';
  return String(value);
}

/** Change Order's 5 rows are fixed sheet row identities (2 Shop Drawing
 * Submission rows, then CO Down/Out/Back) that auto-fill in the Project List
 * widget when a project has no saved override — see `computedChangeOrderRows`
 * in apps/web/widgets/internal/project-list/index.tsx. Mirrored here so the
 * report shows the same values instead of blank dashes for un-overridden rows.
 * Only genuinely unsaved (null/undefined) values fall back to the default —
 * an explicitly-cleared empty string must stay blank, not get refilled. */
const CHANGE_ORDER_ROW_DEFAULTS = ['Shop Dwg Subm', 'Shop Dwg Subm', 'CO Down', 'CO Out', 'CO Back'];

function changeOrderCellValue(project: Record<string, any>, rowIndex: number): unknown {
  const raw = project[`changeOrderRow${rowIndex + 1}`];
  return raw !== null && raw !== undefined ? raw : CHANGE_ORDER_ROW_DEFAULTS[rowIndex];
}

/** Row 2 of Job Status / Order Date always auto-fills to the literal text
 * "Order Date" in the widget (see `computedJobStatusRow2`) when unsaved.
 * Mirrored here for the same reason as Change Order above. */
function jobStatusOrderDateCellValue(project: Record<string, any>, rowIndex: number): unknown {
  const raw = project[`jobStatusOrderDateRow${rowIndex + 1}`];
  if (rowIndex !== 1) return raw;
  return raw !== null && raw !== undefined ? raw : 'Order Date';
}

/** How many sub-rows a project's block needs: the highest Row index across all
 * stacked columns that actually has a value, at least 1 (never fewer than 1
 * so every project gets at least one row). */
function subRowCountFor(project: Record<string, any>): number {
  let max = 1;
  for (const col of COLUMNS) {
    if (col.kind !== 'stacked') continue;
    for (let n = col.rowCount; n >= 1; n--) {
      const v = col.keyPrefix === 'changeOrder' ? changeOrderCellValue(project, n - 1)
        : col.keyPrefix === 'jobStatusOrderDate' ? jobStatusOrderDateCellValue(project, n - 1)
        : project[`${col.keyPrefix}Row${n}`];
      if (v !== null && v !== undefined && v !== '') {
        if (n > max) max = n;
        break;
      }
    }
  }
  return max;
}

/** Distributes a stacked column's `rowCount` real rows evenly across the
 * project block's `subRows` grid rows (rather than anchoring them at the
 * top and leaving the remainder blank) — e.g. Factory O.C.'s 2 rows each
 * stretch to fill half of a 5-row block instead of just the first two grid
 * rows. Returns, for each real row, the [startRow, rowSpan] to render at. */
function stackedRowSpans(rowCount: number, subRows: number): Array<[start: number, span: number]> {
  const spans: Array<[number, number]> = [];
  let prevBoundary = 0;
  for (let i = 1; i <= rowCount; i++) {
    const boundary = Math.round((i / rowCount) * subRows);
    spans.push([prevBoundary, boundary - prevBoundary]);
    prevBoundary = boundary;
  }
  return spans;
}

export default function ProjectListReportModal({
  projects,
  onClose,
}: {
  projects: Record<string, any>[];
  onClose: () => void;
}) {
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const handlePrintPDF = async () => {
    if (generatingPdf) return;

    // Open the tab synchronously inside the click handler so popup blockers
    // don't kill it after the await (matches the proposal PDF flow).
    const previewWindow = window.open('', '_blank');
    setGeneratingPdf(true);
    setPdfError(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = apiClient.getToken();
      const response = await fetch(`${apiBase}/project-list-pdf/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ projects }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(detail.error || `Failed to render PDF (${response.status})`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (previewWindow && !previewWindow.closed) {
        previewWindow.location.href = url;
      } else {
        // Popup blocker killed the synchronous open — fall back to a download.
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Project_List_Report.pdf';
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: unknown) {
      previewWindow?.close();
      setPdfError(err instanceof Error ? err.message : 'Failed to generate Project List Report PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 print:relative print:bg-white print:p-0">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-list-report-title"
        className="bg-white rounded-lg shadow-xl w-full max-w-[95vw] max-h-[90vh] flex flex-col print:max-w-full print:h-auto print:max-h-none print:shadow-none print:rounded-none"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 print:hidden">
          <h2 id="project-list-report-title" className="text-lg font-bold text-brand-navy">
            Project List Report ({projects.length})
          </h2>
          <div className="flex items-center gap-2">
            {pdfError && (
              <span role="alert" className="text-xs text-red-600">{pdfError}</span>
            )}
            <button
              onClick={handlePrintPDF}
              disabled={generatingPdf}
              className="inline-flex items-center px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4 mr-1.5" />
              {generatingPdf ? 'Preparing PDF…' : 'Print'}
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

        <div className="overflow-auto flex-1 print:overflow-visible print:flex-none print:h-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 bg-gray-100 z-10 print:static">
              <tr>
                {HEADER_GROUPS.map((group, gi) =>
                  group.umbrella ? (
                    <th
                      key={`${group.umbrella}-${gi}`}
                      colSpan={group.columns.length}
                      className="font-semibold text-gray-600 px-3 py-1.5 border border-gray-300"
                    >
                      <div className="flex items-center justify-center text-center">
                        <span style={HORIZONTAL_HEADER_STYLE}>{wrapLabel(group.umbrella)}</span>
                      </div>
                    </th>
                  ) : (
                    <th
                      key={columnKey(group.columns[0]!)}
                      rowSpan={2}
                      className="font-semibold text-gray-600 px-1.5 py-1.5 border border-gray-300"
                    >
                      <div className="flex items-center justify-center text-center">
                        <span
                          style={columnKey(group.columns[0]!) === 'projectName' ? HORIZONTAL_HEADER_STYLE : VERTICAL_HEADER_STYLE}
                        >
                          {wrapLabel(group.columns[0]!.label)}
                        </span>
                      </div>
                    </th>
                  )
                )}
              </tr>
              <tr>
                {HEADER_GROUPS.filter(group => group.umbrella).flatMap(group =>
                  group.columns.map(column => {
                    const rotated = ['screenFlag', 'lutronFlag', 'checkFlag'].includes(columnKey(column));
                    return (
                      <th
                        key={columnKey(column)}
                        className="font-semibold text-gray-600 px-3 py-1.5 border border-gray-300"
                      >
                        <div className="flex items-center justify-center text-center">
                          <span style={rotated ? VERTICAL_HEADER_STYLE : HORIZONTAL_HEADER_STYLE}>
                            {wrapLabel(column.label)}
                          </span>
                        </div>
                      </th>
                    );
                  })
                )}
              </tr>
            </thead>
            {projects.map((p, pi) => {
              const subRows = subRowCountFor(p);
              return (
                <tbody key={p.id ?? pi} className="print:break-inside-avoid">
                  {Array.from({ length: subRows }, (_, ri) => (
                    <tr
                      key={`${p.id ?? pi}-${ri}`}
                      className={`${pi % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                        ri === subRows - 1 ? 'border-b-2 border-b-gray-400' : ''
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
                              className="px-3 py-1.5 border border-gray-200 whitespace-nowrap text-gray-700 align-middle text-center"
                            >
                              {col.key === 'tusOrderNumber' ? (
                                <span style={VERTICAL_CELL_STYLE}>{formatCell(p[col.key])}</span>
                              ) : (
                                formatCell(p[col.key])
                              )}
                            </td>
                          );
                        }
                        // Stacked columns' real rows (e.g. Factory O.C.'s 2) are
                        // stretched to spread evenly across the project block's full
                        // vertical space instead of being anchored at the top with
                        // blank space left below (subRows can exceed col.rowCount when
                        // some OTHER column, e.g. Change Order, needs more rows).
                        const effectiveRowCount = Math.min(col.rowCount, subRows);
                        const spans = stackedRowSpans(effectiveRowCount, subRows);
                        const spanIndex = spans.findIndex(([start]) => start === ri);
                        if (spanIndex === -1) return null;
                        const [, rowSpan] = spans[spanIndex]!;
                        const value = col.keyPrefix === 'changeOrder'
                          ? changeOrderCellValue(p, spanIndex)
                          : col.keyPrefix === 'jobStatusOrderDate'
                          ? jobStatusOrderDateCellValue(p, spanIndex)
                          : p[`${col.keyPrefix}Row${spanIndex + 1}`];
                        return (
                          <td
                            key={col.keyPrefix}
                            rowSpan={rowSpan}
                            className="px-3 py-1.5 border border-gray-200 whitespace-nowrap text-gray-700 align-middle"
                          >
                            {formatCell(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              );
            })}
            {projects.length === 0 && (
              <tbody>
                <tr>
                  <td colSpan={COLUMNS.length} className="px-3 py-8 text-center text-gray-400">
                    No projects found.
                  </td>
                </tr>
              </tbody>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

