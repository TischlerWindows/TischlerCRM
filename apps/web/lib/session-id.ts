const STORAGE_KEY = 'crm_support_session_id';

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Returns the current browser tab's stable session id. Created lazily on first
 * call and persisted in sessionStorage so a reload keeps the same id but a new
 * tab gets a fresh one. Safe to call on the server — returns empty string.
 */
export function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomUuid();
      sessionStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}
