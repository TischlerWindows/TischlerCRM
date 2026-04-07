'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

const LS_LEFT = 'pageEditor.panelLeftW';
const LS_LC = 'pageEditor.panelLeftCollapsed';
const MIN_LEFT_WIDTH = 200;
const MAX_LEFT_WIDTH = 520;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function useEditorSidePanels() {
  const [leftWidth, setLeftWidth] = useState(256);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  const clearActiveDragListeners = useCallback(() => {
    if (!dragCleanupRef.current) return;
    dragCleanupRef.current();
    dragCleanupRef.current = null;
  }, []);

  useEffect(() => {
    try {
      const lw = localStorage.getItem(LS_LEFT);
      if (lw !== null) {
        const parsed = Number(lw);
        if (Number.isFinite(parsed)) {
          setLeftWidth(clamp(parsed, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
        } else {
          localStorage.removeItem(LS_LEFT);
        }
      }
      if (localStorage.getItem(LS_LC) === '1') setLeftCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LEFT, String(leftWidth));
      localStorage.setItem(LS_LC, leftCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [leftWidth, leftCollapsed]);

  const startResizeLeft = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      clearActiveDragListeners();
      const startX = e.clientX;
      const startW = leftWidth;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        setLeftWidth(clamp(startW + dx, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
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
    [clearActiveDragListeners, leftWidth],
  );

  useEffect(() => () => clearActiveDragListeners(), [clearActiveDragListeners]);

  const adjustLeftWidth = useCallback((delta: number) => {
    setLeftCollapsed(false);
    setLeftWidth((current) => clamp(current + delta, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH));
  }, []);

  return {
    leftWidth,
    leftCollapsed,
    setLeftCollapsed,
    toggleLeftCollapsed: () => setLeftCollapsed((c) => !c),
    startResizeLeft,
    adjustLeftWidth,
  };
}
