import { addDays } from "date-fns";
import type { DailyBrief, ProposedItem } from "@/lib/types";
import { formatCalendarDate } from "@/lib/calendar";
import {
  getAiConfig,
  getXaiClient,
  isAiError,
  responseText,
  DEFAULT_XAI_MODEL,
} from "@/lib/ai/client";
import { heuristicPropose } from "@/lib/ai/heuristic";
import { normalizeProposals } from "@/lib/ai/normalize";
import {
  buildBriefSystemPrompt,
  buildBriefUserPrompt,
  buildCaptureSystemPrompt,
  buildCaptureUserPrompt,
  getPromptClock,
} from "@/lib/ai/prompts";
import {
  BRIEF_JSON_SCHEMA,
  briefPolishSchema,
  CAPTURE_JSON_SCHEMA,
  captureProposalsSchema,
} from "@/lib/ai/schemas";

export { getAiConfig, getXaiClient, DEFAULT_XAI_MODEL } from "@/lib/ai/client";
export { heuristicPropose } from "@/lib/ai/heuristic";

export type ProposeResult = {
  items: ProposedItem[];
  source: "ai" | "heuristic";
  model?: string;
  /** Why AI was not used or fell back */
  fallbackReason?: string;
};

async function structuredJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  temperature?: number;
}): Promise<{ text: string; model: string }> {
  const client = getXaiClient();
  if (!client) throw new Error("XAI_API_KEY not configured");

  const model = process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL;

  const resp = await client.responses.create({
    model,
    input: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature ?? 0.2,
    // Structured outputs — guaranteed JSON shape when supported
    // https://docs.x.ai/developers/model-capabilities/text/structured-outputs
    text: {
      format: {
        type: "json_schema",
        name: opts.schemaName,
        schema: opts.schema,
        strict: true,
      },
    },
  } as Parameters<typeof client.responses.create>[0]);

  const text = responseText(resp);
  if (!text) throw new Error("Empty response from SpaceXAI");
  return { text, model };
}

function extractJsonLoose(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(raw);
  } catch {
    const oStart = raw.indexOf("{");
    const oEnd = raw.lastIndexOf("}");
    if (oStart >= 0 && oEnd > oStart) {
      try {
        return JSON.parse(raw.slice(oStart, oEnd + 1));
      } catch {
        /* fall through */
      }
    }
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start >= 0 && end > start) {
      try {
        return { items: JSON.parse(raw.slice(start, end + 1)) };
      } catch {
        return null;
      }
    }
    return null;
  }
}

export async function proposeFromCapture(
  rawText: string,
  opts?: {
    userName?: string;
    timezone?: string;
    workspaceId?: string;
    trainingBlock?: string;
  },
): Promise<ProposeResult> {
  const config = getAiConfig();
  if (!config.configured) {
    return {
      items: heuristicPropose(rawText, rawText),
      source: "heuristic",
      fallbackReason: "XAI_API_KEY is not set in .env",
    };
  }

  const clock = getPromptClock(opts?.timezone);
  if (opts?.userName) clock.userName = opts.userName;
  if (opts?.trainingBlock) clock.trainingBlock = opts.trainingBlock;

  try {
    const { text, model } = await structuredJson({
      system: buildCaptureSystemPrompt(clock),
      user: buildCaptureUserPrompt(rawText),
      schemaName: "capture_proposals",
      schema: CAPTURE_JSON_SCHEMA,
      temperature: 0.15,
    });

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = extractJsonLoose(text);
    }

    const validated = captureProposalsSchema.safeParse(parsed);
    if (!validated.success) {
      console.warn(
        "Capture schema validation failed:",
        validated.error.issues.slice(0, 5),
      );
      // One retry without structured output is overkill; fall back to heuristics
      return {
        items: heuristicPropose(rawText, rawText),
        source: "heuristic",
        model,
        fallbackReason: "AI response failed schema validation",
      };
    }

    const items = normalizeProposals(validated.data.items, rawText);
    if (items.length === 0 && rawText.trim()) {
      // Model returned empty — rare; use heuristic so user still gets something
      return {
        items: heuristicPropose(rawText, rawText),
        source: "heuristic",
        model,
        fallbackReason: "AI returned no items; used local parser",
      };
    }

    return { items, source: "ai", model };
  } catch (err) {
    const info = isAiError(err);
    console.error("SpaceXAI capture failed:", info.message);
    return {
      items: heuristicPropose(rawText, rawText),
      source: "heuristic",
      fallbackReason: `AI error: ${info.message}`,
    };
  }
}

export type BriefResult = DailyBrief & {
  source: "ai" | "heuristic" | "cached";
  model?: string;
  /** Why Grok was skipped (when source is cached/heuristic) */
  aiSkipReason?: string;
};

export async function generateDailyBrief(input: {
  userName: string;
  workspaceId: string;
  tasks: Array<{
    id: string;
    title: string;
    board?: string | null;
    priority: number | null;
    dueAt: Date | null;
    isFollowUp: boolean;
    kind: string;
    personName?: string | null;
    status: string;
  }>;
  timezone?: string;
}): Promise<BriefResult> {
  const { resolveBoard } = await import("@/lib/board");
  const { prisma } = await import("@/lib/db");
  const now = new Date();
  const overdue = input.tasks.filter(
    (t) =>
      t.dueAt &&
      t.dueAt < now &&
      t.status !== "DONE" &&
      t.kind !== "RECURRING_TEMPLATE",
  );
  const followUps = input.tasks.filter((t) => t.isFollowUp && t.status !== "DONE");
  const recurring = input.tasks.filter(
    (t) => t.kind === "OCCURRENCE" && t.status !== "DONE",
  );
  const prioritized = [...input.tasks]
    .filter((t) => t.status === "ACTIVE" || t.status === "INBOX")
    .sort((a, b) => {
      const laneRank = (t: (typeof input.tasks)[0]) => {
        const lane = resolveBoard({ board: t.board, priority: t.priority });
        return lane === "CURRENT" ? 0 : lane === "BACKLOG" ? 1 : 2;
      };
      const d = laneRank(a) - laneRank(b);
      if (d !== 0) return d;
      return (a.priority ?? 9) - (b.priority ?? 9);
    })
    .slice(0, 5);

  const brief: BriefResult = {
    generatedAt: now.toISOString(),
    greeting: `Good ${now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"}, ${input.userName.split(" ")[0]}.`,
    summary: buildSummary(
      prioritized.length,
      followUps.length,
      overdue.length,
      recurring.length,
    ),
    topPriorities: prioritized.map((t) => {
      const lane = resolveBoard({ board: t.board, priority: t.priority });
      return {
        id: t.id,
        title: t.title,
        reason:
          lane === "CURRENT"
            ? "On the Current board"
            : t.dueAt && t.dueAt <= addDays(now, 1)
              ? "Due soon"
              : "Worth attention today",
        priority: t.priority,
        board: lane,
      };
    }),
    followUps: followUps.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      personName: t.personName || "Someone",
      dueLabel: t.dueAt ? formatCalendarDate(t.dueAt) : "Soon",
    })),
    recurringDue: recurring.slice(0, 5).map((t) => ({ id: t.id, title: t.title })),
    overdue: overdue.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      dueLabel: t.dueAt ? formatCalendarDate(t.dueAt) : "Past due",
    })),
    tips: [
      "Knock out one Current-board item before checking email deeply.",
      followUps.length
        ? `You have ${followUps.length} people loop(s) open — batch responses in one focus block.`
        : "No open follow-ups. Protect that clarity.",
      overdue.length
        ? "Reschedule or finish overdue items so the board stays trustworthy."
        : "Nothing overdue. Keep the streak.",
    ],
    source: "heuristic",
  };

  if (!getAiConfig().configured) {
    brief.aiSkipReason = "XAI_API_KEY not set";
    return brief;
  }

  type BriefCache = {
    lastAiBriefAt: Date | null;
    lastAiBriefSummary: string | null;
    lastAiBriefTips: string | null;
    lastAiBriefModel: string | null;
  };

  let workspace: BriefCache | null = null;
  try {
    // Full row read (not select) so older hot-reloaded clients degrade more safely
    const row = await prisma.workspace.findUnique({
      where: { id: input.workspaceId },
    });
    if (row) {
      const r = row as typeof row & Partial<BriefCache>;
      workspace = {
        lastAiBriefAt: r.lastAiBriefAt ?? null,
        lastAiBriefSummary: r.lastAiBriefSummary ?? null,
        lastAiBriefTips: r.lastAiBriefTips ?? null,
        lastAiBriefModel: r.lastAiBriefModel ?? null,
      };
    }
  } catch (err) {
    console.error("Brief cache read failed (using local brief):", err);
    brief.aiSkipReason =
      "Could not read brief cache — local summary only. Restart npm run dev after prisma generate.";
    return brief;
  }

  // Call Grok only if a capture was accepted after the last AI brief (or never briefed yet).
  const lastBriefAt = workspace?.lastAiBriefAt ?? null;
  let newCapture: { id: string } | null = null;
  try {
    newCapture = await prisma.captureBatch.findFirst({
      where: {
        workspaceId: input.workspaceId,
        status: { in: ["ACCEPTED", "PARTIALLY_ACCEPTED"] },
        ...(lastBriefAt ? { updatedAt: { gt: lastBriefAt } } : {}),
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
  } catch (err) {
    console.error("Capture check failed:", err);
    brief.aiSkipReason = "Could not check captures — local summary only";
    return brief;
  }

  const shouldCallAi = Boolean(newCapture);

  if (!shouldCallAi) {
    if (workspace?.lastAiBriefSummary) {
      brief.summary = workspace.lastAiBriefSummary;
      if (workspace.lastAiBriefTips) {
        try {
          const tips = JSON.parse(workspace.lastAiBriefTips) as string[];
          if (Array.isArray(tips) && tips.length) brief.tips = tips.slice(0, 3);
        } catch {
          /* keep local tips */
        }
      }
      brief.source = "cached";
      brief.model = workspace.lastAiBriefModel ?? undefined;
      brief.aiSkipReason =
        "No new captures since last Grok brief — reusing cached polish (task lists still live)";
    } else {
      brief.aiSkipReason = lastBriefAt
        ? "No new captures since last brief; no cache — local summary only"
        : "No accepted captures yet — local summary only (Grok runs after you accept a capture)";
    }
    return brief;
  }

  const clock = getPromptClock(input.timezone);
  clock.userName = input.userName;

  try {
    const { text, model } = await structuredJson({
      system: buildBriefSystemPrompt(clock),
      user: buildBriefUserPrompt({
        name: input.userName,
        greeting: brief.greeting,
        topPriorities: brief.topPriorities,
        followUps: brief.followUps,
        overdue: brief.overdue,
        recurringDue: brief.recurringDue,
        counts: {
          priorities: prioritized.length,
          followUps: followUps.length,
          overdue: overdue.length,
          recurring: recurring.length,
        },
      }),
      schemaName: "daily_brief_polish",
      schema: BRIEF_JSON_SCHEMA,
      temperature: 0.35,
    });

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = extractJsonLoose(text);
    }

    const validated = briefPolishSchema.safeParse(parsed);
    if (validated.success) {
      brief.summary = validated.data.summary.trim();
      brief.tips = validated.data.tips.map((t) => t.trim()).filter(Boolean).slice(0, 3);
      brief.source = "ai";
      brief.model = model;

      try {
        await prisma.workspace.update({
          where: { id: input.workspaceId },
          data: {
            lastAiBriefAt: now,
            lastAiBriefSummary: brief.summary,
            lastAiBriefTips: JSON.stringify(brief.tips),
            lastAiBriefModel: model,
          },
        });
      } catch (cacheErr) {
        console.error("Failed to save brief cache:", cacheErr);
      }
    }
  } catch (err) {
    console.error("SpaceXAI brief polish failed:", isAiError(err).message);
    brief.aiSkipReason = `AI error: ${isAiError(err).message}`;
    if (workspace?.lastAiBriefSummary) {
      brief.summary = workspace.lastAiBriefSummary;
      try {
        const tips = JSON.parse(workspace.lastAiBriefTips || "[]") as string[];
        if (tips.length) brief.tips = tips.slice(0, 3);
      } catch {
        /* keep local */
      }
      brief.source = "cached";
      brief.model = workspace.lastAiBriefModel ?? undefined;
    }
  }

  return brief;
}

function buildSummary(p: number, f: number, o: number, r: number) {
  const parts = [
    `${p} focus item${p === 1 ? "" : "s"}`,
    `${f} follow-up${f === 1 ? "" : "s"}`,
  ];
  if (o) parts.push(`${o} overdue`);
  if (r) parts.push(`${r} recurring due`);
  return `Today: ${parts.join(" · ")}.`;
}

/** Lightweight connectivity check for /api/ai/status */
export async function pingAi(): Promise<{
  ok: boolean;
  configured: boolean;
  model: string;
  keyHint: string | null;
  latencyMs?: number;
  error?: string;
  sample?: string;
}> {
  const config = getAiConfig();
  if (!config.configured) {
    return {
      ok: false,
      configured: false,
      model: config.model,
      keyHint: null,
      error: "XAI_API_KEY is not set. Add it to .env and restart the dev server.",
    };
  }

  const client = getXaiClient();
  if (!client) {
    return {
      ok: false,
      configured: false,
      model: config.model,
      keyHint: config.keyHint,
      error: "Client init failed",
    };
  }

  const started = Date.now();
  try {
    const resp = await client.responses.create({
      model: config.model,
      input: "Reply with exactly: pong",
      temperature: 0,
    });
    const text = responseText(resp).trim();
    return {
      ok: true,
      configured: true,
      model: config.model,
      keyHint: config.keyHint,
      latencyMs: Date.now() - started,
      sample: text.slice(0, 80),
    };
  } catch (err) {
    return {
      ok: false,
      configured: true,
      model: config.model,
      keyHint: config.keyHint,
      latencyMs: Date.now() - started,
      error: isAiError(err).message,
    };
  }
}
