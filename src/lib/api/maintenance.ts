import { z } from "zod";

/**
 * Server-side client for BF Maintenance integration.
 * Never call from the browser with the integration secret.
 */

export const bfSuggestionSchema = z.object({
  externalId: z.string().min(1),
  source: z.literal("bf-maintenance"),
  title: z.string().min(1),
  description: z.string(),
  dueAt: z.string(),
  priority: z.number().int().min(1).max(5),
  status: z.string(),
  systemId: z.string(),
  systemName: z.string(),
  componentId: z.string(),
  componentName: z.string(),
  componentLocation: z.string(),
  scheduleId: z.string().nullable(),
  scheduleName: z.string().nullable(),
  /** Present when BF includes schedule recurrence context */
  frequency: z.string().nullable().optional(),
  intervalDays: z.number().int().nullable().optional(),
  isRecurring: z.boolean().optional().default(false),
  taskId: z.string(),
  reason: z.string(),
});

export type BfSuggestion = z.infer<typeof bfSuggestionSchema>;

export const bfSuggestionsResponseSchema = z.object({
  source: z.literal("bf-maintenance"),
  generatedAt: z.string(),
  materialized: z.number(),
  count: z.number(),
  suggestions: z.array(bfSuggestionSchema),
});

export type BfSuggestionsResponse = z.infer<typeof bfSuggestionsResponseSchema>;

function bfBaseUrl(): string {
  const url =
    process.env.BF_MAINTENANCE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BF_MAINTENANCE_URL?.trim();
  if (!url) {
    throw new Error(
      "BF_MAINTENANCE_URL is not set (e.g. https://bf-maintenance.vercel.app)",
    );
  }
  return url.replace(/\/$/, "");
}

function bfSecret(): string {
  const s = process.env.BF_INTEGRATION_SECRET?.trim();
  if (!s) {
    throw new Error("BF_INTEGRATION_SECRET is not set");
  }
  return s;
}

export function getBfMaintenanceConfig(): {
  configured: boolean;
  baseUrl: string | null;
  hasSecret: boolean;
} {
  const baseUrl =
    process.env.BF_MAINTENANCE_URL?.trim() ||
    process.env.NEXT_PUBLIC_BF_MAINTENANCE_URL?.trim() ||
    null;
  const hasSecret = Boolean(process.env.BF_INTEGRATION_SECRET?.trim());
  return {
    configured: Boolean(baseUrl && hasSecret),
    baseUrl: baseUrl ? baseUrl.replace(/\/$/, "") : null,
    hasSecret,
  };
}

/** Parse bf-task:<id> external ids. */
export function parseBfTaskExternalId(
  externalId: string | null | undefined,
): string | null {
  if (!externalId) return null;
  const m = /^bf-task:(.+)$/.exec(externalId.trim());
  return m?.[1] ?? null;
}

export async function fetchBfMaintenanceSuggestions(): Promise<BfSuggestionsResponse> {
  const base = bfBaseUrl();
  const secret = bfSecret();

  let res: Response;
  try {
    res = await fetch(`${base}/api/integrations/suggestions`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    throw new Error(
      `Cannot reach BF Maintenance at ${base}. Check BF_MAINTENANCE_URL and network. (${msg})`,
    );
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        `BF Maintenance rejected the integration secret (${res.status}). Verify BF_INTEGRATION_SECRET matches on both apps.`,
      );
    }
    if (res.status >= 500) {
      throw new Error(
        `BF Maintenance is unavailable (${res.status}): ${detail}`,
      );
    }
    throw new Error(`BF Maintenance error (${res.status}): ${detail}`);
  }

  const json: unknown = await res.json();
  return bfSuggestionsResponseSchema.parse(json);
}

/**
 * Notify BF that an imported maintenance task was completed in AiEA.
 * Best-effort — failures should not block the AiEA complete action.
 */
export async function completeBfMaintenanceTask(
  bfTaskId: string,
  completedNotes?: string | null,
): Promise<{ ok: boolean; alreadyComplete?: boolean; error?: string }> {
  const base = bfBaseUrl();
  const secret = bfSecret();

  let res: Response;
  try {
    res = await fetch(`${base}/api/integrations/tasks/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        taskId: bfTaskId,
        completedNotes: completedNotes ?? null,
      }),
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: `${res.status}: ${detail}` };
  }

  const body = (await res.json()) as { alreadyComplete?: boolean };
  return { ok: true, alreadyComplete: Boolean(body.alreadyComplete) };
}

/** Lightweight connectivity probe for settings UI. */
export async function probeBfMaintenance(): Promise<{
  ok: boolean;
  status?: number;
  count?: number;
  error?: string;
  baseUrl: string | null;
}> {
  const cfg = getBfMaintenanceConfig();
  if (!cfg.configured || !cfg.baseUrl) {
    return {
      ok: false,
      error: "BF_MAINTENANCE_URL or BF_INTEGRATION_SECRET is not set",
      baseUrl: cfg.baseUrl,
    };
  }
  try {
    const payload = await fetchBfMaintenanceSuggestions();
    return {
      ok: true,
      status: 200,
      count: payload.count,
      baseUrl: cfg.baseUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Probe failed",
      baseUrl: cfg.baseUrl,
    };
  }
}
