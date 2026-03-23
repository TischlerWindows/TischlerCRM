/**
 * Phase 1: Editor-only presets — appends sections to the active tab. Fully editable after apply.
 *
 * Phase 2 (future): Persisted `PageLayout.pageShell` + region-based rendering in DynamicForm /
 * record-detail for true header + left/right sidebar columns at the page level (see plan:
 * page shell variant + flex/grid rows).
 */
export type LayoutPresetId =
  | 'header_1col'
  | 'two_columns'
  | 'three_columns'
  | 'four_columns'
  | 'stack_main_sidebar';

export const LAYOUT_PRESET_OPTIONS: { id: LayoutPresetId; label: string; description: string }[] = [
  { id: 'header_1col', label: 'Header + single row', description: 'One full-width section (1 column)' },
  { id: 'two_columns', label: 'Two columns', description: 'One section, 2 columns' },
  { id: 'three_columns', label: 'Three columns', description: 'One section, 3 columns' },
  { id: 'four_columns', label: 'Four columns', description: 'One section, 4 columns' },
  {
    id: 'stack_main_sidebar',
    label: 'Main + sidebar (stacked)',
    description: 'Two sections: wide main (2 cols) then narrow sidebar (1 col)',
  },
];

export interface PresetSectionSpec {
  label: string;
  columns: 1 | 2 | 3 | 4;
}

export function getPresetSections(presetId: LayoutPresetId): PresetSectionSpec[] {
  switch (presetId) {
    case 'header_1col':
      return [{ label: 'Header', columns: 1 }];
    case 'two_columns':
      return [{ label: 'Details', columns: 2 }];
    case 'three_columns':
      return [{ label: 'Details', columns: 3 }];
    case 'four_columns':
      return [{ label: 'Details', columns: 4 }];
    case 'stack_main_sidebar':
      return [
        { label: 'Main', columns: 2 },
        { label: 'Sidebar', columns: 1 },
      ];
    default:
      return [{ label: 'Details', columns: 2 }];
  }
}
