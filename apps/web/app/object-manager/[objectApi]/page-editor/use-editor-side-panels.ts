'use client';

import { useCallback, useEffect, useState } from 'react';

const LS_LEFT = 'pageEditor.panelLeftW';
const LS_RIGHT = 'pageEditor.panelRightW';
const LS_LC = 'pageEditor.panelLeftCollapsed';
const LS_RC = 'pageEditor.panelRightCollapsed';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function useEditorSidePanels() {
  const [leftWidth, setLeftWidth] = useState(256);
  const [rightWidth, setRightWidth] = useState(320);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  useEffect(() => {
    try {
      const lw = localStorage.getItem(LS_LEFT);
      const rw = localStorage.getItem(LS_RIGHT);
      if (lw) setLeftWidth(clamp(Number(lw), 200, 520));
      if (rw) setRightWidth(clamp(Number(rw), 240, 560));
      if (localStorage.getItem(LS_LC) === '1') setLeftCollapsed(true);
      if (localStorage.getItem(LS_RC) === '1') setRightCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_LEFT, String(leftWidth));
      localStorage.setItem(LS_RIGHT, String(rightWidth));
      localStorage.setItem(LS_LC, leftCollapsed ? '1' : '0');
      localStorage.setItem(LS_RC, rightCollapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [leftWidth, rightWidth, leftCollapsed, rightCollapsed]);

  const startResizeLeft = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = leftWidth;
      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        setLeftWidth(clamp(startW + dx, 200, 520));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [leftWidth],
  );

  const startResizeRight = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = rightWidth;
      const onMove = (ev: MouseEvent) => {
        const dx = startX - ev.clientX;
        setRightWidth(clamp(startW + dx, 240, 560));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [rightWidth],
  );

  return {
    leftWidth,
    rightWidth,
    leftCollapsed,
    rightCollapsed,
    setLeftCollapsed,
    setRightCollapsed,
    toggleLeftCollapsed: () => setLeftCollapsed((c) => !c),
    toggleRightCollapsed: () => setRightCollapsed((c) => !c),
    startResizeLeft,
    startResizeRight,
  };
}
