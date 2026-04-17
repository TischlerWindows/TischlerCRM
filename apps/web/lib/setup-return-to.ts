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
