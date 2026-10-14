"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useData } from "@/components/farm/data-context";
import type { Asset } from "@/lib/farm-types";
import { useKeyboardFrame, useLockBodyScroll } from "@/components/use-keyboard-frame";
import { Button, Input } from "@/components/farm/ui";
import { fixedViewportStyle } from "@/lib/visual-viewport";

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const frame = useKeyboardFrame();
  useLockBodyScroll(true);
  return (
    <div
      className="fixed inset-0 z-40 box-border flex max-w-full items-end justify-center overflow-x-hidden sm:items-center sm:p-4"
      style={fixedViewportStyle(frame)}
    >
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
        className="relative z-10 box-border flex max-h-[90dvh] w-full min-w-0 max-w-full flex-col overflow-x-hidden rounded-t-2xl border border-cream-200 bg-cream-50 shadow-xl sm:max-w-3xl sm:rounded-2xl"
        style={frame.open ? { maxHeight: frame.height } : undefined}
      >
        <div className="flex min-w-0 items-center justify-between gap-2 border-b border-cream-200 px-4 py-3">
          <h3 className="min-w-0 break-words text-base font-semibold text-ink">{title}</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <div data-sheet-scroll className="sheet-scroll min-w-0 max-w-full px-4 py-4 break-words [overflow-wrap:anywhere]">{children}</div>
      </div>
    </div>
  );
}

export function MoveComponentSheet({
  open,
  onClose,
  componentId,
  componentName,
  currentSystemId,
  systems,
  onMoved,
}: {
  open: boolean;
  onClose: () => void;
  componentId: string;
  componentName: string;
  currentSystemId: string;
  systems: Asset[];
  /** Called after a successful reparent (registry already refreshed). */
  onMoved: (newSystemId: string) => void;
}) {
  const { updateComponent } = useData();
  const [moveQuery, setMoveQuery] = useState("");
  const [moveTarget, setMoveTarget] = useState<Asset | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMoveQuery("");
    setMoveTarget(null);
    setMoveError(null);
    setMoving(false);
  }, [open, componentId]);

  const otherSystems = useMemo(
    () =>
      systems
        .filter((a) => a.id !== currentSystemId)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [systems, currentSystemId],
  );
  const hasOtherSystems = otherSystems.length > 0;

  const filteredSystems = useMemo(() => {
    const needle = moveQuery.trim().toLowerCase();
    if (!needle) return otherSystems;
    return otherSystems.filter(
      (a) =>
        a.name.toLowerCase().includes(needle) ||
        a.category.toLowerCase().includes(needle),
    );
  }, [otherSystems, moveQuery]);

  const reset = () => {
    setMoveQuery("");
    setMoveTarget(null);
    setMoveError(null);
    setMoving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleMove = async () => {
    if (!moveTarget) return;
    setMoving(true);
    setMoveError(null);
    try {
      await updateComponent(currentSystemId, componentId, {
        systemId: moveTarget.id,
      });
      const newId = moveTarget.id;
      reset();
      onClose();
      onMoved(newId);
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : "Failed to move");
      setMoving(false);
    }
  };

  if (!open) return null;

  return (
    <Sheet title="Move to another system" onClose={handleClose}>
      {moveError && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
          {moveError}
        </p>
      )}

      {moveTarget ? (
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Move “{componentName}” to “{moveTarget.name}”?
          </p>
          <p className="text-sm text-muted">
            Schedules and chores stay with this part.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={moving} onClick={() => void handleMove()}>
              {moving ? "Moving…" : "Move"}
            </Button>
            <Button
              variant="secondary"
              disabled={moving}
              onClick={() => {
                setMoveTarget(null);
                setMoveError(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Schedules and chores stay with this part.
          </p>
          {!hasOtherSystems ? (
            <p className="text-sm text-muted">No other systems to move to.</p>
          ) : (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  value={moveQuery}
                  onChange={(e) => setMoveQuery(e.target.value)}
                  placeholder="Search systems"
                  aria-label="Search systems"
                  className="pl-9"
                  autoComplete="off"
                />
              </div>
              {filteredSystems.length === 0 ? (
                <p className="text-sm text-muted">No matches</p>
              ) : (
                <ul className="divide-y divide-cream-200 overflow-hidden rounded-xl border border-cream-200 bg-white">
                  {filteredSystems.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        className="flex w-full items-baseline justify-between gap-3 px-3 py-2.5 text-left hover:bg-forest-50"
                        onClick={() => {
                          setMoveTarget(a);
                          setMoveError(null);
                        }}
                      >
                        <span className="font-medium text-ink">{a.name}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {a.category}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

/** Whether Move should be enabled given the full systems list. */
export function hasOtherSystemsToMoveTo(
  systems: Asset[],
  currentSystemId: string,
): boolean {
  return systems.some((a) => a.id !== currentSystemId);
}
