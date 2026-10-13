"use client";

import {
  BOARD_LANES,
  BOARD_META,
  type BoardLane,
} from "@/lib/board";
import { cn } from "@/lib/utils";

export function BoardLanePicker({
  value,
  onChange,
  size = "md",
}: {
  value: BoardLane;
  onChange: (lane: BoardLane) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        size === "sm" && "gap-1",
      )}
      role="group"
      aria-label="Board lane"
    >
      {BOARD_LANES.map((lane) => {
        const meta = BOARD_META[lane];
        const active = value === lane;
        return (
          <button
            key={lane}
            type="button"
            onClick={() => onChange(lane)}
            title={meta.hint}
            className={cn(
              "rounded-lg border font-medium transition",
              size === "sm"
                ? "px-2 py-1 text-[10px]"
                : "px-2.5 py-1.5 text-xs",
              active
                ? cn(meta.chipClass, "ring-1 ring-forest-700/40")
                : "border-cream-300 bg-cream-50 text-stone-600 hover:border-stone-400 hover:text-ink",
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
