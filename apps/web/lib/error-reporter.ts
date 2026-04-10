/**
 * Lightweight client-side error reporter.
 * Sends caught errors to /api/error-log for admin visibility.
 */

let apiBase: string | null = null;

function getApiBase(): string {
  if (apiBase) return apiBase;
  apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  return apiBase;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('auth_token');
  } catch {
    return null;
  }
}

interface ErrorReport {
  message: string;
  stack?: string;
  source?: 'client' | 'server';
  url?: string;
  componentStack?: string;
  metadata?: Record<string, unknown>;
}

// Dedupe: don't report the same message more than once per session
const reported = new Set<string>();

export function reportError(report: ErrorReport): void {
  if (typeof window === 'undefined') return;

  // Dedupe key: message + url
  const key = `${report.message}::${report.url || ''}`;
  if (reported.has(key)) return;
  reported.add(key);

  const token = getAuthToken();
  const base = getApiBase();
  if (!base) return;

  const body = {
    message: report.message.slice(0, 2000),
    stack: report.stack?.slice(0, 8000),
    source: report.source || 'client',
    url: window.location.href.slice(0, 2000),
    userAgent: navigator.userAgent.slice(0, 500),
    componentStack: report.componentStack?.slice(0, 4000),
    metadata: report.metadata,
  };

  // Fire-and-forget — never let reporting itself cause issues
  try {
    fetch(`${base}/api/error-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    }).catch(() => {});
  } catch {
    // Swallow — reporting should never throw
  }
}

/**
 * Call once from a top-level layout to catch unhandled errors globally.
 */
export function installGlobalErrorHandler(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    reportError({
      message: event.message || 'Unhandled error',
      stack: event.error?.stack,
      source: 'client',
      metadata: { filename: event.filename, lineno: event.lineno, colno: event.colno },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    reportError({
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      stack: reason?.stack,
      source: 'client',
    });
  });
}
