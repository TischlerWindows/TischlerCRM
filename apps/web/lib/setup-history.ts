const RECENT_KEY = 'tischler-setup-recent';
const PINNED_KEY = 'tischler-setup-pinned';
const RECENT_CAP = 8;

export interface SetupHistoryEntry {
  href: string;
  title: string;
  iconKey: string;
  visitedAt?: number;
}

function readArray<T>(key: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function trackVisit(entry: Omit<SetupHistoryEntry, 'visitedAt'>): void {
  const now = Date.now();
  const existing = readArray<SetupHistoryEntry>(RECENT_KEY);
  const deduped = existing.filter(e => e.href !== entry.href);
  const next = [{ ...entry, visitedAt: now }, ...deduped].slice(0, RECENT_CAP);
  writeArray(RECENT_KEY, next);
}

export function getRecent(limit: number): SetupHistoryEntry[] {
  return readArray<SetupHistoryEntry>(RECENT_KEY).slice(0, limit);
}

export function togglePin(entry: Omit<SetupHistoryEntry, 'visitedAt'>): void {
  const existing = readArray<SetupHistoryEntry>(PINNED_KEY);
  const has = existing.some(e => e.href === entry.href);
  const next = has
    ? existing.filter(e => e.href !== entry.href)
    : [...existing, { href: entry.href, title: entry.title, iconKey: entry.iconKey }];
  writeArray(PINNED_KEY, next);
}

export function getPinned(): SetupHistoryEntry[] {
  return readArray<SetupHistoryEntry>(PINNED_KEY);
}

export function isPinned(href: string): boolean {
  return readArray<SetupHistoryEntry>(PINNED_KEY).some(e => e.href === href);
}

export function clearHistory(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(RECENT_KEY);
  localStorage.removeItem(PINNED_KEY);
}
