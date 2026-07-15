import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { bfSuggestionSchema } from "@/lib/api/maintenance";
import { importBfSuggestions } from "@/lib/bf-import";

const importSchema = z.object({
  suggestions: z.array(bfSuggestionSchema).min(1).max(100),
  /** ACTIVE = on board (Today/Upcoming). PROPOSED is legacy (no dedicated inbox UI). */
  asStatus: z.enum(["PROPOSED", "ACTIVE", "INBOX"]).default("ACTIVE"),
});

/**
 * POST /api/integrations/bf-maintenance/import
 * Body: { suggestions: BfSuggestion[], asStatus?: "PROPOSED" | "ACTIVE" | "INBOX" }
 * Default ACTIVE so tasks are visible on Today / Upcoming / Areas.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  let body: z.infer<typeof importSchema>;
  try {
    body = importSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const result = await importBfSuggestions(
    workspaceId,
    body.suggestions,
    body.asStatus,
  );

  return NextResponse.json(result);
}
