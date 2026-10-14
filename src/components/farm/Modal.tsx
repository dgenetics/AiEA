"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { useKeyboardFrame, useLockBodyScroll } from "@/components/use-keyboard-frame";
import { Button } from "@/components/farm/ui";
import { fixedViewportStyle } from "@/lib/visual-viewport";

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

  useEffect(() => {
    if (variant !== "sheet") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (onBack) onBack();
        else onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, onClose, variant]);

  if (variant === "sheet") {
    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center min-[700px]:items-center min-[700px]:p-4"
        style={viewportStyle}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-stone-900/40"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={
            frame.open
              ? "relative z-10 w-full overflow-y-auto rounded-t-[22px] bg-[#fbf8f2] px-5 pt-2 pb-5 shadow-2xl min-[700px]:max-w-[440px] min-[700px]:rounded-[20px] min-[700px]:px-6 min-[700px]:pt-5 min-[700px]:pb-6"
              : "relative z-10 max-h-[90dvh] w-full overflow-y-auto rounded-t-[22px] bg-[#fbf8f2] px-5 pt-2 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-2xl min-[700px]:max-w-[440px] min-[700px]:rounded-[20px] min-[700px]:px-6 min-[700px]:pt-5 min-[700px]:pb-6"
          }
          style={frame.open ? { maxHeight: frame.height } : undefined}
        >
          <div aria-hidden className="mx-auto mb-2.5 h-1 w-9 rounded-full bg-[#d6cdbb] min-[700px]:hidden" />
          <div className="flex min-h-10 items-start justify-between">
            <div className="flex min-w-0 items-center gap-1 pt-2">
              {onBack ? (
                <button
                  type="button"
                  aria-label="Back"
                  onClick={onBack}
                  className="-ml-1 flex size-10 shrink-0 items-center justify-center text-[22px] leading-none text-stone-600"
                >
                  ‹
                </button>
              ) : null}
              <div className="min-w-0">
              <h2 className="text-[19px] font-semibold tracking-tight text-stone-900">{title}</h2>
              {subtitle ? (
                <p className="mt-0.5 text-[13px] text-[#78716c] [overflow-wrap:anywhere]">{subtitle}</p>
              ) : null}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="-mr-2.5 flex size-10 items-center justify-center rounded-full text-stone-500"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="break-words">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={viewportStyle}>
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-ink/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative z-10 flex max-h-[min(90dvh,40rem)] w-full min-w-0 max-w-[min(32rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-cream-200 bg-cream-50 shadow-xl"
        style={frame.open ? { maxHeight: frame.height } : undefined}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-cream-200 px-4 py-3">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 py-4 break-words">{children}</div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-cream-200 px-4 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
