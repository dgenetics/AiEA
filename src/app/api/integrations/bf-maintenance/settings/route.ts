import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import {
  getBfMaintenanceConfig,
  probeBfMaintenance,
} from "@/lib/api/maintenance";
import { prisma } from "@/lib/db";

/**
 * GET — connection status + auto-pull toggle state
 * PATCH — { bfAutoPullEnabled: boolean }
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      bfAutoPullEnabled: true,
      bfLastAutoPullAt: true,
    },
  });

  const cfg = getBfMaintenanceConfig();
  let probe: Awaited<ReturnType<typeof probeBfMaintenance>> | null = null;
  if (cfg.configured) {
    probe = await probeBfMaintenance();
  }

  return NextResponse.json({
    configured: cfg.configured,
    baseUrl: cfg.baseUrl,
    hasSecret: cfg.hasSecret,
    connected: Boolean(probe?.ok),
    openSuggestionCount: probe?.count ?? null,
    error: probe?.error ?? (!cfg.configured ? "Integration env not set" : null),
    bfAutoPullEnabled: workspace?.bfAutoPullEnabled ?? false,
    bfLastAutoPullAt: workspace?.bfLastAutoPullAt?.toISOString() ?? null,
  });
}

const patchSchema = z.object({
  bfAutoPullEnabled: z.boolean(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Invalid body" },
      { status: 400 },
    );
  }

  const updated = await prisma.workspace.update({
    where: { id: workspaceId },
    data: { bfAutoPullEnabled: body.bfAutoPullEnabled },
    select: {
      bfAutoPullEnabled: true,
      bfLastAutoPullAt: true,
    },
  });

  return NextResponse.json({
    bfAutoPullEnabled: updated.bfAutoPullEnabled,
    bfLastAutoPullAt: updated.bfLastAutoPullAt?.toISOString() ?? null,
  });
}
