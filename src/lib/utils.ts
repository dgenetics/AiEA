import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeDue(date: Date | string | null | undefined): string {
  if (!date) return "No date";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "No date";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayDiff = Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (dayDiff < 0) return dayDiff === -1 ? "Yesterday" : `${Math.abs(dayDiff)}d overdue`;
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Tomorrow";
  if (dayDiff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function priorityLabel(priority: number | null | undefined): string {
  switch (priority) {
    case 1:
      return "P1 · Critical";
    case 2:
      return "P2 · High";
    case 3:
      return "P3 · Medium";
    case 4:
      return "P4 · Low";
    case 5:
      return "P5 · Someday";
    default:
      return "Unprioritized";
  }
}

export function priorityColor(priority: number | null | undefined): string {
  switch (priority) {
    case 1:
      return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    case 2:
      return "text-orange-400 bg-orange-500/10 border-orange-500/30";
    case 3:
      return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case 4:
      return "text-sky-400 bg-sky-500/10 border-sky-500/30";
    case 5:
      return "text-zinc-400 bg-zinc-500/10 border-zinc-500/30";
    default:
      return "text-zinc-500 bg-zinc-500/10 border-zinc-500/20";
  }
}

export function areaColor(slug: string): string {
  switch (slug) {
    case "work":
      return "#6366f1";
    case "home":
      return "#14b8a6";
    case "life":
      return "#f59e0b";
    default:
      return "#8b5cf6";
  }
}
