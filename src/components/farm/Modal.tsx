"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useKeyboardFrame, useLockBodyScroll } from "@/components/use-keyboard-frame";
import { Button } from "@/components/farm/ui";
import { fixedViewportStyle } from "@/lib/visual-viewport";

/** Downward speed, in px/ms, that counts as a flick even below the distance threshold. */
const FLICK_VELOCITY = 0.85;
const DRAG_SLOP = 8;

type DragSample = {
  startX: number;
  startY: number;
  lastY: number;
  lastT: number;
  velocity: number;
  active: boolean;
};

function freshSample(x: number, y: number): DragSample {
  return { startX: x, startY: y, lastY: y, lastT: performance.now(), velocity: 0, active: false };
}

function noteMove(sample: DragSample, y: number) {
  const now = performance.now();
  const dt = now - sample.lastT;
  if (dt > 0) sample.velocity = (y - sample.lastY) / dt;
  sample.lastY = y;
  sample.lastT = now;
}

/** Centered dialog by default. `sheet` is a bottom sheet on a phone and a 440px dialog from 700px up. */
export function Modal({
  title,
  subtitle,
  onBack,
  onClose,
  children,
  footer,
  variant = "default",
}: {
  title: string;
  subtitle?: string;
  /** When set, ‹ returns to the previous sheet view and Escape does the same. */
  onBack?: () => void;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  variant?: "default" | "sheet";
}) {
  const frame = useKeyboardFrame();
  useLockBodyScroll(true);
  const viewportStyle = fixedViewportStyle(frame);
  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const yRef = useRef(0);
  const closingRef = useRef(false);
  const pointerSample = useRef<DragSample | null>(null);
  const [dragY, setDragY] = useState(0);
  const [follow, setFollow] = useState(false);

  function setY(next: number) {
    yRef.current = next;
    setDragY(next);
  }

  function beginClose() {
    if (variant !== "sheet") {
      onCloseRef.current();
      return;
    }
    if (closingRef.current) return;
    closingRef.current = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      onCloseRef.current();
      return;
    }
    const height = dialogRef.current?.getBoundingClientRect().height ?? window.innerHeight;
    setFollow(false);
    setY(Math.ceil(height) + 32);
    window.setTimeout(() => onCloseRef.current(), 280);
  }

  function suppressGhostClick() {
    function block(event: Event) {
      event.preventDefault();
      event.stopPropagation();
    }
    document.addEventListener("click", block, { capture: true, once: true });
    window.setTimeout(() => document.removeEventListener("click", block, true), 400);
  }

  function settle(velocity: number) {
    if (closingRef.current) return;
    const height = dialogRef.current?.getBoundingClientRect().height ?? 1;
    const y = yRef.current;
    const flick = velocity > FLICK_VELOCITY && y > 40;
    if (y > height * 0.25 || flick) beginClose();
    else {
      setFollow(false);
      setY(0);
    }
  }

  useEffect(() => {
    if (variant !== "sheet") return;
    const chrome = chromeRef.current;
    const scroller = scrollRef.current;
    if (!chrome || !scroller) return;
    const sheetBody = scroller;

    let sample: DragSample | null = null;
    let mode: "chrome" | "body" | null = null;

    function moveTo(y: number) {
      if (!sample) return;
      noteMove(sample, y);
      const dy = y - sample.startY;
      if (!sample.active) {
        if (dy < DRAG_SLOP) return;
        sample.active = true;
      }
      setFollow(true);
      setY(Math.max(0, dy));
    }

    function endDrag() {
      if (!sample) return;
      const velocity = sample.velocity;
      const active = sample.active;
      sample = null;
      mode = null;
      if (active) {
        suppressGhostClick();
        settle(velocity);
      }
    }

    function onChromeStart(event: TouchEvent) {
      if (event.touches.length !== 1 || closingRef.current) return;
      mode = "chrome";
      const touch = event.touches[0];
      sample = freshSample(touch.clientX, touch.clientY);
    }

    function onChromeMove(event: TouchEvent) {
      if (mode !== "chrome" || !sample || event.touches.length !== 1) return;
      moveTo(event.touches[0].clientY);
      if (sample?.active) event.preventDefault();
    }

    function onBodyStart(event: TouchEvent) {
      if (event.touches.length !== 1 || closingRef.current || mode === "chrome") return;
      const target = event.target;
      if (target instanceof Element && target.closest("input, textarea, select, button, a, [contenteditable='true']")) {
        return;
      }
      mode = "body";
      const touch = event.touches[0];
      sample = freshSample(touch.clientX, touch.clientY);
    }

    function onBodyMove(event: TouchEvent) {
      if (mode !== "body" || !sample || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dy = touch.clientY - sample.startY;
      const dx = touch.clientX - sample.startX;
      if (!sample.active) {
        if (sheetBody.scrollTop > 1) {
          sample = null;
          mode = null;
          return;
        }
        if (dy > DRAG_SLOP && Math.abs(dy) > Math.abs(dx)) {
          sample.active = true;
        } else if (dy < -DRAG_SLOP || Math.abs(dx) > DRAG_SLOP) {
          sample = null;
          mode = null;
          return;
        } else {
          return;
        }
      }
      noteMove(sample, touch.clientY);
      event.preventDefault();
      setFollow(true);
      setY(Math.max(0, touch.clientY - sample.startY));
    }

    chrome.addEventListener("touchstart", onChromeStart, { passive: true });
    chrome.addEventListener("touchmove", onChromeMove, { passive: false });
    chrome.addEventListener("touchend", endDrag);
    chrome.addEventListener("touchcancel", endDrag);
    sheetBody.addEventListener("touchstart", onBodyStart, { passive: true });
    sheetBody.addEventListener("touchmove", onBodyMove, { passive: false });
    sheetBody.addEventListener("touchend", endDrag);
    sheetBody.addEventListener("touchcancel", endDrag);
    return () => {
      chrome.removeEventListener("touchstart", onChromeStart);
      chrome.removeEventListener("touchmove", onChromeMove);
      chrome.removeEventListener("touchend", endDrag);
      chrome.removeEventListener("touchcancel", endDrag);
      sheetBody.removeEventListener("touchstart", onBodyStart);
      sheetBody.removeEventListener("touchmove", onBodyMove);
      sheetBody.removeEventListener("touchend", endDrag);
      sheetBody.removeEventListener("touchcancel", endDrag);
    };
  }, [variant]);

  function onChromePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (variant !== "sheet" || event.pointerType === "touch" || event.button !== 0 || closingRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerSample.current = freshSample(event.clientX, event.clientY);
  }

  function onChromePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const sample = pointerSample.current;
    if (!sample) return;
    noteMove(sample, event.clientY);
    const dy = event.clientY - sample.startY;
    if (!sample.active) {
      if (dy < DRAG_SLOP) return;
      sample.active = true;
    }
    setFollow(true);
    setY(Math.max(0, dy));
  }

  function onChromePointerUp() {
    const sample = pointerSample.current;
    if (!sample) return;
    pointerSample.current = null;
    if (sample.active) {
      suppressGhostClick();
      settle(sample.velocity);
    }
  }

  useEffect(() => {
    if (variant !== "sheet") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (onBack) onBack();
        else beginClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, onClose, variant]);

  if (variant === "sheet") {
    return (
      <div
        className="fixed inset-0 z-50 flex max-w-full items-end justify-center overflow-x-hidden min-[700px]:items-center min-[700px]:p-4"
        style={viewportStyle}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 touch-none bg-[#57534e]"
          onClick={beginClose}
        />
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={
            frame.open
              ? "relative z-10 box-border flex h-full max-h-full w-full min-w-0 max-w-full flex-col overflow-hidden rounded-t-[22px] bg-[#fbf8f2] shadow-2xl min-[700px]:h-auto min-[700px]:max-h-[min(90dvh,40rem)] min-[700px]:max-w-[440px] min-[700px]:rounded-[20px]"
              : "relative z-10 box-border flex h-[calc(100dvh-2.5rem-env(safe-area-inset-top,0px))] max-h-[calc(100dvh-2.5rem-env(safe-area-inset-top,0px))] w-full min-w-0 max-w-full flex-col overflow-hidden rounded-t-[22px] bg-[#fbf8f2] shadow-2xl min-[700px]:h-auto min-[700px]:max-h-[min(90dvh,40rem)] min-[700px]:max-w-[440px] min-[700px]:rounded-[20px]"
          }
          style={{
            ...(frame.open ? { maxHeight: frame.height } : {}),
            transform: `translate3d(0, ${dragY}px, 0)`,
            transition: follow ? "none" : "transform 220ms ease",
          }}
        >
          <div
            ref={chromeRef}
            data-sheet-chrome
            onPointerDown={onChromePointerDown}
            onPointerMove={onChromePointerMove}
            onPointerUp={onChromePointerUp}
            onPointerCancel={onChromePointerUp}
            className="shrink-0 touch-none bg-[#fbf8f2] select-none"
          >
          <div aria-hidden className="flex justify-center pt-2.5 min-[700px]:hidden">
            <div className="h-1 w-9 rounded-full bg-[#d6cdbb]" />
          </div>
          <div className="flex min-h-10 min-w-0 items-center justify-between gap-3 border-b border-[#e7e1d6] px-5 pt-3 pb-3">
            <div className="flex min-w-0 items-center gap-1">
              {onBack ? (
                <button
                  type="button"
                  aria-label="Back"
                  onClick={onBack}
                  className="flex size-8 shrink-0 items-center justify-center text-[22px] leading-none text-stone-600"
                >
                  ‹
                </button>
              ) : null}
              <div className="min-w-0">
              <h2 className="text-[19px] font-semibold tracking-tight break-words text-stone-900">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-[13px] text-[#78716c] [overflow-wrap:anywhere]">{subtitle}</p>
              ) : null}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={beginClose}
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e7e1d6] text-[#57534e]"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          </div>
          <div
            ref={scrollRef}
            data-sheet-scroll
            className={
              frame.open
                ? "sheet-scroll min-h-0 min-w-0 max-w-full flex-1 px-5 pt-1 pb-5 break-words [overflow-wrap:anywhere]"
                : "sheet-scroll min-h-0 min-w-0 max-w-full flex-1 px-5 pt-1 pb-[calc(20px+env(safe-area-inset-bottom))] break-words [overflow-wrap:anywhere]"
            }
          >
            {children}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 box-border flex max-w-full items-center justify-center overflow-x-hidden p-4" style={viewportStyle}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 touch-none bg-ink/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 box-border flex max-h-[min(90dvh,40rem)] w-full min-w-0 max-w-lg flex-col overflow-hidden rounded-2xl border border-cream-200 bg-cream-50 shadow-xl"
        style={frame.open ? { maxHeight: frame.height } : undefined}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
          <h2 className="min-w-0 break-words text-base font-semibold text-ink">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div data-sheet-scroll className="sheet-scroll min-h-0 min-w-0 max-w-full flex-1 px-4 py-4 break-words [overflow-wrap:anywhere]">{children}</div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-cream-200 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
