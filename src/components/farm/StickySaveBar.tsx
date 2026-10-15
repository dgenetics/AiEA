"use client";

import { useKeyboardFrame } from "@/components/use-keyboard-frame";
import { cn } from "@/lib/utils";

/**
 * Sticky action bar sitting just above the fixed bottom tab nav
 * so long forms keep Cancel/Save reachable.
 */
export function StickySaveBar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const frame = useKeyboardFrame();
  return (
    <>
      {/* Spacer so form content isn't hidden behind the bar + tab nav */}
      <div className="h-20" aria-hidden />
      <div
        data-sticky-save
        className={cn(
          "pointer-events-none fixed inset-x-0",
          frame.open ? "z-50" : "z-30 bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]",
          className,
        )}
        style={frame.open ? { bottom: frame.bottom } : undefined}
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-0">
          <div className="pointer-events-auto flex justify-end gap-2 rounded-t-2xl border border-b-0 border-cream-200 bg-cream-50/95 px-4 py-3 shadow-[0_-4px_16px_rgba(28,25,23,0.06)] backdrop-blur-md">
            {children}
          </div>
        </div>
      </div>
    </>
  )
}
