import { evaluateVisibility } from './field-visibility';
import {
  getFormattingEffectsForField,
  getFormattingEffectsForPanel,
  getFormattingEffectsForRegion,
  getFormattingEffectsForTab,
} from './layout-formatting';
import type {
  FieldDef,
  LabelStyle,
  ObjectDef,
  PageLayout,
  PanelField,
  ValueStyle,
} from './schema';
import { formatFieldValue } from './utils';

interface GenerateRecordPdfOptions {
  objectDef: ObjectDef;
  pageLayout: PageLayout;
  record: Record<string, unknown>;
  title: string;
}

interface PdfField {
  label: string;
  value: string;
  populated: boolean;
  labelStyle: LabelStyle;
  valueStyle: ValueStyle;
}

const NAVY = [30, 58, 95] as const;
const RED = [218, 41, 28] as const;
const TEXT = [31, 41, 55] as const;
const MUTED = [107, 114, 128] as const;
const LINE = [209, 213, 219] as const;
const PAGE_MARGIN = 16;
const PAGE_TOP = 18;
const PAGE_BOTTOM = 17;

type PdfColor = readonly [number, number, number];

function parseHexColor(color: string | undefined, fallback: PdfColor): PdfColor {
  if (!color) return fallback;
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());
  if (!match) return fallback;
  const hex = match[1].length === 3
    ? match[1].split('').map((character) => character + character).join('')
    : match[1];
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function toPdfFontSize(pixelSize: number | undefined, fallback: number): number {
  return pixelSize ? Math.max(6, pixelSize * 0.75) : fallback;
}

function getFontStyle(style: { bold?: boolean; italic?: boolean }): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  if (style.bold && style.italic) return 'bolditalic';
  if (style.bold) return 'bold';
  if (style.italic) return 'italic';
  return 'normal';
}

function getLabelFontStyle(style: LabelStyle): 'normal' | 'bold' | 'italic' | 'bolditalic' {
  return getFontStyle({ ...style, bold: style.bold !== false });
}

function hasFieldValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '' || value === 'N/A') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.values(value).some(hasFieldValue);
  return true;
}

function readRecordValue(
  field: FieldDef,
  record: Record<string, unknown>,
): unknown {
  const bareName = field.apiName.replace(/^[A-Za-z]+__/, '');
  const value = record[field.apiName] ?? record[bareName];
  if (value !== undefined && value !== null && value !== '') return value;
  if (field.type === 'URL' && field.staticUrl) return field.staticUrl;
  return value;
}

function formatPdfValue(value: unknown, field: FieldDef): string {
  if (field.type === 'EncryptedText' && value) return '********';
  const formatted = formatFieldValue(value, field.type, field.lookupObject);
  return formatted || '-';
}

function getVisibleFields(
  panelFields: PanelField[],
  objectDef: ObjectDef,
  pageLayout: PageLayout,
  record: Record<string, unknown>,
): PdfField[] {
  return [...panelFields]
    .sort((left, right) => left.order - right.order)
    .flatMap((placement) => {
      if (placement.kind && placement.kind !== 'field') return [];
      if (placement.behavior === 'hidden' || placement.hideOnView || placement.hideOnExisting) {
        return [];
      }

      const field = objectDef.fields.find((candidate) => candidate.apiName === placement.fieldApiName);
      if (!field) return [];
      if (!evaluateVisibility(field.visibleIf, record)) return [];
      if (placement.visibleIf?.length && !evaluateVisibility(placement.visibleIf, record)) return [];
      if (getFormattingEffectsForField(pageLayout, field.apiName, record)?.hidden) return [];

      const rawValue = readRecordValue(field, record);
      return [{
        label: placement.labelOverride || field.label,
        value: formatPdfValue(rawValue, field),
        populated: hasFieldValue(rawValue),
        labelStyle: placement.labelStyle ?? {},
        valueStyle: placement.valueStyle ?? {},
      }];
    });
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || 'Record';
}

export async function generateRecordPdf({
  objectDef,
  pageLayout,
  record,
  title,
}: GenerateRecordPdfOptions): Promise<{ blob: Blob; filename: string }> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - PAGE_MARGIN * 2;
  let cursorY = PAGE_TOP;

  const drawPageHeader = () => {
    doc.setTextColor(...NAVY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(17);
    doc.text('TISCHLER', PAGE_MARGIN, PAGE_TOP);
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.8);
    doc.line(PAGE_MARGIN, PAGE_TOP + 3, pageWidth - PAGE_MARGIN, PAGE_TOP + 3);
    cursorY = PAGE_TOP + 10;
  };

  const addPage = () => {
    doc.addPage();
    drawPageHeader();
  };

  const ensureSpace = (height: number) => {
    if (cursorY + height > pageHeight - PAGE_BOTTOM) addPage();
  };

  const drawSectionHeading = (label: string, level: 'tab' | 'panel') => {
    const heading = label.toUpperCase();
    const height = level === 'tab' ? 10 : 11;
    ensureSpace(height + 4);
    if (level === 'tab') {
      cursorY += 3;
      doc.setFillColor(...NAVY);
      doc.rect(PAGE_MARGIN, cursorY, contentWidth, height, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(heading, PAGE_MARGIN + 3, cursorY + 6.5);
    } else {
      doc.setFillColor(242, 244, 247);
      doc.setDrawColor(...LINE);
      doc.rect(PAGE_MARGIN, cursorY, contentWidth, height, 'FD');
      doc.setTextColor(...TEXT);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(heading, PAGE_MARGIN + 3, cursorY + 7);
    }
    cursorY += height + 2;
  };

  const drawFieldRows = (fields: PdfField[]) => {
    const gap = 5;
    const columnWidth = (contentWidth - gap) / 2;
    for (let index = 0; index < fields.length; index += 2) {
      const pair = fields.slice(index, index + 2);
      const cells = pair.map((field) => {
        const labelFontSize = toPdfFontSize(field.labelStyle.fontSize, 11);
        const valueFontSize = toPdfFontSize(field.valueStyle.fontSize, 10.5);
        doc.setFont('helvetica', getFontStyle(field.valueStyle));
        doc.setFontSize(valueFontSize);
        return {
          ...field,
          labelFontSize,
          valueFontSize,
          lines: doc.splitTextToSize(field.value, columnWidth - 4) as string[],
        };
      });
      const rowHeight = Math.max(
        14,
        ...cells.map((cell) => 4 + cell.labelFontSize * 0.4 + cell.lines.length * cell.valueFontSize * 0.42),
      );
      ensureSpace(rowHeight + 1);

      cells.forEach((cell, columnIndex) => {
        const x = PAGE_MARGIN + columnIndex * (columnWidth + gap);
        const label = cell.labelStyle.uppercase ? cell.label.toUpperCase() : cell.label;
        const labelY = cursorY + 3.5;
        const valueY = labelY + cell.labelFontSize * 0.42 + 2;
        const labelColor = parseHexColor(cell.labelStyle.color, MUTED);
        const valueColor = parseHexColor(cell.valueStyle.color, TEXT);

        if (cell.valueStyle.background) {
          doc.setFillColor(...parseHexColor(cell.valueStyle.background, [255, 255, 255]));
          doc.roundedRect(x - 1, valueY - 3.5, columnWidth - 2, rowHeight - (valueY - cursorY), 1, 1, 'F');
        }

        doc.setTextColor(...labelColor);
        doc.setFont('helvetica', getLabelFontStyle(cell.labelStyle));
        doc.setFontSize(cell.labelFontSize);
        doc.text(label, x, labelY);
        doc.setTextColor(...valueColor);
        doc.setFont('helvetica', getFontStyle(cell.valueStyle));
        doc.setFontSize(cell.valueFontSize);
        doc.text(cell.lines, x, valueY);
      });

      doc.setDrawColor(232, 234, 238);
      doc.setLineWidth(0.2);
      doc.line(PAGE_MARGIN, cursorY + rowHeight, pageWidth - PAGE_MARGIN, cursorY + rowHeight);
      cursorY += rowHeight + 1;
    }
  };

  drawPageHeader();
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(objectDef.label.toUpperCase(), PAGE_MARGIN, cursorY);
  cursorY += 6;
  doc.setTextColor(...TEXT);
  doc.setFontSize(18);
  doc.text(doc.splitTextToSize(title, contentWidth), PAGE_MARGIN, cursorY);
  cursorY += 11;
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Generated ${new Date().toLocaleString()}`, PAGE_MARGIN, cursorY);
  cursorY += 7;

  const tabs = [...pageLayout.tabs]
    .filter((tab) => {
      if (tab.hideOnView || tab.hideOnExisting) return false;
      return !getFormattingEffectsForTab(pageLayout, tab.id, record)?.hidden;
    })
    .sort((left, right) => left.order - right.order);

  for (const tab of tabs) {
    const visiblePanels = [...(tab.regions ?? [])]
      .filter((region) => {
        if (region.hidden || region.hideOnView || region.hideOnExisting) return false;
        if (region.visibleIf?.length && !evaluateVisibility(region.visibleIf, record)) return false;
        return !getFormattingEffectsForRegion(pageLayout, region.id, record)?.hidden;
      })
      .sort((left, right) => left.gridRow - right.gridRow || left.gridColumn - right.gridColumn)
      .flatMap((region) => [...(region.panels ?? [])]
        .filter((panel) => {
          if (panel.panelType === 'components' || panel.hidden || panel.hideOnView || panel.hideOnExisting) {
            return false;
          }
          if (panel.visibleIf?.length && !evaluateVisibility(panel.visibleIf, record)) return false;
          return !getFormattingEffectsForPanel(pageLayout, panel.id, record)?.hidden;
        })
        .sort((left, right) => left.order - right.order)
        .map((panel) => ({
          panel,
          fields: getVisibleFields(panel.fields ?? [], objectDef, pageLayout, record),
        })))
      .filter(({ fields }) => fields.some((field) => field.populated));

    if (visiblePanels.length === 0) continue;
    drawSectionHeading(tab.label || 'Details', 'tab');
    for (const { panel, fields } of visiblePanels) {
      drawSectionHeading(panel.label || 'Information', 'panel');
      drawFieldRows(fields);
      cursorY += 6;
    }
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(PAGE_MARGIN, pageHeight - 12, pageWidth - PAGE_MARGIN, pageHeight - 12);
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(`${objectDef.label} record`, PAGE_MARGIN, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - PAGE_MARGIN, pageHeight - 7, { align: 'right' });
  }

  return {
    blob: doc.output('blob'),
    filename: `${safeFilename(title)}.pdf`,
  };
}