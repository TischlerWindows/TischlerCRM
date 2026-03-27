import type { TemplateSectionDef, TemplateTabDef } from '@/lib/schema';

export type TemplateCategory =
  | 'all'
  | 'single'
  | 'two-regions'
  | 'three-regions'
  | 'with-header'
  | 'complex'
  | 'saved-custom';

export interface BuiltInTemplate {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory[];
  getTabs: () => TemplateTabDef[];
}

function makeRegion(
  label: string,
  gridColumn: number,
  gridColumnSpan: number,
  gridRow: number,
): TemplateSectionDef {
  return {
    id: `region-${label.toLowerCase().replace(/\s+/g, '-')}-${gridRow}-${gridColumn}`,
    label,
    gridColumn,
    gridColumnSpan,
    gridRow,
    gridRowSpan: 1,
    style: {},
    panels: [],
  };
}

function makeTab(regions: TemplateSectionDef[]): TemplateTabDef {
  return { id: 'tab-1', label: 'Details', order: 0, regions };
}

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    description: 'Start with a completely empty layout',
    category: ['all', 'single'],
    getTabs: () => [makeTab([])],
  },
  {
    id: 'full-width',
    name: 'Full Width',
    description: 'One full-width region spanning the entire canvas',
    category: ['all', 'single'],
    getTabs: () => [makeTab([makeRegion('Main', 1, 12, 1)])],
  },
  {
    id: 'header-main',
    name: 'Header + Main',
    description: 'Full-width header row followed by a full-width main region',
    category: ['all', 'with-header'],
    getTabs: () => [
      makeTab([
        makeRegion('Header', 1, 12, 1),
        makeRegion('Main', 1, 12, 2),
      ]),
    ],
  },
  {
    id: 'header-left-sidebar',
    name: 'Header + Left Sidebar',
    description: 'Header row with a narrow left sidebar and wide main area below',
    category: ['all', 'with-header', 'two-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Header', 1, 12, 1),
        makeRegion('Sidebar', 1, 4, 2),
        makeRegion('Main', 5, 8, 2),
      ]),
    ],
  },
  {
    id: 'header-right-sidebar',
    name: 'Header + Right Sidebar',
    description: 'Header row with a wide main area and narrow right sidebar below',
    category: ['all', 'with-header', 'two-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Header', 1, 12, 1),
        makeRegion('Main', 1, 8, 2),
        makeRegion('Sidebar', 9, 4, 2),
      ]),
    ],
  },
  {
    id: 'header-3-equal',
    name: 'Header + 3 Equal',
    description: 'Header row followed by three equal-width columns',
    category: ['all', 'with-header', 'three-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Header', 1, 12, 1),
        makeRegion('Left', 1, 4, 2),
        makeRegion('Center', 5, 4, 2),
        makeRegion('Right', 9, 4, 2),
      ]),
    ],
  },
  {
    id: 'two-equal',
    name: 'Two Equal',
    description: 'Two equal-width columns side by side',
    category: ['all', 'two-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Left', 1, 6, 1),
        makeRegion('Right', 7, 6, 1),
      ]),
    ],
  },
  {
    id: 'two-unequal',
    name: 'Two Unequal',
    description: 'Wide main content area with a narrow sidebar',
    category: ['all', 'two-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Main', 1, 8, 1),
        makeRegion('Sidebar', 9, 4, 1),
      ]),
    ],
  },
  {
    id: 'three-equal',
    name: 'Three Equal',
    description: 'Three equal-width columns',
    category: ['all', 'three-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Left', 1, 4, 1),
        makeRegion('Center', 5, 4, 1),
        makeRegion('Right', 9, 4, 1),
      ]),
    ],
  },
  {
    id: 'header-2-below',
    name: 'Header + 2 Below',
    description: 'Full-width header with two equal columns below',
    category: ['all', 'with-header', 'two-regions'],
    getTabs: () => [
      makeTab([
        makeRegion('Header', 1, 12, 1),
        makeRegion('Left', 1, 6, 2),
        makeRegion('Right', 7, 6, 2),
      ]),
    ],
  },
  {
    id: 'complex',
    name: 'Complex (5 regions)',
    description:
      'Header, wide main with sidebar, secondary section, and footer',
    category: ['all', 'complex'],
    getTabs: () => [
      makeTab([
        makeRegion('Header', 1, 12, 1),
        makeRegion('Main', 1, 8, 2),
        makeRegion('Sidebar', 9, 4, 2),
        makeRegion('Secondary', 1, 12, 3),
        makeRegion('Footer', 1, 12, 4),
      ]),
    ],
  },
];

export const TEMPLATE_CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All Templates' },
  { id: 'single', label: 'Single Region' },
  { id: 'two-regions', label: 'Two Regions' },
  { id: 'three-regions', label: 'Three Regions' },
  { id: 'with-header', label: 'With Header' },
  { id: 'complex', label: 'Complex' },
  { id: 'saved-custom', label: 'Saved Custom' },
];
