import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { autoPullWorkspace } from "@/lib/bf-import";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET/POST /api/cron/bf-maintenance-pull
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret header
 *
 * For each workspace with bfAutoPullEnabled, pulls BF suggestions and
 * imports new ones as PROPOSED (Inbox).
 */
async function handle(req: Request) {
  const auth =
    req.headers.get("authorization") ||
    req.headers.get("x-cron-secret") ||
    null;
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : auth;
  if (!verifyCronSecret(bearer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspaces = await prisma.workspace.findMany({
    where: { bfAutoPullEnabled: true },
    select: { id: true, name: true, slug: true },
  });

  const results: Array<{
    workspaceId: string;
    slug: string;
    ok: boolean;
    importedCount?: number;
    skippedCount?: number;
    fetched?: number;
    error?: string;
  }> = [];

  for (const ws of workspaces) {
    try {
      const r = await autoPullWorkspace(ws.id);
      results.push({
        workspaceId: ws.id,
        slug: ws.slug,
        ok: true,
        importedCount: r.importedCount,
        skippedCount: r.skippedCount,
        fetched: r.fetched,
      });
    } catch (err) {
      console.error(`BF auto-pull failed for ${ws.slug}:`, err);
      results.push({
        workspaceId: ws.id,
        slug: ws.slug,
        ok: false,
        error: err instanceof Error ? err.message : "Pull failed",
      });
    }
  }

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    workspaceCount: workspaces.length,
    results,
  });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
