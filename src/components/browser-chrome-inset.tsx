"use client";

import { useEffect } from "react";
import {
  browserChromeBottom,
  keyboardFrame,
  publishKeyboardFrame,
  textFieldIsFocused,
} from "@/lib/visual-viewport";

/**
 * iOS Safari parks the layout viewport behind its floating toolbar, while a
 * fixed footer sticks to the visual viewport just above that toolbar. The
 * covered strip is not safe-area-inset-bottom (that is the home indicator).
 * Publish its height so the page can scroll the last line clear of the footer.
 *
 * The same listener publishes the keyboard frame used by sheets and other
 * fixed inputs. The toolbar spacer never grows by the keyboard: a focused
 * field, pinch-zoom, or a gap taller than the toolbar leaves the spacer as it
 * was.
 */
export function BrowserChromeInset() {
  useEffect(() => {
    const root = document.documentElement;
    let focusFrame = 0;

    function apply() {
      const viewport = window.visualViewport;
      const layoutHeight = window.innerHeight;
      const sample = {
        layoutHeight,
        height: viewport?.height ?? layoutHeight,
        offsetTop: viewport?.offsetTop ?? 0,
        offsetLeft: viewport?.offsetLeft ?? 0,
        width: viewport?.width ?? window.innerWidth,
        scale: viewport?.scale ?? 1,
        textFocused: textFieldIsFocused(document.activeElement),
      };
      const chrome = browserChromeBottom(sample);
      if (chrome !== null) {
        root.style.setProperty("--browser-chrome-bottom", `${chrome}px`);
      }
      publishKeyboardFrame(keyboardFrame(sample));
    }

    function applyAfterFocus() {
      cancelAnimationFrame(focusFrame);
      focusFrame = requestAnimationFrame(apply);
    }

    apply();
    window.visualViewport?.addEventListener("resize", apply);
    window.visualViewport?.addEventListener("scroll", apply);
    window.addEventListener("resize", apply);
    document.addEventListener("focusin", apply);
    document.addEventListener("focusout", applyAfterFocus);
    return () => {
      cancelAnimationFrame(focusFrame);
      window.visualViewport?.removeEventListener("resize", apply);
      window.visualViewport?.removeEventListener("scroll", apply);
      window.removeEventListener("resize", apply);
      document.removeEventListener("focusin", apply);
      document.removeEventListener("focusout", applyAfterFocus);
      publishKeyboardFrame({ open: false, bottom: 0, height: 0, offsetLeft: 0, width: 0 });
    };
  }, []);

  return null;
}
