import { nanoid } from "nanoid";
import type { ProposedItem } from "@/lib/types";
import type { AiCaptureTask } from "@/lib/ai/schemas";
import { priorityFromBoard, type BoardLane } from "@/lib/board";
import { toStoredDueDate } from "@/lib/calendar";
import { laneForCaptureText } from "@/lib/ai/heuristic";

function cleanTitle(title: string): string {
  return title
    .replace(/^[-*•\d.)\s]+/, "")
    .replace(/[.]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function parseDate(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
  }
  try {
    return toStoredDueDate(value);
  } catch {
    return null;
  }
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return null;
  const now = new Date();
  return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

/** Map validated model tasks into items that will be created as ACTIVE. */
export function normalizeProposals(
  raw: AiCaptureTask[],
  _rawCapture?: string,
): ProposedItem[] {
  const out: ProposedItem[] = [];
  for (const p of raw) {
    const title = cleanTitle(p.title || "");
    if (!title) continue;
    const dueAt = parseDate(p.dueAt);
    const hinted = laneForCaptureText(`${title} ${p.boardReason ?? ""}`, daysUntil(dueAt));
    const board = (p.board || hinted.board) as BoardLane;
    const boardReason = (p.boardReason || hinted.boardReason).slice(0, 80);
    out.push({
      id: nanoid(10),
      title,
      notes: p.notes?.trim() || undefined,
      kind: "ONE_TIME",
      board,
      boardReason,
      priority: priorityFromBoard(board) as 1 | 2 | 3 | 4 | 5,
      dueAt,
      aiRationale: boardReason,
    });
  }
  return out;
}
