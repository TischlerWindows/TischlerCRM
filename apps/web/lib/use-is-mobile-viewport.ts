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

/**
 * True when the device is classified as mobile (see useIsMobileViewport)
 * AND currently rotated into landscape orientation. Used to shrink/reflow
 * mobile drawer UI (sidebars, etc.) that would otherwise look oversized or
 * positioned too low when the available viewport height shrinks in
 * landscape.
 */
export function useIsLandscapeMobile(breakpoint: number = DEFAULT_BREAKPOINT): boolean {
  const [isLandscapeMobile, setIsLandscapeMobile] = useState(false);

  useEffect(() => {
    const compute = () => {
      const screenShortSide = Math.min(window.screen.width, window.screen.height);
      const isMobileDevice = screenShortSide < breakpoint;
      const isLandscape = window.innerWidth > window.innerHeight;
      setIsLandscapeMobile(isMobileDevice && isLandscape);
    };
    compute();
    window.addEventListener('resize', compute);
    window.addEventListener('orientationchange', compute);
    return () => {
      window.removeEventListener('resize', compute);
      window.removeEventListener('orientationchange', compute);
    };
  }, [breakpoint]);

  return isLandscapeMobile;
}
