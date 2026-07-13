import OpenAI from "openai";

/** Default chat model — see https://docs.x.ai/developers/models */
export const DEFAULT_XAI_MODEL = "grok-4.5";

export type AiConfig = {
  configured: boolean;
  model: string;
  baseURL: string;
  /** First/last 4 chars only — safe to log or show in UI */
  keyHint: string | null;
};

export function getAiConfig(): AiConfig {
  const key = process.env.XAI_API_KEY?.trim() || "";
  const model = process.env.XAI_MODEL?.trim() || DEFAULT_XAI_MODEL;
  const baseURL = process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1";

  let keyHint: string | null = null;
  if (key.length >= 12) {
    keyHint = `${key.slice(0, 4)}…${key.slice(-4)}`;
  } else if (key.length > 0) {
    keyHint = "(set, short)";
  }

  return {
    configured: key.length > 0,
    model,
    baseURL,
    keyHint,
  };
}

export function getXaiClient(): OpenAI | null {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) return null;

  return new OpenAI({
    apiKey: key,
    baseURL: process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1",
    timeout: 60_000,
    maxRetries: 1,
  });
}

/** Pull plain text from Responses API payloads across SDK shapes. */
export function responseText(resp: unknown): string {
  if (!resp || typeof resp !== "object") return "";
  const r = resp as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (typeof r.output_text === "string" && r.output_text.trim()) {
    return r.output_text;
  }

  if (Array.isArray(r.output)) {
    const parts: string[] = [];
    for (const item of r.output) {
      if (!item?.content) continue;
      for (const c of item.content) {
        if (c?.type === "output_text" && c.text) parts.push(c.text);
        else if (c?.text) parts.push(c.text);
      }
    }
    return parts.join("\n").trim();
  }

  return "";
}

export function isAiError(err: unknown): { message: string; status?: number } {
  if (err && typeof err === "object") {
    const e = err as {
      message?: string;
      status?: number;
      error?: { message?: string };
    };
    const message =
      e.error?.message || e.message || "SpaceXAI request failed";
    return { message, status: e.status };
  }
  return { message: err instanceof Error ? err.message : "Unknown AI error" };
}
