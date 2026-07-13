"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TaskList } from "@/components/task-list";
import type { TaskRowData } from "@/components/task-row";
import { toArchiveRow, type ArchiveTaskRaw } from "@/lib/archive";

const PAGE_SIZE = 40;

type SectionState = {
  tasks: TaskRowData[];
  nextOffset: number | null;
  hasMore: boolean;
  total: number;
  loading: boolean;
};

type Props = {
  initialOneTime: {
    tasks: TaskRowData[];
    nextOffset: number | null;
    hasMore: boolean;
    total: number;
  };
  initialRecurring: {
    tasks: TaskRowData[];
    nextOffset: number | null;
    hasMore: boolean;
    total: number;
  };
  grandTotal: number;
};

async function fetchArchivePage(
  kind: "one_time" | "occurrence",
  offset: number,
): Promise<{
  tasks: TaskRowData[];
  nextOffset: number | null;
  hasMore: boolean;
  total: number;
}> {
  const params = new URLSearchParams({
    view: "archive",
    kind,
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });

  const res = await fetch(`/api/tasks?${params}`);
  if (!res.ok) throw new Error("Failed to load archive");
  const data = await res.json();
  const raw = (data.tasks ?? []) as ArchiveTaskRaw[];
  return {
    tasks: raw.map(toArchiveRow),
    nextOffset: data.nextOffset ?? null,
    hasMore: Boolean(data.hasMore),
    total: Number(data.total ?? 0),
  };
}

export function ArchiveBoard({
  initialOneTime,
  initialRecurring,
  grandTotal,
}: Props) {
  const router = useRouter();
  const [oneTime, setOneTime] = useState<SectionState>({
    ...initialOneTime,
    loading: false,
  });
  const [recurring, setRecurring] = useState<SectionState>({
    ...initialRecurring,
    loading: false,
  });

  const loadMore = useCallback(
    async (section: "one_time" | "occurrence") => {
      const current = section === "one_time" ? oneTime : recurring;
      const setSection = section === "one_time" ? setOneTime : setRecurring;
      if (!current.hasMore || current.loading || current.nextOffset == null) return;

      setSection((s) => ({ ...s, loading: true }));
      try {
        const page = await fetchArchivePage(section, current.nextOffset!);
        setSection((s) => {
          const seen = new Set(s.tasks.map((t) => t.id));
          const merged = [
            ...s.tasks,
            ...page.tasks.filter((t) => !seen.has(t.id)),
          ];
          return {
            tasks: merged,
            nextOffset: page.nextOffset,
            hasMore: page.hasMore,
            total: page.total,
            loading: false,
          };
        });
      } catch {
        setSection((s) => ({ ...s, loading: false }));
      }
    },
    [oneTime, recurring],
  );

  function reopenIn(
    setSection: typeof setOneTime,
    id: string,
  ) {
    setSection((s) => ({
      ...s,
      tasks: s.tasks.filter((t) => t.id !== id),
      total: Math.max(0, s.total - 1),
      // Keep offset stable; next page may slightly overlap — de-duped on load
    }));
    router.refresh();
  }

  const shownTotal = oneTime.total + recurring.total;
  const empty =
    grandTotal === 0 &&
    oneTime.tasks.length === 0 &&
    recurring.tasks.length === 0;

  return (
    <div className="space-y-8">
      <p className="text-sm text-zinc-500">
        {empty
          ? "Nothing completed yet."
          : `${shownTotal} completed task${shownTotal === 1 ? "" : "s"} total · ${PAGE_SIZE} per page · click checkmark to reopen`}
      </p>

      {empty ? (
        <div className="rounded-xl border border-dashed border-white/10 px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">
            Finish tasks on Today or Upcoming and they&apos;ll show up here.
          </p>
        </div>
      ) : (
        <>
          <ArchiveSection
            title="One-time"
            state={oneTime}
            emptyMessage="No completed one-time tasks."
            onLoadMore={() => loadMore("one_time")}
            onReopen={(id) => reopenIn(setOneTime, id)}
          />
          <ArchiveSection
            title="Recurring (done occurrences)"
            state={recurring}
            emptyMessage="No completed recurring occurrences."
            onLoadMore={() => loadMore("occurrence")}
            onReopen={(id) => reopenIn(setRecurring, id)}
          />
        </>
      )}
    </div>
  );
}

function ArchiveSection({
  title,
  state,
  emptyMessage,
  onLoadMore,
  onReopen,
}: {
  title: string;
  state: SectionState;
  emptyMessage: string;
  onLoadMore: () => void;
  onReopen: (id: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="text-[11px] text-zinc-500">
          showing {state.tasks.length}
          {state.total > state.tasks.length ? ` of ${state.total}` : ""}
        </span>
      </div>

      <TaskList
        mode="archive"
        initialTasks={state.tasks}
        emptyMessage={emptyMessage}
        onArchiveReopen={onReopen}
      />

      {state.hasMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={state.loading}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-200 transition hover:border-white/20 hover:bg-zinc-900 disabled:opacity-50"
          >
            {state.loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                Load more (
                {Math.max(0, state.total - state.tasks.length)} remaining)
              </>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
