import { calendarDayDiff, formatCalendarDate } from "@/lib/calendar";

export type BubbleDue = {
  kind: "task" | "schedule";
  due: string | null;
};

export function componentBubbleLine(
  modelNumber: string | null | undefined,
  location: string | null | undefined,
): string {
  return [modelNumber, location]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

export function componentMatchesFilter(
  component: {
    name?: string | null;
    location?: string | null;
    modelNumber?: string | null;
    vendorName?: string | null;
  },
  query: string,
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    component.name,
    component.location,
    component.modelNumber,
    component.vendorName,
  ]
    .map((part) => (part ?? "").toLowerCase())
    .join("\n");
  return haystack.includes(needle);
}

function shortDate(due: string): string {
  return formatCalendarDate(due, { month: "short", day: "numeric" });
}

/** One badge: the earliest overdue item, else the earliest due within 14 days. */
export function componentBubbleBadge(
  items: BubbleDue[],
  now = new Date(),
): { text: string; tone: "overdue" | "soon" } | null {
  const dated = items.flatMap((item) => {
    if (!item.due) return [];
    const days = calendarDayDiff(item.due, now);
    if (Number.isNaN(days)) return [];
    return [{ ...item, days, due: item.due }];
  });
  const overdue = dated.filter((item) => item.days < 0).sort((a, b) => a.days - b.days);
  const firstOverdue = overdue[0];
  if (firstOverdue) {
    if (firstOverdue.kind === "task") return { text: "Task overdue", tone: "overdue" };
    return { text: `Overdue ${shortDate(firstOverdue.due)}`, tone: "overdue" };
  }
  const soon = dated
    .filter((item) => item.days >= 0 && item.days <= 14)
    .sort((a, b) => a.days - b.days);
  const firstSoon = soon[0];
  if (!firstSoon) return null;
  return { text: `Due ${shortDate(firstSoon.due)}`, tone: "soon" };
}
