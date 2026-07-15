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

export async function fetchBfMaintenanceSuggestions(): Promise<BfSuggestionsResponse> {
  const base = bfBaseUrl();
  const secret = bfSecret();

  const res = await fetch(`${base}/api/integrations/suggestions`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) detail = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(`BF Maintenance error (${res.status}): ${detail}`);
  }

  const json: unknown = await res.json();
  return bfSuggestionsResponseSchema.parse(json);
}
