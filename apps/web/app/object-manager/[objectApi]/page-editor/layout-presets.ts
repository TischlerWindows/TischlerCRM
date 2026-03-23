/**
 * Layout presets replace the active tab with row-grouped sections (side-by-side regions).
 * Phase 2+: persisted page shell in schema (see earlier plan).
 */
export type LayoutPresetId =
  | 'header_1col'
  | 'two_regions'
  | 'three_regions'
  | 'four_regions'
  | 'main_sidebar'
  | 'header_two_below';

export const LAYOUT_PRESET_OPTIONS: { id: LayoutPresetId; label: string; description: string }[] = [
  { id: 'header_1col', label: 'Header + single region', description: 'One full-width section' },
  {
    id: 'two_regions',
    label: 'Two regions (side by side)',
    description: 'Two sections in one row, equal width',
  },
  {
    id: 'three_regions',
    label: 'Three regions',
    description: 'Three sections in one row',
  },
  {
    id: 'four_regions',
    label: 'Four regions',
    description: 'Four sections in one row',
  },
  {
    id: 'main_sidebar',
    label: 'Main + sidebar',
    description: 'Wide main and narrow sidebar in one row',
  },
  {
    id: 'header_two_below',
    label: 'Header + two below',
    description: 'Full-width header, then two equal sections',
  },
];

export interface PresetSectionSpec {
  label: string;
  columns: 1 | 2 | 3 | 4;
  /** Same id = same horizontal row */
  layoutRowId: string;
  rowWeight: number;
}

const ROW_MAIN = 'row-main';

export function getPresetSections(presetId: LayoutPresetId): PresetSectionSpec[] {
  switch (presetId) {
    case 'header_1col':
      return [{ label: 'Header', columns: 1, layoutRowId: 'row-a', rowWeight: 1 }];
    case 'two_regions':
      return [
        { label: 'Left', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
        { label: 'Right', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
      ];
    case 'three_regions':
      return [
        { label: 'Column A', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
        { label: 'Column B', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
        { label: 'Column C', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
      ];
    case 'four_regions':
      return [
        { label: 'Region 1', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
        { label: 'Region 2', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
        { label: 'Region 3', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
        { label: 'Region 4', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
      ];
    case 'main_sidebar':
      return [
        { label: 'Main', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 2 },
        { label: 'Sidebar', columns: 1, layoutRowId: ROW_MAIN, rowWeight: 1 },
      ];
    case 'header_two_below':
      return [
        { label: 'Header', columns: 1, layoutRowId: 'row-header', rowWeight: 1 },
        { label: 'Left', columns: 1, layoutRowId: 'row-body', rowWeight: 1 },
        { label: 'Right', columns: 1, layoutRowId: 'row-body', rowWeight: 1 },
      ];
    default:
      return [{ label: 'Details', columns: 2, layoutRowId: 'row-a', rowWeight: 1 }];
  }
}
