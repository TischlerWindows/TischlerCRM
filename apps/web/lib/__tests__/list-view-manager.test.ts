import { applyListView, type ListViewDefinition } from '../../components/list-view-manager';

const view: ListViewDefinition = {
  id: 'active-projects',
  name: 'Active Projects',
  filters: [
    { field: 'status', operator: 'notEquals', value: 'Complete' },
    { field: 'projectName', operator: 'contains', value: 'road' },
  ],
  sortField: 'budget',
  sortDirection: 'desc',
};

describe('list view evaluation', () => {
  it('applies all saved filters and sorts matching records', () => {
    const records = [
      { projectName: 'Road North', status: 'Planning', budget: 10 },
      { projectName: 'Road South', status: 'Planning', budget: 30 },
      { projectName: 'Road Complete', status: 'Complete', budget: 50 },
      { projectName: 'River Road', status: 'Planning', budget: 20 },
    ];

    expect(applyListView(records, view).map(record => record.budget)).toEqual([30, 20, 10]);
  });

  it('supports blank checks and leaves records unchanged without a view sort', () => {
    const records = [{ name: 'A', owner: '' }, { name: 'B', owner: 'Sam' }];
    const blankOwners: ListViewDefinition = {
      ...view,
      filters: [{ field: 'owner', operator: 'isEmpty', value: '' }],
      sortField: null,
    };

    expect(applyListView(records, blankOwners)).toEqual([records[0]]);
    expect(applyListView(records, null)).toBe(records);
  });

  it('orders Recently Viewed records by the current user timestamp', () => {
    const recentlyViewed: ListViewDefinition = {
      id: 'recently-viewed',
      name: 'Recently Viewed',
      filters: [],
      sortField: null,
      sortDirection: 'desc',
    };
    const records = [{ id: 'older' }, { id: 'newer' }, { id: 'never-opened' }];

    expect(applyListView(records, recentlyViewed, { older: 10, newer: 30 })).toEqual([
      records[1],
      records[0],
    ]);
  });
});