import Link from "next/link";
import {
  TODAY_LANE_FILTERS,
  TODAY_LANE_META,
  todayLaneHref,
  type TodayLaneFilter,
} from "@/lib/today-filters";
import { cn } from "@/lib/utils";

export function TodayLaneFilters({
  active,
  counts,
  hiddenCount,
}: {
  active: TodayLaneFilter;
  counts: Record<TodayLaneFilter, number>;
  /** Tasks in the broader firehose not shown under the active filter */
  hiddenCount?: number;
}) {
  return (
    <div className="space-y-2">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Lane filter"
      >
        {TODAY_LANE_FILTERS.map((lane) => {
          const meta = TODAY_LANE_META[lane];
          const selected = active === lane;
          const count = counts[lane];
          return (
            <Link
              key={lane}
              href={todayLaneHref(lane)}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                selected
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/30"
                  : "border-white/10 bg-zinc-950/40 text-zinc-500 hover:border-white/20 hover:text-zinc-300",
              )}
              aria-current={selected ? "page" : undefined}
            >
              {meta.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  selected
                    ? "bg-indigo-500/25 text-indigo-100"
                    : "bg-white/5 text-zinc-500",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </div>
      {hiddenCount != null && hiddenCount > 0 && active !== "all" ? (
        <p className="text-[11px] text-zinc-500">
          {hiddenCount} hidden ·{" "}
          <Link
            href={todayLaneHref("all")}
            scroll={false}
            className="text-zinc-400 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Show all
          </Link>
        </p>
      ) : null}
    </div>
  );
}
