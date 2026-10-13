import type { ProposedItem } from "@/lib/types";
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
  buildCaptureSystemPrompt,
  buildCaptureUserPrompt,
  getPromptClock,
} from "@/lib/ai/prompts";
import { CAPTURE_JSON_SCHEMA, captureProposalsSchema } from "@/lib/ai/schemas";

export { getAiConfig, getXaiClient, DEFAULT_XAI_MODEL } from "@/lib/ai/client";
export { heuristicPropose } from "@/lib/ai/heuristic";

export type ProposeResult = {
  items: ProposedItem[];
  source: "ai" | "heuristic";
  model?: string;
  fallbackReason?: string;
};

async function structuredJson(opts: {
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
      schemaName: "capture_tasks",
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
      return {
        items: heuristicPropose(rawText, rawText),
        source: "heuristic",
        model,
        fallbackReason: "AI response failed schema validation",
      };
    }

    const items = normalizeProposals(validated.data.tasks, rawText);
    if (items.length === 0 && rawText.trim()) {
      return {
        items: [],
        source: "ai",
        model,
        fallbackReason: "AI returned no tasks",
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
