import {
  createDefaultSearchPageLayoutSettings,
  getSearchPageLayoutForUser,
} from '../search-page-layouts';

describe('search page layouts', () => {
  it('defaults to the configured default layout', () => {
    const settings = createDefaultSearchPageLayoutSettings(['Account', 'Project']);

    expect(getSearchPageLayoutForUser(settings, 'user-1')?.objectApiNames).toEqual(['Account', 'Project']);
  });

  it('uses a valid user assignment and falls back when it is stale', () => {
    const settings = createDefaultSearchPageLayoutSettings(['Account']);
    settings.layouts.push({ id: 'projects', name: 'Projects', objectApiNames: ['Project'] });
    settings.userAssignments['user-1'] = 'projects';
    settings.userAssignments['user-2'] = 'deleted-layout';

    expect(getSearchPageLayoutForUser(settings, 'user-1')?.id).toBe('projects');
    expect(getSearchPageLayoutForUser(settings, 'user-2')?.id).toBe('default');
  });
});