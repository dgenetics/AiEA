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
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;

/** Stop the page behind a sheet from scrolling, which is what opens the iOS gap. */
export function useLockBodyScroll(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const body = document.body;
    if (scrollLocks === 0) {
      savedScroll = {
        scrollY: window.scrollY,
        position: body.style.position,
        top: body.style.top,
        left: body.style.left,
        right: body.style.right,
        width: body.style.width,
        overflow: body.style.overflow,
      };
      body.style.position = "fixed";
      body.style.top = `-${savedScroll.scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
    }
    scrollLocks += 1;
    return () => {
      scrollLocks -= 1;
      if (scrollLocks > 0 || !savedScroll) return;
      const previous = savedScroll;
      savedScroll = null;
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.left = previous.left;
      body.style.right = previous.right;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, previous.scrollY);
    };
  }, [active]);
}
