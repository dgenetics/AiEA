import { Button } from "@/components/farm/ui";

/** Vertically centered modal overlay (not a bottom sheet). */
export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
