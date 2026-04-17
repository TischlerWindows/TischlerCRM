/**
 * Lightweight client-side error reporter.
 * Sends caught errors to /api/error-log for admin visibility and keeps a
 * module-scope ring buffer of recent errors so the support-ticket modal can
 * offer them for auto-attachment.
 */

import { getSessionId } from './session-id';

let apiBase: string | null = null;

function getApiBase(): string {
  if (apiBase) return apiBase;
  apiBase = process.env.NEXT_PUBLIC_API_URL || '';
  return apiBase;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return (
      sessionStorage.getItem('auth_token') ||
      localStorage.getItem('auth_token')
    );
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

export interface RecentClientError {
  /** Server-assigned id. Null until the POST completes successfully. */
  id: string | null;
  message: string;
  url: string | null;
  createdAt: string;
  sessionId: string;
}

const RING_CAPACITY = 20;
const ringBuffer: RecentClientError[] = [];

// Dedupe: don't post the same message twice per session
const reported = new Set<string>();

function pushToRing(entry: RecentClientError) {
  ringBuffer.push(entry);
  while (ringBuffer.length > RING_CAPACITY) ringBuffer.shift();
}

export function getRecentClientErrors(): RecentClientError[] {
  // Return a defensive copy, newest first
  return [...ringBuffer].reverse();
}

export function reportError(report: ErrorReport): void {
  if (typeof window === 'undefined') return;

  const url = window.location.href.slice(0, 2000);
  const key = `${report.message}::${url}`;
  if (reported.has(key)) return;
  reported.add(key);

  const token = getAuthToken();
  const base = getApiBase();
  if (!base) return;

  const sessionId = getSessionId();
  const body = {
    message: report.message.slice(0, 2000),
    stack: report.stack?.slice(0, 8000),
    source: report.source || 'client',
    url,
    userAgent: navigator.userAgent.slice(0, 500),
    componentStack: report.componentStack?.slice(0, 4000),
    metadata: report.metadata,
    sessionId,
  };

  const bufferEntry: RecentClientError = {
    id: null,
    message: body.message,
    url,
    createdAt: new Date().toISOString(),
    sessionId,
  };
  pushToRing(bufferEntry);

  // Fire-and-forget — never let reporting itself cause issues
  try {
    fetch(`${base}/api/error-log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (data?.id) {
          bufferEntry.id = data.id;
        }
      })
      .catch(() => {});
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
