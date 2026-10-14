"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getKeyboardFrame,
  getServerKeyboardFrame,
  subscribeKeyboardFrame,
  type KeyboardFrame,
} from "@/lib/visual-viewport";

/** The keyboard frame published by the single visual-viewport listener. */
export function useKeyboardFrame(): KeyboardFrame {
  return useSyncExternalStore(subscribeKeyboardFrame, getKeyboardFrame, getServerKeyboardFrame);
}

let scrollLocks = 0;
let savedScroll: {
  scrollY: number;
  scrollX: number;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
  touchAction: string;
  overscrollBehavior: string;
  maxWidth: string;
  htmlOverflow: string;
  htmlTouchAction: string;
  htmlOverscroll: string;
} | null = null;

/** A touch on the dimmed page must not pan it. The sheet scroll area opts in. */
function blockBackgroundPan(event: TouchEvent) {
  const target = event.target;
  if (target instanceof Element && target.closest("[data-sheet-scroll]")) return;
  event.preventDefault();
}

/** Stop the page behind a sheet from scrolling or panning, which is what opens the iOS gap. */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    const html = document.documentElement;
    if (scrollLocks === 0) {
      savedScroll = {
        scrollY: window.scrollY,
        scrollX: window.scrollX,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
        touchAction: body.style.touchAction,
        overscrollBehavior: body.style.overscrollBehavior,
        maxWidth: body.style.maxWidth,
        htmlOverflow: html.style.overflow,
        htmlTouchAction: html.style.touchAction,
        htmlOverscroll: html.style.overscrollBehavior,
      };
      body.style.position = "fixed";
      body.style.top = `-${savedScroll.scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.maxWidth = "100%";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
      body.style.overscrollBehavior = "none";
      html.style.overflow = "hidden";
      html.style.touchAction = "none";
      html.style.overscrollBehavior = "none";
      document.addEventListener("touchmove", blockBackgroundPan, { passive: false });
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks > 0 || !savedScroll) return;
      const previous = savedScroll;
      savedScroll = null;
      document.removeEventListener("touchmove", blockBackgroundPan);
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.maxWidth = previous.maxWidth;
      body.style.overflow = previous.overflow;
      body.style.touchAction = previous.touchAction;
      body.style.overscrollBehavior = previous.overscrollBehavior;
      html.style.overflow = previous.htmlOverflow;
      html.style.touchAction = previous.htmlTouchAction;
      html.style.overscrollBehavior = previous.htmlOverscroll;
      window.scrollTo(previous.scrollX, previous.scrollY);
    };
  }, [active]);
}
