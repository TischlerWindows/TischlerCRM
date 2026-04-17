import { buildSidebarItems, buildObjectItems, buildObjectSectionItems, searchIndex, type SearchItem } from '@/lib/setup-search-index';
import type { OrgSchema } from '@/lib/schema';

const schema: OrgSchema = {
  objects: [
    { apiName: 'Account', label: 'Account', pluralLabel: 'Accounts', fields: [], recordTypes: [], pageLayouts: [], validationRules: [] } as any,
    { apiName: 'Contact', label: 'Contact', pluralLabel: 'Contacts', fields: [], recordTypes: [], pageLayouts: [], validationRules: [] } as any,
  ],
  version: 1,
} as any;

describe('buildSidebarItems', () => {
  it('produces a Pages group entry for every sidebar item', () => {
    const items = buildSidebarItems();
    expect(items.every(i => i.group === 'Pages')).toBe(true);
    expect(items.find(i => i.href === '/settings/users')).toBeDefined();
  });
});

describe('buildObjectItems', () => {
  it('produces one entry per object in the schema', () => {
    const items = buildObjectItems(schema);
    expect(items).toHaveLength(2);
    expect(items[0]!.href).toBe('/object-manager/Account');
    expect(items[0]!.group).toBe('Objects');
  });
});

describe('buildObjectSectionItems', () => {
  it('produces sub-section entries for every object', () => {
    const items = buildObjectSectionItems(schema);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(i => i.group === 'Objects')).toBe(true);
    const accountFields = items.find(i => i.href === '/object-manager/Account?section=fields');
    expect(accountFields).toBeDefined();
    expect(accountFields!.secondary).toBe('Object Manager › Account');
  });
});

describe('searchIndex', () => {
  it('matches by primary label, case-insensitive', () => {
    const items: SearchItem[] = [
      { group: 'Pages', primary: 'Users', secondary: '', href: '/settings/users', iconKey: 'users' },
      { group: 'Pages', primary: 'Profiles', secondary: '', href: '/settings/profiles', iconKey: 'shield' },
    ];
    const results = searchIndex('user', items);
    expect(results.map(r => r.href)).toEqual(['/settings/users']);
  });

  it('matches by secondary text', () => {
    const items: SearchItem[] = [
      { group: 'Objects', primary: 'Fields', secondary: 'Object Manager › Account', href: '/x', iconKey: 'database' },
    ];
    expect(searchIndex('account', items)).toHaveLength(1);
  });

  it('returns empty array for empty query', () => {
    const items: SearchItem[] = [
      { group: 'Pages', primary: 'Users', secondary: '', href: '/settings/users', iconKey: 'users' },
    ];
    expect(searchIndex('', items)).toEqual([]);
  });

  it('groups results', () => {
    const items: SearchItem[] = [
      { group: 'Pages', primary: 'Users', secondary: '', href: '/settings/users', iconKey: 'users' },
      { group: 'Objects', primary: 'User', secondary: 'Object Manager › User', href: '/om/User', iconKey: 'database' },
    ];
    const results = searchIndex('user', items);
    const groups = new Set(results.map(r => r.group));
    expect(groups).toEqual(new Set(['Pages', 'Objects']));
  });
});
