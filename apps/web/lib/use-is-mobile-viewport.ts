'use client';

import { useEffect, useState } from 'react';

const DEFAULT_BREAKPOINT = 768;

/**
 * Determines whether the current device should use the "mobile" layout
 * (collapsible drawer sidebar, hamburger toggle, etc).
 *
 * Deliberately uses `window.screen.width`/`window.screen.height` (the
 * physical/logical screen size) rather than `window.innerWidth` (the
 * viewport size). `innerWidth` changes when a phone is rotated to
 * landscape and can exceed typical `md:` breakpoints, which was flipping
 * pages into the desktop (always-open, non-collapsible) sidebar layout on
 * rotation. The screen's shorter side stays constant across orientation
 * changes, so a phone stays classified as "mobile" whether held upright
 * or sideways, while tablets/desktops (whose shorter side is larger than
 * the breakpoint) are unaffected.
 */
export function useIsMobileViewport(breakpoint: number = DEFAULT_BREAKPOINT): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const compute = () => {
      const screenShortSide = Math.min(window.screen.width, window.screen.height);
      setIsMobile(screenShortSide < breakpoint);
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [breakpoint]);

  return isMobile;
}
