# Settings & Object Manager Navigation / UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Settings feel fast: every Setup/Object Manager page exits to the main CRM or `/settings` in one click, the sidebar IA reflects mental model, `/settings` surfaces the 2–3 destinations a user returns to most, and a typeahead search reaches any deep setting (object field, user, profile) without hunting.

**Architecture:** Five small `lib/` modules own the stateful logic (return-to, visit history, pinned, icon registry, search index) — all unit-tested pure TypeScript. A handful of shared React components (`ObjectManagerTopBar`, `ExitSetupPill`, `SetupBreadcrumb`, `SetupSearchTypeahead`, landing-page strips) wrap them. Existing pages are minimally modified — mostly swapping inline chrome for the new components and regrouping items. Visual polish is a consistency audit, not new design.

**Tech Stack:** Next.js 14.2 (App Router), React 18, TypeScript 5.4, Tailwind, Zustand (existing `useSchemaStore`), Jest 30 + ts-jest for unit tests, lucide-react for icons.

**Testing model:** Jest is configured for `**/__tests__/**/*.test.ts` in a `node` environment — pure-logic only. Component behaviour is verified manually via the dev server in each task that ships a component. Setting up React Testing Library is out of scope.

**Commit policy:** One commit per task. Each phase is a safe stopping point where the app still builds and runs.

---

## Phase 0 — Foundations (lib modules + unit tests)

Five pure-logic modules with unit tests. No UI changes in this phase. At the end, the app builds and runs unchanged; new code is imported nowhere yet.

### Task 0.1: `setup-icon-registry`

**Files:**
- Create: `apps/web/lib/setup-icon-registry.ts`
- Test: `apps/web/lib/__tests__/setup-icon-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/__tests__/setup-icon-registry.test.ts
import { getIcon, getIconKey, iconKeys } from '@/lib/setup-icon-registry';
import { Users, Shield } from 'lucide-react';

describe('setup-icon-registry', () => {
  it('returns the correct icon component for a known key', () => {
    expect(getIcon('users')).toBe(Users);
    expect(getIcon('shield')).toBe(Shield);
  });

  it('returns a fallback icon for an unknown key', () => {
    const fallback = getIcon('not-a-real-key');
    expect(typeof fallback).toBe('object');
  });

  it('round-trips an icon component to a key and back', () => {
    const key = getIconKey(Users);
    expect(key).toBe('users');
    expect(getIcon(key!)).toBe(Users);
  });

  it('exposes the list of registered keys', () => {
    expect(iconKeys()).toContain('users');
    expect(iconKeys()).toContain('shield');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx jest setup-icon-registry`
Expected: FAIL — "Cannot find module '@/lib/setup-icon-registry'".

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/lib/setup-icon-registry.ts
import {
  Users,
  Shield,
  Building2,
  FileText,
  Trash2,
  Database,
  Briefcase,
  Home,
  Lock,
  ShieldAlert,
  Bell,
  WifiOff,
  Plug,
  Puzzle,
  Zap,
  AlertTriangle,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

const REGISTRY: Record<string, LucideIcon> = {
  users: Users,
  shield: Shield,
  building: Building2,
  'file-text': FileText,
  trash: Trash2,
  database: Database,
  briefcase: Briefcase,
  home: Home,
  lock: Lock,
  'shield-alert': ShieldAlert,
  bell: Bell,
  'wifi-off': WifiOff,
  plug: Plug,
  puzzle: Puzzle,
  zap: Zap,
  'alert-triangle': AlertTriangle,
  settings: Settings2,
};

const FALLBACK: LucideIcon = Settings2;

export function getIcon(key: string): LucideIcon {
  return REGISTRY[key] ?? FALLBACK;
}

export function getIconKey(icon: LucideIcon): string | null {
  for (const [key, value] of Object.entries(REGISTRY)) {
    if (value === icon) return key;
  }
  return null;
}

export function iconKeys(): string[] {
  return Object.keys(REGISTRY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx jest setup-icon-registry`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/setup-icon-registry.ts apps/web/lib/__tests__/setup-icon-registry.test.ts
git commit -m "feat(setup): add icon registry for persisted Setup history items"
```

---

### Task 0.2: `setup-return-to`

**Files:**
- Create: `apps/web/lib/setup-return-to.ts`
- Test: `apps/web/lib/__tests__/setup-return-to.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/__tests__/setup-return-to.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx jest setup-return-to`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/lib/setup-return-to.ts
const KEY = 'tischler-setup-came-from';

export function isSetupPath(path: string): boolean {
  return path === '/settings' || path.startsWith('/settings/') ||
         path === '/object-manager' || path.startsWith('/object-manager/');
}

export function rememberCameFrom(path: string): void {
  if (typeof sessionStorage === 'undefined') return;
  if (isSetupPath(path)) return;
  sessionStorage.setItem(KEY, path);
}

export function readCameFrom(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(KEY);
}

export function clearCameFrom(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(KEY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx jest setup-return-to`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/setup-return-to.ts apps/web/lib/__tests__/setup-return-to.test.ts
git commit -m "feat(setup): add came-from tracking for Exit Setup"
```

---

### Task 0.3: `setup-history` (recent + pinned)

**Files:**
- Create: `apps/web/lib/setup-history.ts`
- Test: `apps/web/lib/__tests__/setup-history.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/__tests__/setup-history.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx jest setup-history`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/lib/setup-history.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx jest setup-history`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/setup-history.ts apps/web/lib/__tests__/setup-history.test.ts
git commit -m "feat(setup): add localStorage-backed recent/pinned history"
```

---

### Task 0.4: `setup-search-index`

**Files:**
- Create: `apps/web/lib/setup-search-index.ts`
- Test: `apps/web/lib/__tests__/setup-search-index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/__tests__/setup-search-index.test.ts
import { buildSidebarItems, buildObjectItems, buildObjectSectionItems, searchIndex, type SearchItem } from '@/lib/setup-search-index';
import type { Schema } from '@/lib/schema';

const schema: Schema = {
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
    // Each object gets one entry per section in OBJECT_SECTIONS
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx jest setup-search-index`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/web/lib/setup-search-index.ts
import type { Schema } from '@/lib/schema';

export type SearchGroup = 'Pages' | 'Objects' | 'Users' | 'Profiles';

export interface SearchItem {
  group: SearchGroup;
  primary: string;
  secondary: string;
  href: string;
  iconKey: string;
}

const SIDEBAR_STATIC: Array<{ title: string; href: string; iconKey: string }> = [
  { title: 'Object Manager', href: '/object-manager', iconKey: 'briefcase' },
  { title: 'Company Settings', href: '/settings/company', iconKey: 'home' },
  { title: 'Departments', href: '/settings/departments', iconKey: 'building' },
  { title: 'Security', href: '/settings/security', iconKey: 'lock' },
  { title: 'Users', href: '/settings/users', iconKey: 'users' },
  { title: 'Profiles', href: '/settings/profiles', iconKey: 'shield' },
  { title: 'Backups', href: '/settings/backups', iconKey: 'database' },
  { title: 'Recycle Bin', href: '/settings/recycle-bin', iconKey: 'trash' },
  { title: 'Automations', href: '/settings/automations', iconKey: 'zap' },
  { title: 'Notifications', href: '/settings/notifications', iconKey: 'bell' },
  { title: 'Widgets', href: '/settings/widgets', iconKey: 'puzzle' },
  { title: 'Connected Apps', href: '/settings/integrations', iconKey: 'plug' },
  { title: 'Audit Log', href: '/settings/audit-log', iconKey: 'file-text' },
  { title: 'Error Log', href: '/settings/error-log', iconKey: 'alert-triangle' },
];

const OBJECT_SECTIONS: Array<{ id: string; label: string }> = [
  { id: 'fields', label: 'Fields & Relationships' },
  { id: 'record-types', label: 'Record Types' },
  { id: 'page-editor', label: 'Page Editor' },
  { id: 'search-settings', label: 'Search Settings' },
  { id: 'workflow-rules', label: 'Workflow Rules' },
  { id: 'paths', label: 'Paths' },
  { id: 'permissions', label: 'Permissions' },
  { id: 'validation-rules', label: 'Validation Rules' },
];

export function buildSidebarItems(): SearchItem[] {
  return SIDEBAR_STATIC.map(item => ({
    group: 'Pages' as const,
    primary: item.title,
    secondary: '',
    href: item.href,
    iconKey: item.iconKey,
  }));
}

export function buildObjectItems(schema: Schema | null): SearchItem[] {
  if (!schema) return [];
  return schema.objects.map(obj => ({
    group: 'Objects' as const,
    primary: obj.label || obj.apiName,
    secondary: 'Object Manager',
    href: `/object-manager/${obj.apiName}`,
    iconKey: 'database',
  }));
}

export function buildObjectSectionItems(schema: Schema | null): SearchItem[] {
  if (!schema) return [];
  const items: SearchItem[] = [];
  for (const obj of schema.objects) {
    for (const section of OBJECT_SECTIONS) {
      items.push({
        group: 'Objects',
        primary: section.label,
        secondary: `Object Manager › ${obj.label || obj.apiName}`,
        href: `/object-manager/${obj.apiName}?section=${section.id}`,
        iconKey: 'database',
      });
    }
  }
  return items;
}

export function buildUserItems(users: Array<{ id: string; name: string | null; email: string }>): SearchItem[] {
  return users.map(u => ({
    group: 'Users' as const,
    primary: u.name || u.email,
    secondary: u.name ? u.email : '',
    href: `/settings/users/${u.id}`,
    iconKey: 'users',
  }));
}

export function buildProfileItems(profiles: Array<{ id: string; name: string; label?: string }>): SearchItem[] {
  return profiles.map(p => ({
    group: 'Profiles' as const,
    primary: p.label || p.name,
    secondary: p.name,
    href: `/settings/profiles/${p.id}`,
    iconKey: 'shield',
  }));
}

export function searchIndex(query: string, items: SearchItem[]): SearchItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return items.filter(item =>
    item.primary.toLowerCase().includes(q) ||
    item.secondary.toLowerCase().includes(q)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx jest setup-search-index`
Expected: PASS — all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/setup-search-index.ts apps/web/lib/__tests__/setup-search-index.test.ts
git commit -m "feat(setup): add search index builder for Setup typeahead"
```

---

### Task 0.5: `use-setup-history-tracking` hook

**Files:**
- Create: `apps/web/lib/use-setup-history-tracking.ts`

This is a thin React hook that composes the lib modules. No direct unit test (hook + React runtime); behaviour is exercised by Phase 2 manual tests.

- [ ] **Step 1: Create the hook**

```ts
// apps/web/lib/use-setup-history-tracking.ts
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackVisit } from '@/lib/setup-history';
import { rememberCameFrom, isSetupPath } from '@/lib/setup-return-to';

interface RouteMeta {
  title: string;
  iconKey: string;
}

const ROUTE_META: Record<string, RouteMeta> = {
  '/settings': { title: 'Settings', iconKey: 'settings' },
  '/settings/users': { title: 'Users', iconKey: 'users' },
  '/settings/profiles': { title: 'Profiles', iconKey: 'shield' },
  '/settings/departments': { title: 'Departments', iconKey: 'building' },
  '/settings/company': { title: 'Company Settings', iconKey: 'home' },
  '/settings/security': { title: 'Security', iconKey: 'lock' },
  '/settings/audit-log': { title: 'Audit Log', iconKey: 'file-text' },
  '/settings/error-log': { title: 'Error Log', iconKey: 'alert-triangle' },
  '/settings/recycle-bin': { title: 'Recycle Bin', iconKey: 'trash' },
  '/settings/backups': { title: 'Backups', iconKey: 'database' },
  '/settings/automations': { title: 'Automations', iconKey: 'zap' },
  '/settings/notifications': { title: 'Notifications', iconKey: 'bell' },
  '/settings/widgets': { title: 'Widgets', iconKey: 'puzzle' },
  '/settings/integrations': { title: 'Connected Apps', iconKey: 'plug' },
  '/object-manager': { title: 'Object Manager', iconKey: 'briefcase' },
};

function resolveMeta(pathname: string): RouteMeta | null {
  if (ROUTE_META[pathname]) return ROUTE_META[pathname]!;
  if (pathname.startsWith('/object-manager/')) {
    const slug = pathname.split('/')[2]!;
    return { title: `Object Manager › ${slug}`, iconKey: 'briefcase' };
  }
  return null;
}

const TRACKABLE_PREFIX = /^\/(settings|object-manager)(\/|$)/;
const SKIP_TRACKING_PREFIXES = ['/settings/users/', '/settings/profiles/'];

export function useSetupHistoryTracking(): void {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;

    if (!isSetupPath(pathname)) {
      rememberCameFrom(pathname);
      return;
    }

    if (!TRACKABLE_PREFIX.test(pathname)) return;
    if (SKIP_TRACKING_PREFIXES.some(p => pathname.startsWith(p) && pathname !== p.slice(0, -1))) return;

    const meta = resolveMeta(pathname);
    if (!meta) return;
    trackVisit({ href: pathname, title: meta.title, iconKey: meta.iconKey });
  }, [pathname]);
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS — no errors. (The hook is not yet imported anywhere; if typecheck reveals a missing import adjust and re-run.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/use-setup-history-tracking.ts
git commit -m "feat(setup): add useSetupHistoryTracking hook"
```

---

## Phase 1 — Shared components

Four reusable components. Each is written, imported into a tiny test harness (or its consumer), and verified by dev-server screenshot/click.

### Task 1.1: `ExitSetupPill`

**Files:**
- Create: `apps/web/components/settings/exit-setup-pill.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/settings/exit-setup-pill.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readCameFrom, clearCameFrom } from '@/lib/setup-return-to';

interface ExitSetupPillProps {
  variant?: 'light' | 'dark';
  className?: string;
}

export function ExitSetupPill({ variant = 'light', className }: ExitSetupPillProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleExit = () => {
    const returnTo = searchParams?.get('returnTo');
    const cameFrom = readCameFrom();
    const target = returnTo || cameFrom || '/';
    clearCameFrom();
    router.push(target);
  };

  const styles = variant === 'dark'
    ? 'bg-white/10 hover:bg-white/20 text-white border-white/20'
    : 'bg-gray-100 hover:bg-gray-200 text-brand-dark border-gray-200';

  return (
    <button
      onClick={handleExit}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors',
        styles,
        className
      )}
      title="Exit Setup"
    >
      <LogOut className="w-3.5 h-3.5" />
      <span>Exit Setup</span>
    </button>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/settings/exit-setup-pill.tsx
git commit -m "feat(setup): add ExitSetupPill component"
```

---

### Task 1.2: `SetupBreadcrumb` (rewrite of `settings-breadcrumb.tsx`)

**Files:**
- Modify: `apps/web/components/settings/settings-breadcrumb.tsx` (full rewrite, same file)
- Modify: `apps/web/components/settings/index.ts` (export path unchanged, but verify)

- [ ] **Step 1: Rewrite breadcrumb to be clickable end-to-end**

Replace the entire contents of `apps/web/components/settings/settings-breadcrumb.tsx` with:

```tsx
// apps/web/components/settings/settings-breadcrumb.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

const SEGMENT_LABELS: Record<string, string> = {
  settings: 'Setup',
  'object-manager': 'Object Manager',
  users: 'Users',
  profiles: 'Profiles',
  departments: 'Departments',
  'audit-log': 'Audit Log',
  'error-log': 'Error Log',
  'recycle-bin': 'Recycle Bin',
  security: 'Security',
  backups: 'Backups',
  company: 'Company Settings',
  integrations: 'Connected Apps',
  widgets: 'Widgets',
  privacy: 'Privacy Center',
  notifications: 'Notifications',
  offline: 'Offline',
  automations: 'Automations',
};

interface Crumb {
  label: string;
  href?: string;
}

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];

  const crumbs: Crumb[] = [{ label: 'Tischler CRM', href: '/' }];
  const root = segments[0];
  if (root === 'settings') {
    crumbs.push({ label: 'Setup', href: '/settings' });
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i]!;
      const label = SEGMENT_LABELS[seg] || decodeURIComponent(seg);
      const isLast = i === segments.length - 1;
      crumbs.push(isLast ? { label } : { label, href: '/' + segments.slice(0, i + 1).join('/') });
    }
  } else if (root === 'object-manager') {
    crumbs.push({ label: 'Setup', href: '/settings' });
    crumbs.push({ label: 'Object Manager', href: '/object-manager' });
    if (segments.length >= 2) {
      const objectApi = decodeURIComponent(segments[1]!);
      crumbs.push({ label: objectApi });
    }
  }

  return crumbs;
}

export function SettingsBreadcrumb() {
  const pathname = usePathname();
  if (!pathname) return null;
  const crumbs = buildCrumbs(pathname);
  if (crumbs.length <= 1) return null;

  return (
    <div className="px-8 py-3 text-[12px] text-brand-gray bg-white border-b border-gray-200">
      <div className="flex items-center gap-1.5">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            {c.href ? (
              <Link href={c.href} className="hover:text-brand-navy transition-colors">
                {c.label}
              </Link>
            ) : (
              <span className="text-brand-dark font-medium">{c.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify export wiring**

Run: `cd apps/web && npm run typecheck`
Expected: PASS. `SettingsBreadcrumb` is still the exported name so no callers break.

- [ ] **Step 3: Manual verification**

Start the dev server: `cd apps/web && npm run dev`
Visit `/settings/users`. Expected: breadcrumb reads `Tischler CRM › Setup › Users`. Click "Tischler CRM" → lands at `/`. Back on `/settings/users`, click "Setup" → lands at `/settings`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/settings/settings-breadcrumb.tsx
git commit -m "feat(setup): clickable breadcrumb rooted at Tischler CRM"
```

---

### Task 1.3: `ObjectManagerTopBar`

**Files:**
- Create: `apps/web/components/object-manager/object-manager-top-bar.tsx`

- [ ] **Step 1: Create the directory and component**

```tsx
// apps/web/components/object-manager/object-manager-top-bar.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import { ExitSetupPill } from '@/components/settings/exit-setup-pill';

interface Crumb {
  label: string;
  href?: string;
}

interface ObjectManagerTopBarProps {
  crumbs: Crumb[];
  children?: React.ReactNode;
}

export function ObjectManagerTopBar({ crumbs, children }: ObjectManagerTopBarProps) {
  return (
    <div className="bg-brand-navy shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-[48px]">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0" title="Home">
              <div className="w-8 h-8 rounded flex items-center justify-center overflow-hidden">
                <Image
                  src="/tces-logo.png"
                  alt="Tischler"
                  width={32}
                  height={32}
                  priority
                  className="object-contain"
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
              <span className="text-white/80 text-sm font-semibold group-hover:text-white transition-colors hidden sm:inline">
                Tischler CRM
              </span>
            </Link>
            <span className="text-white/30">|</span>
            <nav className="flex items-center gap-1.5 text-sm min-w-0 overflow-hidden">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />}
                  {c.href ? (
                    <Link
                      href={c.href}
                      className="text-white/70 hover:text-white transition-colors whitespace-nowrap"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className="text-white font-semibold whitespace-nowrap truncate">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {children}
            <ExitSetupPill variant="dark" />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/object-manager/object-manager-top-bar.tsx
git commit -m "feat(object-manager): add shared top bar with crumbs + Exit Setup"
```

---

## Phase 2 — Navigation wiring

Wire the new components into Object Manager pages and the Settings sidebar. After this phase the "1-click escape" goal is met.

### Task 2.1: Wire `ObjectManagerTopBar` into the Object Manager index

**Files:**
- Modify: `apps/web/app/object-manager/page.tsx` (replace inline header around lines 256–320)

- [ ] **Step 1: Replace the inline header**

Open `apps/web/app/object-manager/page.tsx`. Locate the block that starts with `{/* Header */}` and the navy `<div className="bg-brand-navy shadow-md">` (around line 257). Replace that entire block (up to and including its closing `</div>` at ~line 320) with:

```tsx
      {/* Header */}
      <ObjectManagerTopBar crumbs={[{ label: 'Object Manager' }]}>
        <Button variant="outline" onClick={handleExportAll} className="!text-white !border-white/20 hover:!bg-white/10">
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogTrigger asChild>
            <Button variant="outline" className="!text-white !border-white/20 hover:!bg-white/10">
              <Upload className="h-4 w-4 mr-2" />
              Import Schema
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Import Schema</DialogTitle>
              <DialogDescription>
                Paste your JSON schema data below. This will be merged with your existing objects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                value={importData}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setImportData(e.target.value)}
                placeholder="Paste JSON schema data here..."
                rows={12}
                className="font-mono text-sm"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImportSchema} disabled={!importData.trim()}>
                  Import
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </ObjectManagerTopBar>
```

- [ ] **Step 2: Add the import**

Near the other component imports in the file, add:

```tsx
import { ObjectManagerTopBar } from '@/components/object-manager/object-manager-top-bar';
```

Remove the now-unused `Image` and `Link` imports if they are no longer referenced in this file (verify with a save-and-typecheck).

- [ ] **Step 3: Wire history tracking**

At the top of `ObjectManagerPage`, after the existing `useEffect` that calls `loadSchema()`, add:

```tsx
import { useSetupHistoryTracking } from '@/lib/use-setup-history-tracking';
// ... and inside the component, before the first return:
useSetupHistoryTracking();
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Start the dev server. Visit `/object-manager`. Expected:
- Top bar shows Tischler logo + "Tischler CRM" | "Object Manager" (bold, non-link) + "Exit Setup" pill on the right.
- Export All + Import Schema buttons remain functional.
- Clicking Tischler logo → `/`.
- Clicking Exit Setup → `/` (no came-from stored yet) or last CRM page.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/object-manager/page.tsx
git commit -m "feat(object-manager): use shared ObjectManagerTopBar on index"
```

---

### Task 2.2: Wire `ObjectManagerTopBar` into Object Manager detail pages

**Files:**
- Modify: `apps/web/app/object-manager/[objectApi]/page.tsx` (replace the sidebar's navy header at lines 222–236)

- [ ] **Step 1: Replace the sidebar's navy top bar**

In `apps/web/app/object-manager/[objectApi]/page.tsx`, the current detail-page layout has the sidebar with a navy header at the top containing only "Back to Object Manager". We will instead mount `ObjectManagerTopBar` at the top of the page (above the flex row containing sidebar + main content) so the crumb bar spans the full width — the sidebar itself gets a white, smaller header.

Find the outer `<div className="min-h-screen bg-gray-50 flex">` at ~line 213. Change it to a flex column, mount the top bar above, and convert the sidebar's navy header to a white one. Concretely:

```tsx
  return (
    <>
      <ObjectManagerTopBar
        crumbs={[
          { label: 'Object Manager', href: '/object-manager' },
          { label: object.label },
        ]}
      />
      <div className="min-h-[calc(100vh-48px)] bg-gray-50 flex">
        <aside
          className={cn(
            'fixed left-0 top-[48px] h-[calc(100vh-48px)] bg-white border-r border-gray-200 transition-all duration-300 z-40',
            sidebarCollapsed ? 'w-16' : 'w-72'
          )}
        >
          {/* White sidebar header — collapse only */}
          <div className="h-[44px] bg-white border-b border-gray-200 flex items-center justify-end px-3 flex-shrink-0">
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-gray-100 rounded transition-colors"
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {/* ... rest of existing sidebar (Object Info + Navigation) unchanged ... */}
```

And wrap the main content section so it accounts for the new 48px top-bar offset. Locate any `top-0` or `h-full` on the sidebar and update to `top-[48px]` / `h-[calc(100vh-48px)]` as shown. Close the outer fragment at the end (replace the final `</div>` that closed the outer `<div className="min-h-screen bg-gray-50 flex">` with `</div></>`).

- [ ] **Step 2: Add the imports**

At the top of the file:

```tsx
import { ObjectManagerTopBar } from '@/components/object-manager/object-manager-top-bar';
import { useSetupHistoryTracking } from '@/lib/use-setup-history-tracking';
```

And inside `ObjectDetailPage`, after the other hooks:

```tsx
useSetupHistoryTracking();
```

- [ ] **Step 3: Remove the obsolete "Back to Object Manager" link**

The old `<Link href={returnTo || '/object-manager'}>` block inside the sidebar header is no longer needed — the top bar now provides the crumb back. Remove it (it was already dropped in step 1 when you replaced the sidebar header).

- [ ] **Step 4: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Manual verification**

Visit `/object-manager/Account`. Expected:
- Full-width navy top bar: Tischler logo + "Tischler CRM" | "Object Manager" (link) › "Account" (bold) + Exit Setup pill.
- Below it: the internal sidebar (sections Data Model / Layouts & UI / etc.) with a clean white header that only holds the collapse button.
- Clicking "Object Manager" in the breadcrumb → `/object-manager`. Clicking Tischler logo → `/`. Exit Setup → last CRM page.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/object-manager/[objectApi]/page.tsx
git commit -m "feat(object-manager): hoist top bar above detail-page sidebar"
```

---

### Task 2.3: Wire history tracking + Exit Setup pill into Settings layout

**Files:**
- Modify: `apps/web/app/settings/layout.tsx`
- Modify: `apps/web/components/settings/settings-sidebar.tsx` (add Exit Setup pill at bottom)

- [ ] **Step 1: Mount tracking in the settings layout**

Open `apps/web/app/settings/layout.tsx`. Add the import and hook call inside `SettingsLayout`:

```tsx
import { useSetupHistoryTracking } from '@/lib/use-setup-history-tracking';

// inside SettingsLayout, directly after the useState for collapsed:
useSetupHistoryTracking();
```

- [ ] **Step 2: Add the Exit Setup pill to the sidebar**

Open `apps/web/components/settings/settings-sidebar.tsx`. At the top, add:

```tsx
import { ExitSetupPill } from '@/components/settings/exit-setup-pill';
```

Inside the expanded (`!collapsed`) aside, directly before the closing `</aside>`, insert:

```tsx
      <div className="px-3 py-3 border-t border-gray-200 bg-white">
        <ExitSetupPill className="w-full justify-center" />
      </div>
```

And adjust the `<nav>` above it to no longer consume 100% of remaining space conflictingly (if padding is off, change `pb-5` on the nav to `pb-2`).

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Manual verification**

From `/properties`, click the Cog → Settings. Expected: on `/settings/users`, Exit Setup pill is visible at the bottom of the sidebar. Click it → lands back on `/properties`. Reload `/settings/users` with no came-from → Exit Setup → lands on `/`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/settings/layout.tsx apps/web/components/settings/settings-sidebar.tsx
git commit -m "feat(setup): track Setup visits + add Exit Setup pill to sidebar"
```

---

## Phase 3 — Sidebar IA (new groupings)

### Task 3.1: Regroup sidebar items

**Files:**
- Modify: `apps/web/components/settings/settings-sidebar.tsx` (replace `NAV_GROUPS`)

- [ ] **Step 1: Replace `NAV_GROUPS`**

In `apps/web/components/settings/settings-sidebar.tsx`, find the `NAV_GROUPS` constant (currently 3 groups) and replace it with:

```tsx
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Company',
    items: [
      { name: 'Company Settings', href: '/settings/company', icon: Home },
      { name: 'Departments', href: '/settings/departments', icon: Building2 },
      { name: 'Security', href: '/settings/security', icon: Lock },
      { name: 'Privacy Center', href: '/settings/privacy', icon: ShieldAlert, disabled: true },
    ],
  },
  {
    title: 'Users & Access',
    items: [
      { name: 'Users', href: '/settings/users', icon: Users },
      { name: 'Profiles', href: '/settings/profiles', icon: Shield },
    ],
  },
  {
    title: 'Data Model',
    items: [
      { name: 'Backups', href: '/settings/backups', icon: Database },
      { name: 'Recycle Bin', href: '/settings/recycle-bin', icon: Trash2 },
      { name: 'Data', href: '/settings/data', icon: Database, disabled: true },
    ],
  },
  {
    title: 'Automation',
    items: [
      { name: 'Automations', href: '/settings/automations', icon: Zap },
      { name: 'Notifications', href: '/settings/notifications', icon: Bell },
      { name: 'Widgets', href: '/settings/widgets', icon: Puzzle },
    ],
  },
  {
    title: 'Connections',
    items: [
      { name: 'Connected Apps', href: '/settings/integrations', icon: Plug },
      { name: 'Offline', href: '/settings/offline', icon: WifiOff, disabled: true },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { name: 'Audit Log', href: '/settings/audit-log', icon: FileText },
      { name: 'Error Log', href: '/settings/error-log', icon: AlertTriangle },
    ],
  },
];
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS. (All referenced icons are already imported in the file.)

- [ ] **Step 3: Manual verification**

Visit `/settings/users`. Sidebar should show:
- Object Manager (pinned at top)
- Search input
- Company / Users & Access (Users active) / Data Model / Automation / Connections / Monitoring
- Exit Setup pill at bottom
Active state still uses purple bg + red inset bar for Users.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/settings/settings-sidebar.tsx
git commit -m "feat(settings): reorganize sidebar into 7 semantic groups"
```

---

## Phase 4 — Settings landing page

### Task 4.1: Extract `ObjectManagerHeroCard`

**Files:**
- Create: `apps/web/components/settings/object-manager-hero-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/settings/object-manager-hero-card.tsx
'use client';

import Link from 'next/link';
import { Briefcase, ArrowRight } from 'lucide-react';

export function ObjectManagerHeroCard() {
  return (
    <Link
      href="/object-manager"
      className="group block bg-white rounded-2xl border border-brand-navy/15 hover:border-brand-navy/30 p-6 transition-all duration-200 hover:shadow-md relative overflow-hidden mb-8"
      style={{ backgroundImage: 'linear-gradient(135deg, rgba(21,31,109,0.05), rgba(21,31,109,0.01))' }}
    >
      <div className="flex items-center gap-5">
        <div className="w-14 h-14 rounded-xl bg-brand-navy/10 flex items-center justify-center flex-shrink-0">
          <Briefcase className="w-7 h-7 text-brand-navy" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-brand-dark">Object Manager</h2>
          <p className="text-sm text-brand-gray mt-0.5">
            Create and configure objects, fields, layouts, record types, and automations
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy group-hover:translate-x-1 transition-transform">
          <span>Open</span>
          <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/settings/object-manager-hero-card.tsx
git commit -m "feat(settings): add Object Manager hero card"
```

---

### Task 4.2: `SetupRecentStrip`

**Files:**
- Create: `apps/web/components/settings/setup-recent-strip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/settings/setup-recent-strip.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock } from 'lucide-react';
import { getRecent, type SetupHistoryEntry } from '@/lib/setup-history';
import { getIcon } from '@/lib/setup-icon-registry';

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function SetupRecentStrip() {
  const [items, setItems] = useState<SetupHistoryEntry[]>([]);
  useEffect(() => {
    setItems(getRecent(4));
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-brand-gray" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">Recently Visited</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = getIcon(item.iconKey);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 bg-white rounded-xl border border-gray-200 hover:border-brand-navy/20 hover:shadow-sm p-3 transition-all duration-150"
            >
              <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-[18px] h-[18px] text-brand-navy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-brand-dark truncate">{item.title}</div>
                <div className="text-[11px] text-brand-gray">{formatRelative(item.visitedAt ?? Date.now())}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/settings/setup-recent-strip.tsx
git commit -m "feat(settings): add Recently Visited strip"
```

---

### Task 4.3: `SetupPinnedStrip`

**Files:**
- Create: `apps/web/components/settings/setup-pinned-strip.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/settings/setup-pinned-strip.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Pin, PinOff } from 'lucide-react';
import { getPinned, togglePin, getRecent, type SetupHistoryEntry } from '@/lib/setup-history';
import { getIcon } from '@/lib/setup-icon-registry';

export function SetupPinnedStrip() {
  const [pinned, setPinned] = useState<SetupHistoryEntry[]>([]);
  const [hasRecent, setHasRecent] = useState(false);

  useEffect(() => {
    setPinned(getPinned());
    setHasRecent(getRecent(1).length > 0);
  }, []);

  const handleUnpin = (e: React.MouseEvent, entry: SetupHistoryEntry) => {
    e.preventDefault();
    togglePin(entry);
    setPinned(getPinned());
  };

  // Hide entirely on very first visit (no recent AND no pinned)
  if (pinned.length === 0 && !hasRecent) return null;

  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <Pin className="w-4 h-4 text-brand-gray" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray">Pinned</h3>
      </div>

      {pinned.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-3 text-xs text-brand-gray">
          Pin any setting to keep it here.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {pinned.map((item) => {
            const Icon = getIcon(item.iconKey);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group relative flex items-center gap-3 bg-white rounded-xl border border-gray-200 hover:border-brand-navy/20 hover:shadow-sm p-3 transition-all duration-150"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-[18px] h-[18px] text-brand-navy" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-brand-dark truncate">{item.title}</div>
                </div>
                <button
                  onClick={(e) => handleUnpin(e, item)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                  title="Unpin"
                >
                  <PinOff className="w-3.5 h-3.5 text-brand-gray" />
                </button>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/settings/setup-pinned-strip.tsx
git commit -m "feat(settings): add Pinned strip"
```

---

### Task 4.4: Recompose `/settings` landing page with hero + strips + grouped cards

**Files:**
- Modify: `apps/web/app/settings/page.tsx`

- [ ] **Step 1: Rewrite the landing page**

Replace `apps/web/app/settings/page.tsx` with:

```tsx
// apps/web/app/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, Shield, Building2, FileText, Trash2, Lock, Database,
  Settings2, ArrowRight, Home, Plug, Zap, Bell, Puzzle, AlertTriangle,
  Pin, PinOff, type LucideIcon,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { ObjectManagerHeroCard } from '@/components/settings/object-manager-hero-card';
import { SetupRecentStrip } from '@/components/settings/setup-recent-strip';
import { SetupPinnedStrip } from '@/components/settings/setup-pinned-strip';
import { isPinned, togglePin } from '@/lib/setup-history';
import { getIconKey } from '@/lib/setup-icon-registry';

interface Card {
  title: string;
  icon: LucideIcon;
  href: string;
  count?: number;
  description: string;
  color: string;
  group: string;
}

export default function SettingsPage() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [pinVersion, setPinVersion] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const [usersData, profilesData, deptsData, triggersData, controllersData] = await Promise.all([
          apiClient.get<any[]>('/admin/users').catch(() => []),
          apiClient.get<any[]>('/profiles').catch(() => []),
          apiClient.get<any[]>('/departments').catch(() => []),
          apiClient.get<any[]>('/automations/triggers').catch(() => []),
          apiClient.get<any[]>('/automations/controllers').catch(() => []),
        ]);
        setCounts({
          users: usersData.length,
          profiles: profilesData.length,
          departments: deptsData.length,
          automations: triggersData.length + controllersData.length,
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const cards: Card[] = [
    { title: 'Company Settings', icon: Home, href: '/settings/company', description: 'Organization info, address, locale', color: '#0d9488', group: 'Company' },
    { title: 'Departments', icon: Building2, href: '/settings/departments', count: counts.departments, description: 'Team structure', color: '#2563eb', group: 'Company' },
    { title: 'Security', icon: Lock, href: '/settings/security', description: 'Login history and access monitoring', color: '#059669', group: 'Company' },
    { title: 'Users', icon: Users, href: '/settings/users', count: counts.users, description: 'Manage user accounts', color: '#151f6d', group: 'Users & Access' },
    { title: 'Profiles', icon: Shield, href: '/settings/profiles', count: counts.profiles, description: 'Role-based permissions', color: '#1e2a7a', group: 'Users & Access' },
    { title: 'Backups', icon: Database, href: '/settings/backups', description: 'Database snapshots and restore', color: '#d97706', group: 'Data Model' },
    { title: 'Recycle Bin', icon: Trash2, href: '/settings/recycle-bin', description: 'Restore deleted records', color: '#da291c', group: 'Data Model' },
    { title: 'Automations', icon: Zap, href: '/settings/automations', count: counts.automations, description: 'Triggers and controllers', color: '#f59e0b', group: 'Automation' },
    { title: 'Notifications', icon: Bell, href: '/settings/notifications', description: 'Org-wide notification preferences', color: '#6366f1', group: 'Automation' },
    { title: 'Widgets', icon: Puzzle, href: '/settings/widgets', description: 'Reusable page widgets', color: '#7c3aed', group: 'Automation' },
    { title: 'Connected Apps', icon: Plug, href: '/settings/integrations', description: 'Google Maps, Dropbox, Outlook, etc.', color: '#4285F4', group: 'Connections' },
    { title: 'Audit Log', icon: FileText, href: '/settings/audit-log', description: 'All system activity', color: '#7c3aed', group: 'Monitoring' },
    { title: 'Error Log', icon: AlertTriangle, href: '/settings/error-log', description: 'Client errors captured across the app', color: '#dc2626', group: 'Monitoring' },
  ];

  const groupOrder = ['Company', 'Users & Access', 'Data Model', 'Automation', 'Connections', 'Monitoring'];
  const cardsByGroup: Record<string, Card[]> = {};
  for (const g of groupOrder) cardsByGroup[g] = [];
  for (const c of cards) cardsByGroup[c.group]!.push(c);

  const handleTogglePin = (e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    togglePin({ href: card.href, title: card.title, iconKey: getIconKey(card.icon) || 'settings' });
    setPinVersion(v => v + 1);
  };

  return (
    <div className="p-8">
      {/* Overview Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f0f1f9] flex items-center justify-center">
            <Settings2 className="w-6 h-6 text-brand-navy" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-brand-dark">Settings Overview</h1>
            <p className="text-sm text-brand-gray mt-0.5">Configure and manage your CRM environment</p>
          </div>
        </div>
      </div>

      <ObjectManagerHeroCard />
      <SetupRecentStrip key={`recent-${pinVersion}`} />
      <SetupPinnedStrip key={`pinned-${pinVersion}`} />

      {groupOrder.map((groupTitle) => {
        const items = cardsByGroup[groupTitle]!;
        if (items.length === 0) return null;
        return (
          <section key={groupTitle} className="mb-8">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-gray mb-3">{groupTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {items.map((card) => {
                const pinned = isPinned(card.href);
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="group relative bg-white rounded-xl border border-gray-200 p-6 hover:border-brand-navy/20 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${card.color}12` }}
                      >
                        <card.icon className="w-5 h-5" style={{ color: card.color }} />
                      </div>
                      <div className="flex items-center gap-2">
                        {card.count !== undefined && !loading && (
                          <span className="text-2xl font-bold text-brand-dark">{card.count}</span>
                        )}
                        {loading && card.count === undefined && (
                          <div className="w-8 h-7 bg-gray-100 rounded animate-pulse" />
                        )}
                        <button
                          onClick={(e) => handleTogglePin(e, card)}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-100 transition-all"
                          title={pinned ? 'Unpin' : 'Pin'}
                        >
                          {pinned
                            ? <PinOff className="w-3.5 h-3.5 text-brand-gray" />
                            : <Pin className="w-3.5 h-3.5 text-brand-gray" />}
                        </button>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-brand-dark group-hover:text-brand-navy transition-colors">
                      {card.title}
                    </h3>
                    <p className="text-xs text-brand-gray mt-1">{card.description}</p>
                    <div className="mt-3 flex items-center text-xs font-medium text-brand-navy opacity-0 group-hover:opacity-100 transition-opacity">
                      Open <ArrowRight className="w-3 h-3 ml-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Visit `/settings`. Expected top to bottom:
1. "Settings Overview" header card.
2. Object Manager hero card (full width, subtle navy tint).
3. Recently Visited strip (only if user has visited subpages).
4. Pinned strip (hint row if none pinned and recent present; hidden if first-ever visit).
5. Grouped card grid under Company / Users & Access / Data Model / Automation / Connections / Monitoring.

Pin Users (hover → click pin icon) → card appears in Pinned strip above. Unpin → removed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/settings/page.tsx
git commit -m "feat(settings): hero card + recent/pinned + grouped cards on landing"
```

---

## Phase 5 — Setup search typeahead

### Task 5.1: `SetupSearchTypeahead` component

**Files:**
- Create: `apps/web/components/settings/setup-search-typeahead.tsx`

- [ ] **Step 1: Create the typeahead**

```tsx
// apps/web/components/settings/setup-search-typeahead.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useSchemaStore } from '@/lib/schema-store';
import {
  buildSidebarItems, buildObjectItems, buildObjectSectionItems,
  buildUserItems, buildProfileItems, searchIndex,
  type SearchItem, type SearchGroup,
} from '@/lib/setup-search-index';
import { getIcon } from '@/lib/setup-icon-registry';

const MAX_PER_GROUP = 5;
const GROUP_ORDER: SearchGroup[] = ['Pages', 'Objects', 'Users', 'Profiles'];

export function SetupSearchTypeahead() {
  const router = useRouter();
  const { schema } = useSchemaStore();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; name: string | null; email: string }>>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string; label?: string }>>([]);
  const [remoteLoaded, setRemoteLoaded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focused || remoteLoaded) return;
    (async () => {
      const [u, p] = await Promise.all([
        apiClient.get<any[]>('/admin/users').catch(() => []),
        apiClient.get<any[]>('/profiles').catch(() => []),
      ]);
      setUsers(u.map((x: any) => ({ id: x.id, name: x.name, email: x.email })));
      setProfiles(p.map((x: any) => ({ id: x.id, name: x.name, label: x.label })));
      setRemoteLoaded(true);
    })();
  }, [focused, remoteLoaded]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const allItems: SearchItem[] = useMemo(() => [
    ...buildSidebarItems(),
    ...buildObjectItems(schema),
    ...buildObjectSectionItems(schema),
    ...buildUserItems(users),
    ...buildProfileItems(profiles),
  ], [schema, users, profiles]);

  const results = useMemo(() => searchIndex(query, allItems), [query, allItems]);

  const grouped: Record<SearchGroup, SearchItem[]> = { Pages: [], Objects: [], Users: [], Profiles: [] };
  for (const r of results) grouped[r.group].push(r);
  const visibleGroups = GROUP_ORDER.filter(g => grouped[g].length > 0);
  const flatVisible = visibleGroups.flatMap(g => grouped[g].slice(0, MAX_PER_GROUP));

  useEffect(() => { setActiveIndex(0); }, [query]);

  const open = focused && query.trim().length > 0;

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, flatVisible.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = flatVisible[activeIndex];
      if (target) {
        router.push(target.href);
        setQuery('');
        setFocused(false);
      }
    } else if (e.key === 'Escape') {
      setQuery('');
      setFocused(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input
          type="search"
          placeholder="Search settings, objects, users..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKey}
          autoComplete="off"
          className="w-full bg-gray-100 border border-gray-200 rounded-lg py-2 pl-9 pr-3 text-[13px] text-gray-700 placeholder:text-gray-400 outline-none focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-gray-300 transition-colors"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden max-h-[70vh] overflow-y-auto">
          {visibleGroups.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-brand-gray">No matches for "{query}"</div>
          ) : (
            visibleGroups.map((group) => {
              const items = grouped[group].slice(0, MAX_PER_GROUP);
              return (
                <div key={group} className="py-1">
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-brand-gray bg-gray-50/60">{group}</div>
                  {items.map((item) => {
                    const flatIndex = flatVisible.indexOf(item);
                    const active = flatIndex === activeIndex;
                    const Icon = getIcon(item.iconKey);
                    return (
                      <button
                        key={`${item.group}-${item.href}-${item.primary}`}
                        onMouseEnter={() => setActiveIndex(flatIndex)}
                        onClick={() => { router.push(item.href); setQuery(''); setFocused(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${active ? 'bg-[#ede9f5]' : 'hover:bg-gray-50'}`}
                      >
                        <Icon className="w-[18px] h-[18px] text-brand-navy flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-brand-dark truncate">{item.primary}</div>
                          {item.secondary && (
                            <div className="text-[11px] text-brand-gray truncate">{item.secondary}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/settings/setup-search-typeahead.tsx
git commit -m "feat(setup): add SetupSearchTypeahead with lazy user/profile fetch"
```

---

### Task 5.2: Wire the typeahead into the Settings sidebar

**Files:**
- Modify: `apps/web/components/settings/settings-sidebar.tsx`

- [ ] **Step 1: Replace the inline search block with the typeahead**

In `apps/web/components/settings/settings-sidebar.tsx`, find the `{/* Search */}` block (lines 147–168 of the current file) and replace it with:

```tsx
      {/* Search */}
      <div className="px-3 py-3">
        <SetupSearchTypeahead />
      </div>
```

Add the import at the top:

```tsx
import { SetupSearchTypeahead } from '@/components/settings/setup-search-typeahead';
```

Remove the `searchQuery` state, the `filteredGroups` memoized filter, and all references to them (they are obsoleted by the typeahead dropdown). The sidebar always renders the full group list.

Concretely:
1. Delete: `const [searchQuery, setSearchQuery] = useState('');`
2. Delete the `filteredGroups` declaration.
3. Change the `{filteredGroups.map(...)}` iteration to `{NAV_GROUPS.map(...)}`.
4. Remove the now-unused `useState` import if nothing else uses it (check — other state may still need it).
5. Remove the now-unused `Search` import if nothing else uses it.

- [ ] **Step 2: Typecheck**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Visit `/settings`. Type `valid` in the sidebar search. Expected: dropdown shows "Validation Rules" entries grouped under Objects, one per object. Press ↓↓ then Enter → navigates to `/object-manager/Contact?section=validation-rules` (or whichever object was highlighted).

Type a user's name. Expected: Users group appears with their row; click → `/settings/users/<id>`.

Press Esc. Dropdown closes and query clears. Click outside dropdown while text remains → dropdown closes but query preserved.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/settings/settings-sidebar.tsx
git commit -m "feat(setup): sidebar search is now a typeahead over pages/objects/users/profiles"
```

---

## Phase 6 — Visual polish baseline audit

Per-page pass to standardize chrome. Each task is one subpage; ship one commit per page so bisecting is clean.

**General checklist** (apply per page):
- Use `<SettingsPageHeader icon={X} title="..." subtitle="..." action={...} />` — drop any custom header markup.
- Wrap primary content in `<SettingsContentCard>`.
- One primary button per page (in the header's `action` slot). Other header-level actions become `outline` buttons in a second row or move into toolbars.
- Spacing: use `p-4`, `p-6`, `p-8`, `gap-2/4/6/8` only. Grep for `p-3.5`, `py-5`, `mt-7`, `gap-7`, `gap-5` (convert to 4 or 6).
- Empty state: centered icon (`w-12 h-12`), title `text-lg font-semibold`, description `text-sm text-brand-gray`, optional primary action. Use a shared pattern.
- Loading: spinner with `Database` or `Loader2` icon + `text-brand-gray` label. No raw "Loading...".
- Inputs: include `focus:ring-2 focus:ring-brand-navy/30` where focus ring is inconsistent.

Pages in scope (one commit per): `audit-log`, `error-log`, `automations`, `backups`, `company`, `departments`, `integrations`, `notifications`, `profiles`, `recycle-bin`, `security`, `users`, `widgets`.

### Task 6.1: Audit & fix one page (template)

Repeat this task for each page. The work pattern is the same; the concrete edits depend on what each page is currently doing.

**Files per iteration:**
- Modify: `apps/web/app/settings/<page-slug>/page.tsx`

- [ ] **Step 1: Read the current file**

Run: open `apps/web/app/settings/<slug>/page.tsx`. Note the current header markup, any container divs wrapping the main content, empty-state style, button hierarchy.

- [ ] **Step 2: Swap the header**

If the file renders a custom header (inline icon + h1 + subtitle), replace with:

```tsx
<SettingsPageHeader
  icon={PageIcon}
  title="Page Title"
  subtitle="One-line description"
  action={{ label: 'Primary Action', icon: Plus, onClick: handlePrimary }}
/>
```

Ensure `SettingsPageHeader` is imported from `@/components/settings/settings-page-header` (or the barrel `@/components/settings`).

- [ ] **Step 3: Wrap primary content**

If the main content area is a raw `<div className="bg-white border ...">`, replace with:

```tsx
<SettingsContentCard>
  {/* existing content here, stripped of any now-duplicate outer padding */}
</SettingsContentCard>
```

- [ ] **Step 4: Normalize spacing**

Search the file for: `p-3.5`, `p-5`, `p-7`, `py-3.5`, `py-5`, `gap-5`, `gap-7`, `mt-7`, `mb-7`. Convert each to the nearest value on the 4/6/8 scale that preserves the layout intent.

- [ ] **Step 5: Reduce to one primary button**

If the header has two navy primary buttons, demote the secondary one to `variant="outline"` styling or move it into a row/toolbar beneath the header.

- [ ] **Step 6: Unify empty state**

If the page has an empty state, ensure it matches:

```tsx
<div className="flex flex-col items-center justify-center py-12 px-6">
  <Icon className="w-12 h-12 text-brand-gray/50 mb-3" />
  <h3 className="text-lg font-semibold text-brand-dark mb-1">Empty title</h3>
  <p className="text-sm text-brand-gray mb-4 text-center max-w-md">Description.</p>
  {/* optional primary action */}
</div>
```

- [ ] **Step 7: Unify loading state**

Replace any "Loading..." text with:

```tsx
<div className="flex items-center justify-center py-16">
  <Loader2 className="w-5 h-5 animate-spin text-brand-navy mr-2" />
  <span className="text-sm text-brand-gray">Loading…</span>
</div>
```

(Import `Loader2` from `lucide-react`.)

- [ ] **Step 8: Typecheck + manual verification**

Run: `cd apps/web && npm run typecheck`
Expected: PASS.

Open the page in dev; visually confirm header is correct, content card has rounded border, no unintended padding loss, empty/loading states render.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/settings/<slug>/page.tsx
git commit -m "refactor(settings/<slug>): adopt shared header + content-card pattern"
```

**Repeat Task 6.1 for every page listed above.** Each page = one iteration = one commit.

---

## Phase 7 — Final verification

### Task 7.1: Full UX test matrix

- [ ] **Step 1: Run all tests**

Run: `cd apps/web && npm run test`
Expected: PASS on all lib unit tests (setup-icon-registry, setup-return-to, setup-history, setup-search-index) plus any pre-existing tests.

- [ ] **Step 2: Build**

Run: `cd apps/web && npm run build`
Expected: Next.js build succeeds with no errors.

- [ ] **Step 3: UX sweep (dev server)**

Walk this list, one click at a time:

1. From `/properties` → click Cog → Settings. Expected: lands on `/settings` with Overview header, hero card, grouped cards. No Recently Visited yet (first visit).
2. Click Users card. Expected: `/settings/users` loads with `SettingsPageHeader`.
3. Click Exit Setup pill. Expected: returns to `/properties`.
4. Return to Settings via Cog → Users → Profiles → `/settings`. Expected: Recently Visited strip now shows Users and Profiles.
5. Hover Users card → click pin icon. Expected: Users moves into Pinned strip.
6. Go to `/object-manager`. Expected: new top bar (logo + "Tischler CRM" | "Object Manager" + Exit Setup pill). Click "Exit Setup" → last CRM page.
7. From `/object-manager`, click into Account. Expected: full-width navy bar with crumbs `Tischler CRM | Object Manager › Account`. Click "Object Manager" → `/object-manager`. Click Tischler logo → `/`.
8. From `/object-manager/Account`, type `fields` in Settings sidebar search. Expected: dropdown shows objects' Fields entries. ↓ + Enter navigates to `/object-manager/Account?section=fields`.
9. Type a user email in sidebar search. Expected: Users group populated; click row → `/settings/users/<id>`.
10. Refresh browser on `/settings`. Expected: Recently Visited and Pinned persist.
11. Keyboard: focus Settings search, press ↓/↑/Enter/Esc — all behave correctly.
12. Breadcrumb: on `/settings/users/<id>`, breadcrumb reads `Tischler CRM › Setup › Users › <id>`. Every non-last segment is a link that works.
13. Run: `cd apps/web && npm run lint`. Expected: no new warnings introduced.

- [ ] **Step 4: Commit any final fixes**

If the sweep surfaces any issues (typo, missed import, visual regression), fix them with small follow-up commits labeled `fix(setup): ...`.

- [ ] **Step 5: Final commit marker (optional)**

```bash
git commit --allow-empty -m "chore: Settings & Object Manager nav overhaul verified end-to-end"
```

---

## Spec coverage map

- **Spec §1 Navigation & exit paths** — Phases 1.1, 1.2, 1.3, 2.1, 2.2, 2.3 (ExitSetupPill + breadcrumb + top bar + sidebar wiring).
- **Spec §2 Sidebar IA** — Phase 3.1.
- **Spec §3 Landing page** — Phase 4 (hero + recent + pinned + grouped cards).
- **Spec §4 Typeahead search** — Phase 5.
- **Spec §5 Object Manager nav** — Phases 2.1, 2.2 (top bar on both index and detail; deep-link support via search).
- **Spec §6 Visual polish baseline** — Phase 6 (per-page audit).
- **Architecture — new modules** — Phase 0 (all five lib modules + hook).
- **Architecture — new components** — Phases 1.1 (ExitSetupPill), 1.2 (breadcrumb rewrite), 1.3 (ObjectManagerTopBar), 4.1 (hero), 4.2 (recent), 4.3 (pinned), 5.1 (typeahead).
- **Architecture — modified files** — Phases 2.1, 2.2, 2.3, 3.1, 4.4, 5.2, 6.*.
- **Testing — lib unit tests** — Phase 0 (tasks 0.1–0.4 each include tests).
- **Testing — component tests** — scoped out; replaced with manual UX sweep in Phase 7.1 (Jest config is node-only; adding RTL is out of scope per the plan header).
- **Testing — manual UX matrix** — Phase 7.1.

## Notes for the implementing engineer

- Brand constants live on Tailwind: `brand-navy` (`#151f6d`), `brand-red` (`#da291c`), `brand-light`, `brand-dark`, `brand-gray`. Never hard-code.
- Existing `SettingsPageHeader` and `SettingsContentCard` components are at `apps/web/components/settings/`. Reuse as-is.
- `apiClient` has typed helpers for `/admin/users` and `/profiles` — returns arrays. Catch errors and fall back to `[]` (matches the landing page's existing pattern).
- Schema comes from `useSchemaStore()` (Zustand). It's loaded by the global app wrapper on auth; by the time a user reaches Settings it is populated.
- Jest test files must end in `.test.ts` (not `.tsx`) and live under `__tests__/` — the `testMatch` pattern in `apps/web/jest.config.cjs` is strict about this.
- Frequent commits: each task ends with a commit. If a task's "minimal implementation" step grows, split into sub-commits.
- Do NOT introduce backwards-compatibility shims for removed props. The old `settings-breadcrumb` API was a no-arg component — the new one is too.
- The Object Manager `Page Editor` route is explicitly out of scope; its toolbar stays as-is.
