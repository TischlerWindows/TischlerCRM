import { migrateLegacyLayout, isLegacyLayout } from '@/lib/layout-migration';
import type { LegacyPageLayout } from '@/lib/schema';

function makeLegacyLayout(overrides: Partial<LegacyPageLayout> = {}): LegacyPageLayout {
  return {
    id: 'layout-1',
    name: 'Test Layout',
    objectApi: 'Account',
    active: true,
    isDefault: false,
    roles: ['Admin'],
    tabs: [
      {
        id: 'tab-1',
        label: 'Details',
        order: 0,
        sections: [
          {
            id: 'section-1',
            label: 'Information',
            columns: 2,
            order: 0,
            fields: [
              { apiName: 'Name', column: 0, order: 0 },
              { apiName: 'Email', column: 1, order: 1, required: true },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe('migrateLegacyLayout', () => {
  it('converts a legacy layout with PageTab/PageSection/PageField correctly', () => {
    const legacy = makeLegacyLayout();
    const result = migrateLegacyLayout(legacy);

    expect(result.id).toBe('layout-1');
    expect(result.name).toBe('Test Layout');
    expect(result.objectApi).toBe('Account');
    expect(result.active).toBe(true);
    expect(result.isDefault).toBe(false);
    expect(result.roles).toEqual(['Admin']);

    // Should have one tab
    expect(result.tabs).toHaveLength(1);
    const tab = result.tabs[0];
    expect(tab.label).toBe('Details');
    expect(tab.order).toBe(0);

    // Should have one region (converted from the section)
    expect(tab.regions).toHaveLength(1);
    const region = tab.regions[0];
    expect(region.label).toBe('Information');
    expect(region.gridColumn).toBe(1);
    expect(region.gridColumnSpan).toBe(12);

    // Region should have one panel
    expect(region.panels).toHaveLength(1);
    const panel = region.panels[0];
    expect(panel.label).toBe('Information');
    expect(panel.columns).toBe(2);

    // Panel should have the converted fields
    expect(panel.fields).toHaveLength(2);
    expect(panel.fields[0].fieldApiName).toBe('Name');
    expect(panel.fields[0].behavior).toBe('none');
    expect(panel.fields[1].fieldApiName).toBe('Email');
    expect(panel.fields[1].behavior).toBe('required');
  });

  it('uses extensions.editorTabs directly when present', () => {
    const legacy = makeLegacyLayout({
      extensions: {
        editorTabs: [
          {
            id: 'editor-tab-1',
            label: 'Custom Tab',
            order: 0,
            regions: [
              {
                id: 'region-1',
                label: 'Custom Region',
                gridColumn: 1,
                gridColumnSpan: 6,
                gridRow: 1,
                gridRowSpan: 1,
                style: {},
                panels: [
                  {
                    id: 'panel-1',
                    label: 'Custom Panel',
                    order: 0,
                    columns: 3,
                    style: {},
                    fields: [
                      {
                        fieldApiName: 'Revenue',
                        colSpan: 1,
                        order: 0,
                        behavior: 'readOnly',
                        labelStyle: {},
                        valueStyle: {},
                      },
                    ],
                  },
                ],
                widgets: [],
              },
            ],
          },
        ],
        version: 1,
      },
    });

    const result = migrateLegacyLayout(legacy);

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].label).toBe('Custom Tab');
    expect(result.tabs[0].regions[0].label).toBe('Custom Region');
    expect(result.tabs[0].regions[0].gridColumnSpan).toBe(6);
    expect(result.tabs[0].regions[0].panels[0].columns).toBe(3);
    expect(result.tabs[0].regions[0].panels[0].fields[0].fieldApiName).toBe('Revenue');
    expect(result.tabs[0].regions[0].panels[0].fields[0].behavior).toBe('readOnly');
  });

  it('handles missing/malformed data with sensible defaults', () => {
    const legacy: LegacyPageLayout = {
      id: '',
      name: '',
      tabs: [
        {
          id: '',
          label: '',
          order: 0,
          sections: [
            {
              id: '',
              label: '',
              columns: 2,
              order: 0,
              fields: [
                { apiName: 'Name', column: 0, order: 0 },
              ],
            },
          ],
        },
      ],
    };

    const result = migrateLegacyLayout(legacy);

    expect(result.id).toBe('');
    expect(result.name).toBe('Layout'); // default name
    expect(result.active).toBe(false);
    expect(result.isDefault).toBe(false);
    expect(result.roles).toEqual([]);
    expect(result.tabs).toHaveLength(1);
    // Fields should still convert
    expect(result.tabs[0].regions[0].panels[0].fields[0].fieldApiName).toBe('Name');
  });

  it('preserves top-level formatting rules', () => {
    const rules = [
      {
        id: 'rule-1',
        name: 'Hide Revenue',
        active: true,
        order: 0,
        when: [{ left: 'Stage', op: '==' as const, right: 'Closed' }],
        target: { kind: 'field' as const, fieldApiName: 'Revenue', panelId: 'panel-1' },
        effects: { hidden: true },
      },
    ];
    const legacy = makeLegacyLayout({ formattingRules: rules });
    const result = migrateLegacyLayout(legacy);

    expect(result.formattingRules).toEqual(rules);
  });

  it('falls back to extensions.formattingRules when top-level is empty', () => {
    const rules = [
      {
        id: 'rule-ext',
        name: 'Ext Rule',
        active: true,
        order: 0,
        when: [],
        target: { kind: 'panel' as const, panelId: 'panel-1' },
        effects: { readOnly: true },
      },
    ];
    const legacy = makeLegacyLayout({
      formattingRules: [],
      extensions: { formattingRules: rules },
    });
    const result = migrateLegacyLayout(legacy);

    expect(result.formattingRules).toEqual(rules);
  });

  it('converts widgets from legacy sections', () => {
    const legacy = makeLegacyLayout({
      tabs: [
        {
          id: 'tab-1',
          label: 'Details',
          order: 0,
          sections: [
            {
              id: 'section-1',
              label: 'Info',
              columns: 2,
              order: 0,
              fields: [],
              widgets: [
                {
                  id: 'widget-1',
                  widgetType: 'RelatedList',
                  column: 0,
                  order: 0,
                  config: {
                    type: 'RelatedList',
                    relatedObjectApiName: 'Contact',
                    relationshipFieldApiName: 'AccountId',
                    displayColumns: ['Name', 'Email'],
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    const result = migrateLegacyLayout(legacy);
    const widgets = result.tabs[0].regions[0].widgets;

    expect(widgets).toHaveLength(1);
    expect(widgets[0].widgetType).toBe('RelatedList');
    expect(widgets[0].config.type).toBe('RelatedList');
    if (widgets[0].config.type === 'RelatedList') {
      expect(widgets[0].config.relatedObjectApiName).toBe('Contact');
    }
  });

  it('converts tab-level widgets to separate regions', () => {
    const legacy = makeLegacyLayout({
      tabs: [
        {
          id: 'tab-1',
          label: 'Details',
          order: 0,
          sections: [],
          widgets: [
            {
              id: 'tab-widget-1',
              widgetType: 'ActivityFeed',
              column: 0,
              order: 0,
              config: { type: 'ActivityFeed', maxItems: 5 },
            },
          ],
        },
      ],
    });

    const result = migrateLegacyLayout(legacy);
    expect(result.tabs[0].regions).toHaveLength(1);
    const region = result.tabs[0].regions[0];
    expect(region.panels).toHaveLength(0);
    expect(region.widgets).toHaveLength(1);
    expect(region.widgets[0].widgetType).toBe('ActivityFeed');
  });

  it('provides a blank tab when layout has no tabs', () => {
    const legacy = makeLegacyLayout({ tabs: [] });
    const result = migrateLegacyLayout(legacy);

    expect(result.tabs).toHaveLength(1);
    expect(result.tabs[0].label).toBe('Details');
    expect(result.tabs[0].regions).toEqual([]);
  });

  it('converts readOnly fields correctly', () => {
    const legacy = makeLegacyLayout({
      tabs: [
        {
          id: 'tab-1',
          label: 'Details',
          order: 0,
          sections: [
            {
              id: 'section-1',
              label: 'Info',
              columns: 1,
              order: 0,
              fields: [
                { apiName: 'CreatedDate', column: 0, order: 0, readOnly: true },
              ],
            },
          ],
        },
      ],
    });

    const result = migrateLegacyLayout(legacy);
    expect(result.tabs[0].regions[0].panels[0].fields[0].behavior).toBe('readOnly');
  });

  it('preserves colSpan from legacy fields', () => {
    const legacy = makeLegacyLayout({
      tabs: [
        {
          id: 'tab-1',
          label: 'Details',
          order: 0,
          sections: [
            {
              id: 'section-1',
              label: 'Info',
              columns: 2,
              order: 0,
              fields: [
                { apiName: 'Description', column: 0, order: 0, colSpan: 2 },
              ],
            },
          ],
        },
      ],
    });

    const result = migrateLegacyLayout(legacy);
    expect(result.tabs[0].regions[0].panels[0].fields[0].colSpan).toBe(2);
  });
});

describe('isLegacyLayout', () => {
  it('returns true for a layout with sections-based tabs', () => {
    const layout = {
      id: '1',
      name: 'Test',
      tabs: [
        {
          id: 'tab-1',
          label: 'Details',
          order: 0,
          sections: [{ id: 's1', label: 'Info', columns: 2, order: 0, fields: [] }],
        },
      ],
    };
    expect(isLegacyLayout(layout)).toBe(true);
  });

  it('returns false for a layout with regions-based tabs', () => {
    const layout = {
      id: '1',
      name: 'Test',
      tabs: [
        {
          id: 'tab-1',
          label: 'Details',
          order: 0,
          regions: [],
        },
      ],
    };
    expect(isLegacyLayout(layout)).toBe(false);
  });

  it('returns false for null/undefined', () => {
    expect(isLegacyLayout(null)).toBe(false);
    expect(isLegacyLayout(undefined)).toBe(false);
  });

  it('returns false for an empty tabs array', () => {
    expect(isLegacyLayout({ tabs: [] })).toBe(false);
  });

  it('returns false for a non-object', () => {
    expect(isLegacyLayout('string')).toBe(false);
    expect(isLegacyLayout(42)).toBe(false);
  });

  it('returns false when first tab has both sections and regions', () => {
    // If regions array is present, it's not legacy even if sections also exists
    const layout = {
      tabs: [{ id: 't1', label: 'T', order: 0, sections: [], regions: [] }],
    };
    expect(isLegacyLayout(layout)).toBe(false);
  });
});
