'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

export interface PanelConfig {
  min: number;
  max: number;
  default: number;
}

export interface ResizableSidePanelsConfig {
  /** Prefix for localStorage keys. Keys become `${storageKey}.leftW`, `.leftCollapsed`, `.rightW`, `.rightCollapsed`. */
  storageKey: string;
  left?: PanelConfig;
  right?: PanelConfig;
  /**
   * Optional legacy key prefix to migrate from. If set, we read old keys
   * `${legacyStorageKey}.panelLeftW` / `.panelLeftCollapsed` once and write
   * them under the new naming, then remove them.
   */
  legacyStorageKey?: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function readNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      localStorage.removeItem(key);
      return fallback;
    }
    return clamp(parsed, min, max);
  } catch {
    return fallback;
  }
}

function readBool(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export interface PanelState {
  width: number;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
  toggleCollapsed: () => void;
  startResize: (e: ReactMouseEvent) => void;
  adjustWidth: (delta: number) => void;
}

export interface ResizableSidePanels {
  left?: PanelState;
  right?: PanelState;
}

/**
 * Generic hook for a builder shell with up to two resizable side panels.
 * Widths persist in localStorage under `${storageKey}.*`. Includes optional
 * one-time migration from a legacy key naming scheme.
 */
export function useResizableSidePanels(config: ResizableSidePanelsConfig): ResizableSidePanels {
  const { storageKey, left, right, legacyStorageKey } = config;

  const leftKeyW = `${storageKey}.leftW`;
  const leftKeyC = `${storageKey}.leftCollapsed`;
  const rightKeyW = `${storageKey}.rightW`;
  const rightKeyC = `${storageKey}.rightCollapsed`;

  const [leftWidth, setLeftWidth] = useState(left?.default ?? 0);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightWidth, setRightWidth] = useState(right?.default ?? 0);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  const dragCleanupRef = useRef<(() => void) | null>(null);

  const clearActiveDragListeners = useCallback(() => {
    if (!dragCleanupRef.current) return;
    dragCleanupRef.current();
    dragCleanupRef.current = null;
  }, []);

  // Initial load + legacy migration (runs once on mount).
  useEffect(() => {
    try {
      if (legacyStorageKey) {
        const legacyW = `${legacyStorageKey}.panelLeftW`;
        const legacyC = `${legacyStorageKey}.panelLeftCollapsed`;
        const legacyWidth = localStorage.getItem(legacyW);
        if (legacyWidth !== null && localStorage.getItem(leftKeyW) === null) {
          localStorage.setItem(leftKeyW, legacyWidth);
        }
        const legacyCollapsed = localStorage.getItem(legacyC);
        if (legacyCollapsed !== null && localStorage.getItem(leftKeyC) === null) {
          localStorage.setItem(leftKeyC, legacyCollapsed);
        }
        try {
          localStorage.removeItem(legacyW);
          localStorage.removeItem(legacyC);
        } catch {
          /* ignore */
        }
      }

      if (left) {
        setLeftWidth(readNumber(leftKeyW, left.default, left.min, left.max));
        setLeftCollapsed(readBool(leftKeyC));
      }
      if (right) {
        setRightWidth(readNumber(rightKeyW, right.default, right.min, right.max));
        setRightCollapsed(readBool(rightKeyC));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist on change.
  useEffect(() => {
    if (!left) return;
    try {
      localStorage.setItem(leftKeyW, String(leftWidth));
      localStorage.setItem(leftKeyC, leftCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [left, leftKeyW, leftKeyC, leftWidth, leftCollapsed]);

  useEffect(() => {
    if (!right) return;
    try {
      localStorage.setItem(rightKeyW, String(rightWidth));
      localStorage.setItem(rightKeyC, rightCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [right, rightKeyW, rightKeyC, rightWidth, rightCollapsed]);

  const startResizeLeft = useCallback(
    (e: ReactMouseEvent) => {
      if (!left) return;
      e.preventDefault();
      clearActiveDragListeners();
      const startX = e.clientX;
      const startW = leftWidth;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        setLeftWidth(clamp(startW + dx, left.min, left.max));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        dragCleanupRef.current = null;
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      dragCleanupRef.current = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
    },
    [clearActiveDragListeners, left, leftWidth],
  );

  const startResizeRight = useCallback(
    (e: ReactMouseEvent) => {
      if (!right) return;
      e.preventDefault();
      clearActiveDragListeners();
      const startX = e.clientX;
      const startW = rightWidth;
      const onMove = (ev: MouseEvent) => {
        // Dragging the handle leftward grows the right panel.
        const dx = startX - ev.clientX;
        setRightWidth(clamp(startW + dx, right.min, right.max));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        dragCleanupRef.current = null;
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      dragCleanupRef.current = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
    },
    [clearActiveDragListeners, right, rightWidth],
  );

  useEffect(() => () => clearActiveDragListeners(), [clearActiveDragListeners]);

  const adjustLeftWidth = useCallback(
    (delta: number) => {
      if (!left) return;
      setLeftCollapsed(false);
      setLeftWidth((current) => clamp(current + delta, left.min, left.max));
    },
    [left],
  );

  const adjustRightWidth = useCallback(
    (delta: number) => {
      if (!right) return;
      setRightCollapsed(false);
      setRightWidth((current) => clamp(current + delta, right.min, right.max));
    },
    [right],
  );

  const leftState: PanelState | undefined = left
    ? {
        width: leftWidth,
        collapsed: leftCollapsed,
        setCollapsed: setLeftCollapsed,
        toggleCollapsed: () => setLeftCollapsed((c) => !c),
        startResize: startResizeLeft,
        adjustWidth: adjustLeftWidth,
      }
    : undefined;

  const rightState: PanelState | undefined = right
    ? {
        width: rightWidth,
        collapsed: rightCollapsed,
        setCollapsed: setRightCollapsed,
        toggleCollapsed: () => setRightCollapsed((c) => !c),
        startResize: startResizeRight,
        adjustWidth: adjustRightWidth,
      }
    : undefined;

  return { left: leftState, right: rightState };
}
