"use client";

import { useEffect } from "react";

const MAX_BROWSER_CHROME_BOTTOM = 100;

function textFieldIsFocused(): boolean {
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return false;
  if (el instanceof HTMLTextAreaElement) return true;
  if (el instanceof HTMLElement && el.isContentEditable) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  const nonText = new Set([
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ]);
  return !nonText.has(el.type);
}

/**
 * iOS Safari parks the layout viewport behind its floating toolbar, while a
 * fixed footer sticks to the visual viewport just above that toolbar. The
 * covered strip is not safe-area-inset-bottom (that is the home indicator).
 * Publish its height so the page can scroll the last line clear of the footer.
 *
 * The keyboard and pinch-zoom shrink visualViewport the same way. Skip those
 * updates, and never publish more than 100px, so the spacer stays a toolbar
 * gap instead of growing by the keyboard.
 */
export function BrowserChromeInset() {
  useEffect(() => {
    const root = document.documentElement;

    function apply() {
      const viewport = window.visualViewport;
      if (!viewport || viewport.scale !== 1 || textFieldIsFocused()) return;
      const covered = Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height);
      root.style.setProperty(
        "--browser-chrome-bottom",
        `${Math.min(MAX_BROWSER_CHROME_BOTTOM, covered)}px`,
      );
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
