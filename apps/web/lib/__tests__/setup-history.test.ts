import { trackVisit, getRecent, togglePin, getPinned, isPinned, clearHistory, type SetupHistoryEntry } from '@/lib/setup-history';

const STORE: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => (k in STORE ? STORE[k]! : null),
  setItem: (k: string, v: string) => { STORE[k] = v; },
  removeItem: (k: string) => { delete STORE[k]; },
  clear: () => { for (const k of Object.keys(STORE)) delete STORE[k]; },
};

beforeEach(() => {
  mockLocalStorage.clear();
  Object.defineProperty(globalThis, 'localStorage', { value: mockLocalStorage, configurable: true });
});

function entry(overrides: Partial<SetupHistoryEntry> = {}): SetupHistoryEntry {
  return { href: '/settings/users', title: 'Users', iconKey: 'users', ...overrides };
}

describe('trackVisit + getRecent', () => {
  it('records a visit with a timestamp', () => {
    trackVisit(entry());
    const recent = getRecent(4);
    expect(recent).toHaveLength(1);
    expect(recent[0]!.href).toBe('/settings/users');
    expect(recent[0]!.visitedAt).toBeGreaterThan(0);
  });

  it('dedupes by href, promoting the most recent', () => {
    trackVisit(entry({ href: '/settings/users' }));
    trackVisit(entry({ href: '/settings/profiles', title: 'Profiles', iconKey: 'shield' }));
    trackVisit(entry({ href: '/settings/users' }));
    const recent = getRecent(4);
    expect(recent).toHaveLength(2);
    expect(recent[0]!.href).toBe('/settings/users');
    expect(recent[1]!.href).toBe('/settings/profiles');
  });

  it('caps internal storage at 8 and display at the requested limit', () => {
    for (let i = 0; i < 12; i++) {
      trackVisit(entry({ href: `/settings/item-${i}`, title: `Item ${i}` }));
    }
    expect(getRecent(4)).toHaveLength(4);
    expect(getRecent(20)).toHaveLength(8);
  });
});

describe('togglePin + getPinned + isPinned', () => {
  it('pins and unpins by href', () => {
    expect(isPinned('/settings/users')).toBe(false);
    togglePin(entry());
    expect(isPinned('/settings/users')).toBe(true);
    expect(getPinned()).toHaveLength(1);
    togglePin(entry());
    expect(isPinned('/settings/users')).toBe(false);
    expect(getPinned()).toHaveLength(0);
  });

  it('preserves order of first pin', () => {
    togglePin(entry({ href: '/a', title: 'A' }));
    togglePin(entry({ href: '/b', title: 'B' }));
    togglePin(entry({ href: '/c', title: 'C' }));
    expect(getPinned().map(p => p.href)).toEqual(['/a', '/b', '/c']);
  });
});

describe('clearHistory', () => {
  it('wipes both recent and pinned', () => {
    trackVisit(entry());
    togglePin(entry());
    clearHistory();
    expect(getRecent(4)).toEqual([]);
    expect(getPinned()).toEqual([]);
  });
});
