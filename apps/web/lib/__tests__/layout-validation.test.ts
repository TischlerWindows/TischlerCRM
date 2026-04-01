import {
  validatePageLayout,
  validateRegion,
  validatePanel,
  detectGridCollisions,
  ValidationError,
  ValidationResult,
  GridCollision,
} from '@/lib/layout-validation';
import type { PageLayout, LayoutTab, LayoutSection, LayoutPanel, PanelField } from '@/lib/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(overrides: Partial<PanelField> = {}): PanelField {
  return {
    fieldApiName: 'Name',
    colSpan: 1,
    order: 0,
    labelStyle: {},
    valueStyle: {},
    behavior: 'none',
    ...overrides,
  };
}

function makePanel(overrides: Partial<LayoutPanel> = {}): LayoutPanel {
  return {
    id: 'panel-1',
    label: 'Info',
    order: 0,
    columns: 2,
    style: {},
    fields: [makeField()],
    ...overrides,
  };
}

function makeRegion(overrides: Partial<LayoutSection> = {}): LayoutSection {
  return {
    id: 'region-1',
    label: 'Information',
    gridColumn: 1,
    gridColumnSpan: 12,
    gridRow: 1,
    gridRowSpan: 1,
    style: {},
    panels: [makePanel()],
    widgets: [],
    ...overrides,
  };
}

function makeTab(overrides: Partial<LayoutTab> = {}): LayoutTab {
  return {
    id: 'tab-1',
    label: 'Details',
    order: 0,
    regions: [makeRegion()],
    ...overrides,
  };
}

function makeLayout(overrides: Partial<PageLayout> = {}): PageLayout {
  return {
    id: 'layout-1',
    name: 'Test Layout',
    tabs: [makeTab()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validatePageLayout
// ---------------------------------------------------------------------------

describe('validatePageLayout', () => {
  it('returns valid for a well-formed layout', () => {
    const result = validatePageLayout(makeLayout());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when layout has no tabs', () => {
    const result = validatePageLayout(makeLayout({ tabs: [] }));
    expect(result.valid).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('tabs');
  });

  it('fails when layout has no name', () => {
    const result = validatePageLayout(makeLayout({ name: '' }));
    expect(result.valid).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('name');
  });

  it('fails when layout has no id', () => {
    const result = validatePageLayout(makeLayout({ id: '' }));
    expect(result.valid).toBe(false);
    const paths = result.errors.map((e) => e.path);
    expect(paths).toContain('id');
  });

  it('fails when a tab has no id', () => {
    const tab = makeTab({ id: '' });
    const result = validatePageLayout(makeLayout({ tabs: [tab] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('Tab must have an id'))).toBe(true);
  });

  it('fails when a tab has no regions', () => {
    const tab = makeTab({ regions: [] });
    const result = validatePageLayout(makeLayout({ tabs: [tab] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.message.includes('at least one region'))).toBe(true);
  });

  it('collects multiple errors in one pass', () => {
    const result = validatePageLayout(makeLayout({ name: '', tabs: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// validateRegion
// ---------------------------------------------------------------------------

describe('validateRegion', () => {
  it('returns no errors for a valid region', () => {
    expect(validateRegion(makeRegion(), 'tab-1')).toHaveLength(0);
  });

  it('fails when region has no id', () => {
    const errors = validateRegion(makeRegion({ id: '' }), 'tab-1');
    expect(errors.some((e) => e.message.includes('Region must have an id'))).toBe(true);
  });

  it('fails when gridColumn is 0 (below minimum)', () => {
    const errors = validateRegion(makeRegion({ gridColumn: 0 }), 'tab-1');
    expect(errors.some((e) => e.path.includes('gridColumn'))).toBe(true);
  });

  it('fails when gridColumn is 13 (above maximum)', () => {
    const errors = validateRegion(makeRegion({ gridColumn: 13 }), 'tab-1');
    expect(errors.some((e) => e.path.includes('gridColumn'))).toBe(true);
  });

  it('fails when region exceeds 12-column grid', () => {
    // gridColumn 8 + gridColumnSpan 6 - 1 = 13 > 12
    const errors = validateRegion(makeRegion({ gridColumn: 8, gridColumnSpan: 6 }), 'tab-1');
    expect(errors.some((e) => e.message.includes('exceeds 12-column grid'))).toBe(true);
  });

  it('passes when region exactly reaches column 12', () => {
    // gridColumn 7 + gridColumnSpan 6 - 1 = 12 — valid
    const errors = validateRegion(makeRegion({ gridColumn: 7, gridColumnSpan: 6 }), 'tab-1');
    expect(errors.filter((e) => e.message.includes('exceeds 12-column grid'))).toHaveLength(0);
  });

  it('fails when gridColumnSpan is 0', () => {
    const errors = validateRegion(makeRegion({ gridColumnSpan: 0 }), 'tab-1');
    expect(errors.some((e) => e.path.includes('gridColumnSpan'))).toBe(true);
  });

  it('fails when gridRow is 0', () => {
    const errors = validateRegion(makeRegion({ gridRow: 0 }), 'tab-1');
    expect(errors.some((e) => e.path.includes('gridRow'))).toBe(true);
  });

  it('fails when gridRowSpan is 0', () => {
    const errors = validateRegion(makeRegion({ gridRowSpan: 0 }), 'tab-1');
    expect(errors.some((e) => e.path.includes('gridRowSpan'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validatePanel
// ---------------------------------------------------------------------------

describe('validatePanel', () => {
  it('returns no errors for a valid panel', () => {
    expect(validatePanel(makePanel(), 'region-1')).toHaveLength(0);
  });

  it('fails when panel has no id', () => {
    const errors = validatePanel(makePanel({ id: '' }), 'region-1');
    expect(errors.some((e) => e.message.includes('Panel must have an id'))).toBe(true);
  });

  it('fails when columns is 0 (invalid)', () => {
    const errors = validatePanel(makePanel({ columns: 0 as any }), 'region-1');
    expect(errors.some((e) => e.message.includes('columns must be 1, 2, 3, or 4'))).toBe(true);
  });

  it('fails when columns is 5 (invalid)', () => {
    const errors = validatePanel(makePanel({ columns: 5 as any }), 'region-1');
    expect(errors.some((e) => e.message.includes('columns must be 1, 2, 3, or 4'))).toBe(true);
  });

  it('accepts columns 1, 2, 3, and 4', () => {
    for (const cols of [1, 2, 3, 4] as const) {
      const errors = validatePanel(
        makePanel({ columns: cols, fields: [makeField({ colSpan: 1 })] }),
        'region-1',
      );
      expect(errors.filter((e) => e.message.includes('columns must be'))).toHaveLength(0);
    }
  });

  it('fails when field colSpan exceeds panel columns', () => {
    const errors = validatePanel(
      makePanel({ columns: 2, fields: [makeField({ colSpan: 3 })] }),
      'region-1',
    );
    expect(errors.some((e) => e.message.includes('colSpan') && e.message.includes('<= panel columns'))).toBe(true);
  });

  it('passes when field colSpan equals panel columns', () => {
    const errors = validatePanel(
      makePanel({ columns: 2, fields: [makeField({ colSpan: 2 })] }),
      'region-1',
    );
    expect(errors.filter((e) => e.message.includes('colSpan'))).toHaveLength(0);
  });

  it('fails when field is missing fieldApiName', () => {
    const errors = validatePanel(
      makePanel({ fields: [makeField({ fieldApiName: '' })] }),
      'region-1',
    );
    expect(errors.some((e) => e.message.includes('fieldApiName'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectGridCollisions
// ---------------------------------------------------------------------------

describe('detectGridCollisions', () => {
  it('returns no collisions for a single region', () => {
    expect(detectGridCollisions([makeRegion()])).toHaveLength(0);
  });

  it('returns no collisions for non-overlapping regions', () => {
    // Region A: rows 1-1, cols 1-6
    // Region B: rows 1-1, cols 7-12
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    const b = makeRegion({ id: 'b', gridColumn: 7, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    expect(detectGridCollisions([a, b])).toHaveLength(0);
  });

  it('detects a collision for two fully overlapping regions', () => {
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 12, gridRow: 1, gridRowSpan: 2 });
    const b = makeRegion({ id: 'b', gridColumn: 1, gridColumnSpan: 6,  gridRow: 1, gridRowSpan: 1 });
    const result = detectGridCollisions([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].regionA).toBe('a');
    expect(result[0].regionB).toBe('b');
    expect(result[0].overlap).toEqual({ row: 1, column: 1 });
  });

  it('detects a collision for two partially overlapping regions', () => {
    // A occupies cols 1-8, row 1
    // B occupies cols 5-12, row 1 — overlap cols 5-8, row 1
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 8, gridRow: 1, gridRowSpan: 1 });
    const b = makeRegion({ id: 'b', gridColumn: 5, gridColumnSpan: 8, gridRow: 1, gridRowSpan: 1 });
    const result = detectGridCollisions([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].overlap).toEqual({ row: 1, column: 5 });
  });

  it('reports all overlapping pairs when multiple collisions exist', () => {
    // Three regions all on the same cell
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    const b = makeRegion({ id: 'b', gridColumn: 1, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    const c = makeRegion({ id: 'c', gridColumn: 1, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    const result = detectGridCollisions([a, b, c]);
    // Pairs: a-b, a-c, b-c → 3 collisions
    expect(result).toHaveLength(3);
    const pairs = result.map((col) => [col.regionA, col.regionB].sort().join('-'));
    expect(pairs).toContain('a-b');
    expect(pairs).toContain('a-c');
    expect(pairs).toContain('b-c');
  });

  it('treats adjacent (touching) regions as non-overlapping', () => {
    // A occupies cols 1-6, B starts at col 7 (adjacent, not overlapping)
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    const b = makeRegion({ id: 'b', gridColumn: 7, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 1 });
    expect(detectGridCollisions([a, b])).toHaveLength(0);
  });

  it('detects collision when regions overlap only in the row dimension', () => {
    // A: rows 1-3, cols 1-6 — B: rows 2-4, cols 1-6 — row overlap 2-3
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 6, gridRow: 1, gridRowSpan: 3 });
    const b = makeRegion({ id: 'b', gridColumn: 1, gridColumnSpan: 6, gridRow: 2, gridRowSpan: 3 });
    const result = detectGridCollisions([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].overlap.row).toBe(2);
  });

  it('returns no collisions when row ranges do not intersect', () => {
    // A: rows 1-2, cols 1-12 — B: rows 3-4, cols 1-12 — no row overlap
    const a = makeRegion({ id: 'a', gridColumn: 1, gridColumnSpan: 12, gridRow: 1, gridRowSpan: 2 });
    const b = makeRegion({ id: 'b', gridColumn: 1, gridColumnSpan: 12, gridRow: 3, gridRowSpan: 2 });
    expect(detectGridCollisions([a, b])).toHaveLength(0);
  });
});
