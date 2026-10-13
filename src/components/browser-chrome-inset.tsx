"use client";

import { useEffect } from "react";

/**
 * iOS Safari parks the layout viewport behind its floating toolbar, while a
 * fixed footer sticks to the visual viewport just above that toolbar. The
 * covered strip is not safe-area-inset-bottom (that is the home indicator).
 * Publish its height so the page can scroll the last line clear of the footer.
 */
export function BrowserChromeInset() {
  useEffect(() => {
    const root = document.documentElement;

    function apply() {
      const viewport = window.visualViewport;
      const covered = viewport
        ? Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height)
        : 0;
      root.style.setProperty("--browser-chrome-bottom", `${covered}px`);
    }

    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    return () => {
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}
