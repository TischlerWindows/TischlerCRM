import { rememberCameFrom, readCameFrom, clearCameFrom, isSetupPath } from '@/lib/setup-return-to';

const STORE: Record<string, string> = {};
const mockSessionStorage = {
  getItem: (k: string) => (k in STORE ? STORE[k]! : null),
  setItem: (k: string, v: string) => { STORE[k] = v; },
  removeItem: (k: string) => { delete STORE[k]; },
  clear: () => { for (const k of Object.keys(STORE)) delete STORE[k]; },
};

beforeEach(() => {
  mockSessionStorage.clear();
  Object.defineProperty(globalThis, 'sessionStorage', { value: mockSessionStorage, configurable: true });
});

describe('isSetupPath', () => {
  it('recognizes settings and object-manager paths', () => {
    expect(isSetupPath('/settings')).toBe(true);
    expect(isSetupPath('/settings/users')).toBe(true);
    expect(isSetupPath('/object-manager')).toBe(true);
    expect(isSetupPath('/object-manager/Account')).toBe(true);
  });

  it('rejects main CRM paths', () => {
    expect(isSetupPath('/')).toBe(false);
    expect(isSetupPath('/properties')).toBe(false);
    expect(isSetupPath('/contacts/abc')).toBe(false);
  });
});

describe('rememberCameFrom', () => {
  it('stores a non-setup path', () => {
    rememberCameFrom('/properties');
    expect(readCameFrom()).toBe('/properties');
  });

  it('does not overwrite an existing value with a setup path (lateral move)', () => {
    rememberCameFrom('/properties');
    rememberCameFrom('/settings/users');
    expect(readCameFrom()).toBe('/properties');
  });

  it('does not store a setup path when no value exists yet', () => {
    rememberCameFrom('/settings');
    expect(readCameFrom()).toBeNull();
  });

  it('clearCameFrom removes the stored value', () => {
    rememberCameFrom('/properties');
    clearCameFrom();
    expect(readCameFrom()).toBeNull();
  });
});
