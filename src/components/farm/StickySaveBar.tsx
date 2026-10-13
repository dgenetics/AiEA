import { cn } from "@/lib/utils"

/**
 * Sticky action bar sitting just above the fixed bottom tab nav
 * so long forms keep Cancel/Save reachable.
 */
export function StickySaveBar({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <>
      {/* Spacer so form content isn't hidden behind the bar + tab nav */}
      <div className="h-20" aria-hidden />
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 z-30',
          // Sit above the ~3.75rem tab bar + safe-area
          'bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))]',
          className,
        )}
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
