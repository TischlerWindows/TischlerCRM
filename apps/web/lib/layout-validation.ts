import type { PageLayout, LayoutTab, LayoutSection, LayoutPanel } from '@/lib/schema';

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface GridCollision {
  regionA: string;
  regionB: string;
  overlap: { row: number; column: number };
}

// ---------------------------------------------------------------------------
// Field validation
// ---------------------------------------------------------------------------

function validateField(
  field: LayoutPanel['fields'][number],
  fieldIndex: number,
  panelColumns: number,
  basePath: string,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const path = `${basePath}.fields[${fieldIndex}]`;

  if (!field.fieldApiName) {
    errors.push({ path, message: 'Field must have a fieldApiName' });
  }

  if (field.colSpan < 1) {
    errors.push({ path, message: `colSpan must be >= 1 (got ${field.colSpan})` });
  } else if (field.colSpan > panelColumns) {
    errors.push({
      path,
      message: `colSpan (${field.colSpan}) must be <= panel columns (${panelColumns})`,
    });
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Panel validation
// ---------------------------------------------------------------------------

export function validatePanel(panel: LayoutPanel, regionId: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `regions[${regionId}].panels[${panel.id ?? '?'}]`;

  if (!panel.id) {
    errors.push({ path: basePath, message: 'Panel must have an id' });
  }

  const validColumns = [1, 2, 3, 4];
  if (!validColumns.includes(panel.columns)) {
    errors.push({
      path: `${basePath}.columns`,
      message: `columns must be 1, 2, 3, or 4 (got ${panel.columns})`,
    });
  }

  (panel.fields ?? []).forEach((field, fieldIndex) => {
    errors.push(...validateField(field, fieldIndex, panel.columns, basePath));
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Region validation
// ---------------------------------------------------------------------------

export function validateRegion(region: LayoutSection, tabId: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const basePath = `tabs[${tabId}].regions[${region.id ?? '?'}]`;

  if (!region.id) {
    errors.push({ path: basePath, message: 'Region must have an id' });
  }

  if (region.gridColumn < 1 || region.gridColumn > 12) {
    errors.push({
      path: `${basePath}.gridColumn`,
      message: `gridColumn must be >= 1 and <= 12 (got ${region.gridColumn})`,
    });
  }

  if (region.gridColumnSpan < 1) {
    errors.push({
      path: `${basePath}.gridColumnSpan`,
      message: `gridColumnSpan must be >= 1 (got ${region.gridColumnSpan})`,
    });
  }

  const rightEdge = region.gridColumn + region.gridColumnSpan - 1;
  if (rightEdge > 12) {
    errors.push({
      path: `${basePath}.gridColumnSpan`,
      message: `Region exceeds 12-column grid: gridColumn (${region.gridColumn}) + gridColumnSpan (${region.gridColumnSpan}) - 1 = ${rightEdge} > 12`,
    });
  }

  if (region.gridRow < 1) {
    errors.push({
      path: `${basePath}.gridRow`,
      message: `gridRow must be >= 1 (got ${region.gridRow})`,
    });
  }

  if (region.gridRowSpan < 1) {
    errors.push({
      path: `${basePath}.gridRowSpan`,
      message: `gridRowSpan must be >= 1 (got ${region.gridRowSpan})`,
    });
  }

  (region.panels ?? []).forEach((panel) => {
    errors.push(...validatePanel(panel, region.id));
  });

  return errors;
}

// ---------------------------------------------------------------------------
// Layout validation
// ---------------------------------------------------------------------------

export function validatePageLayout(layout: PageLayout): ValidationResult {
  const errors: ValidationError[] = [];

  if (!layout.id) {
    errors.push({ path: 'id', message: 'Layout must have an id' });
  }

  if (!layout.name) {
    errors.push({ path: 'name', message: 'Layout must have a name' });
  }

  if (!layout.tabs || layout.tabs.length === 0) {
    errors.push({ path: 'tabs', message: 'Layout must have at least one tab' });
  } else {
    layout.tabs.forEach((tab, tabIndex) => {
      const tabPath = `tabs[${tabIndex}]`;

      if (!tab.id) {
        errors.push({ path: `${tabPath}.id`, message: 'Tab must have an id' });
      }

      if (!tab.regions || tab.regions.length === 0) {
        errors.push({
          path: `${tabPath}.regions`,
          message: 'Tab must have at least one region',
        });
      } else {
        tab.regions.forEach((region) => {
          errors.push(...validateRegion(region, tab.id));
        });
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Grid collision detection
// ---------------------------------------------------------------------------

/**
 * Returns true when two axis-aligned rectangles overlap (strictly — touching
 * edges/corners do NOT count as a collision).
 */
function rectanglesOverlap(
  aRow: number, aRowSpan: number, aCol: number, aColSpan: number,
  bRow: number, bRowSpan: number, bCol: number, bColSpan: number,
): boolean {
  const aRowEnd = aRow + aRowSpan - 1;
  const aColEnd = aCol + aColSpan - 1;
  const bRowEnd = bRow + bRowSpan - 1;
  const bColEnd = bCol + bColSpan - 1;

  return aRow <= bRowEnd && aRowEnd >= bRow && aCol <= bColEnd && aColEnd >= bCol;
}

/**
 * Finds one overlap cell between two overlapping rectangles.
 */
function overlapPoint(
  aRow: number, aRowSpan: number, aCol: number, aColSpan: number,
  bRow: number, bRowSpan: number, bCol: number, bColSpan: number,
): { row: number; column: number } {
  const row = Math.max(aRow, bRow);
  const column = Math.max(aCol, bCol);
  return { row, column };
}

export function detectGridCollisions(regions: LayoutSection[]): GridCollision[] {
  const collisions: GridCollision[] = [];

  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      const a = regions[i];
      const b = regions[j];

      if (
        rectanglesOverlap(
          a.gridRow, a.gridRowSpan, a.gridColumn, a.gridColumnSpan,
          b.gridRow, b.gridRowSpan, b.gridColumn, b.gridColumnSpan,
        )
      ) {
        const overlap = overlapPoint(
          a.gridRow, a.gridRowSpan, a.gridColumn, a.gridColumnSpan,
          b.gridRow, b.gridRowSpan, b.gridColumn, b.gridColumnSpan,
        );
        collisions.push({ regionA: a.id, regionB: b.id, overlap });
      }
    }
  }

  return collisions;
}
