import { NextResponse } from "next/server";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { fetchBfMaintenanceSuggestions } from "@/lib/api/maintenance";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 400 });
  }

  try {
    const payload = await fetchBfMaintenanceSuggestions();

    // Mark already-imported suggestions
    const externalIds = payload.suggestions.map((s) => s.externalId);
    const existing =
      externalIds.length === 0
        ? []
        : await prisma.task.findMany({
            where: {
              workspaceId,
              externalSource: "bf-maintenance",
              externalId: { in: externalIds },
            },
            select: { externalId: true, id: true, status: true },
          });

    const existingMap = new Map(
      existing.map((t) => [t.externalId as string, t]),
    );

    const suggestions = payload.suggestions.map((s) => {
      const prior = existingMap.get(s.externalId);
      return {
        ...s,
        alreadyImported: Boolean(prior),
        existingTaskId: prior?.id ?? null,
        existingTaskStatus: prior?.status ?? null,
      };
    });

    return NextResponse.json({
      ...payload,
      suggestions,
      newCount: suggestions.filter((s) => !s.alreadyImported).length,
    });
  } catch (err) {
    console.error("BF Maintenance pull failed:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Pull failed",
      },
      { status: 502 },
    );
  }
}
