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
                ? cn(meta.chipClass, "ring-1 ring-white/20")
                : "border-white/10 bg-zinc-950/40 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
            )}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
