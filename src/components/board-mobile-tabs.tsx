"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BOARD_COLUMNS,
  BOARD_META,
  laneToParam,
  type BoardLane,
} from "@/lib/board";
import { TaskList } from "@/components/task-list";
import type { TaskRowData } from "@/components/task-row";
import { cn } from "@/lib/utils";

type Columns = Record<BoardLane, TaskRowData[]>;

/**
 * Mobile lane tabs. Server already fetched every lane — switch client-side
 * instantly (no RSC/DB round-trip per tap). URL stays shareable via
 * history.replaceState so we don't wait on App Router navigation.
 */
export function BoardMobileTabs({
  columns,
  initialLane,
}: {
  columns: Columns;
  initialLane: BoardLane;
}) {
  const [selected, setSelected] = useState<BoardLane>(initialLane);

  useEffect(() => {
    setSelected(initialLane);
  }, [initialLane]);

  const select = useCallback((lane: BoardLane) => {
    setSelected(lane);
    const href =
      lane === "CURRENT" ? "/tasks" : `/tasks?lane=${laneToParam(lane)}`;
    window.history.replaceState(window.history.state, "", href);
  }, []);

  return (
    <div data-board-layout="tabs" className="space-y-3 md:hidden">
      <nav
        data-board-tabs
        role="tablist"
        aria-label="Board lanes"
        className="flex gap-1 rounded-xl border border-white/10 bg-zinc-950/50 p-1"
      >
        {BOARD_COLUMNS.map((lane) => {
          const active = lane === selected;
          const count = columns[lane].length;
          return (
            <button
              key={lane}
              type="button"
              role="tab"
              data-lane-tab={lane}
              aria-selected={active}
              onClick={() => select(lane)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium",
                active
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-500 active:text-zinc-300",
              )}
            >
              {BOARD_META[lane].label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px]",
                  active
                    ? "bg-white/10 text-zinc-300"
                    : "bg-white/5 text-zinc-600",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </nav>
      <section
        data-lane={selected}
        role="tabpanel"
        aria-label={BOARD_META[selected].label}
        className="min-w-0 space-y-3"
      >
        <p className="text-[11px] text-zinc-600">{BOARD_META[selected].hint}</p>
        <TaskList
          initialTasks={columns[selected]}
          emptyMessage="Nothing here."
          allowSnooze={false}
        />
      </section>
    </div>
  );
}
