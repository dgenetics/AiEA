import { NextResponse } from "next/server";
import { z } from "zod";
import { proposeFromCapture } from "@/lib/ai";
import { formatCorrectionsForPrompt, getRecentCorrections } from "@/lib/ai/corrections";
import { rawTextItem } from "@/lib/ai/heuristic";
import { laneWrite } from "@/lib/board";
import { parseDueDate } from "@/lib/calendar";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/require-workspace";
import type { BoardLane } from "@/lib/board";
import type { ProposedItem } from "@/lib/types";

const bodySchema = z.object({
  text: z.string().min(1).max(8000).optional(),
  action: z.enum(["parse", "raw", "undo"]).optional(),
  captureId: z.string().optional(),
});

function counts(items: Array<{ board: BoardLane }>) {
  const lanes = { CURRENT: 0, BACKLOG: 0, ICEBOX: 0 };
  for (const item of items) lanes[item.board] += 1;
  return lanes;
}

export async function POST(req: Request) {
  try {
    const auth = await requireWorkspace();
    if ("error" in auth && auth.error) return auth.error;
    const { user, workspaceId } = auth;

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Request body must be JSON" },
        { status: 400 },
      );
    }
    const body = bodySchema.parse(json);
    const action = body.action ?? "parse";

    if (action === "undo") {
      if (!body.captureId) {
        return NextResponse.json(
          { ok: false, error: "captureId is required" },
          { status: 400 },
        );
      }
      const capture = await prisma.captureBatch.findFirst({
        where: { id: body.captureId, workspaceId },
      });
      if (!capture) {
        return NextResponse.json({ ok: false, error: "Capture not found" }, { status: 404 });
      }
      const undone = await prisma.$transaction(async (tx) => {
        const cancelled = await tx.task.updateMany({
          where: {
            sourceCaptureId: capture.id,
            workspaceId,
            status: { in: ["ACTIVE", "INBOX", "SNOOZED"] },
          },
          data: { status: "CANCELLED" },
        });
        await tx.captureBatch.update({
          where: { id: capture.id },
          data: { status: "UNDONE" },
        });
        return cancelled.count;
      });
      return NextResponse.json({ ok: true, undone });
    }

    const text = body.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ ok: false, error: "Text is required" }, { status: 400 });
    }

    let items: ProposedItem[] = [];
    let source: "ai" | "heuristic" | "raw" = "heuristic";
    let model: string | null = null;
    let fallbackReason: string | null = null;
    let rawFallback = action === "raw";

    if (action === "raw") {
      items = [rawTextItem(text)];
      source = "raw";
    } else {
      const training = formatCorrectionsForPrompt(
        await getRecentCorrections(workspaceId, 40),
      );
      const result = await proposeFromCapture(text, {
        userName: user.name,
        workspaceId,
        trainingBlock: training || undefined,
      });
      items = result.items;
      source = result.source;
      model = result.model ?? null;
      fallbackReason = result.fallbackReason ?? null;
      if (items.length === 0) {
        items = [rawTextItem(text)];
        rawFallback = true;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      const capture = await tx.captureBatch.create({
        data: {
          workspaceId,
          userId: user.id,
          rawText: text,
          status: "ACCEPTED",
          proposals: JSON.stringify(items),
        },
      });
      const tasks = [];
      for (const item of items) {
        const dueAt = parseDueDate(item.dueAt);
        const task = await tx.task.create({
          data: {
            workspaceId,
            title: item.title.slice(0, 300),
            notes: item.notes ?? null,
            kind: "ONE_TIME",
            status: "ACTIVE",
            ...laneWrite(item.board),
            boardReason: item.boardReason?.slice(0, 80) ?? null,
            dueAt,
            aiRationale: item.aiRationale ?? item.boardReason ?? null,
            sourceCaptureId: capture.id,
          },
        });
        tasks.push({
          id: task.id,
          title: task.title,
          board: item.board,
          boardReason: task.boardReason,
          dueAt: task.dueAt?.toISOString() ?? null,
        });
      }
      return { captureId: capture.id, tasks };
    });

    const laneCounts = counts(items);
    return NextResponse.json({
      ok: true,
      captureId: created.captureId,
      tasks: created.tasks,
      counts: laneCounts,
      total: created.tasks.length,
      rawFallback,
      source,
      model,
      fallbackReason,
    });
  } catch (err) {
    console.error("POST /api/capture failed:", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid request", details: err.flatten() },
        { status: 400 },
      );
    }
    const message = err instanceof Error && err.message ? err.message : "Capture request failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
