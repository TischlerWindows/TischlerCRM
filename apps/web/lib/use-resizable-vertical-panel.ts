'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

export interface ResizableVerticalPanelConfig {
  /** localStorage key for the persisted height, e.g. `proposalBuilder.variablesH`. */
  storageKey: string;
  min: number;
  max: number;
  default: number;
}

export interface ResizableVerticalPanel {
  height: number;
  startResize: (e: ReactMouseEvent) => void;
  adjustHeight: (delta: number) => void;
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

/**
 * Hook for a single vertically-resizable panel. Mirrors the drag/persist/keyboard
 * pattern of `useResizableSidePanels` but for the Y axis. Dragging the handle
 * downward grows the panel (the panel sits below the handle).
 */
export function useResizableVerticalPanel(
  config: ResizableVerticalPanelConfig,
): ResizableVerticalPanel {
  const { storageKey, min, max, default: defaultHeight } = config;

  const [height, setHeight] = useState(defaultHeight);

  const dragCleanupRef = useRef<(() => void) | null>(null);

  const clearActiveDragListeners = useCallback(() => {
    if (!dragCleanupRef.current) return;
    dragCleanupRef.current();
    dragCleanupRef.current = null;
  }, []);

  useEffect(() => {
    setHeight(readNumber(storageKey, defaultHeight, min, max));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, String(height));
    } catch {
      /* ignore */
    }
  }, [storageKey, height]);

  const startResize = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      clearActiveDragListeners();
      const startY = e.clientY;
      const startH = height;
      const onMove = (ev: MouseEvent) => {
        // Handle sits above the panel; dragging up grows the panel below it.
        const dy = startY - ev.clientY;
        setHeight(clamp(startH + dy, min, max));
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
    [clearActiveDragListeners, height, min, max],
  );

  useEffect(() => () => clearActiveDragListeners(), [clearActiveDragListeners]);

  const adjustHeight = useCallback(
    (delta: number) => {
      setHeight((current) => clamp(current + delta, min, max));
    },
    [min, max],
  );

  return { height, startResize, adjustHeight };
}
