import { NextResponse } from "next/server";
import { getCurrentUser, getPrimaryWorkspaceId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureWorkLifeAreas } from "@/lib/workspace";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = await getPrimaryWorkspaceId(user.id);
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 400 });

  await ensureWorkLifeAreas(workspaceId);

  const areas = await prisma.area.findMany({
    where: { workspaceId, slug: { in: ["work", "life"] } },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          tasks: {
            where: {
              status: { in: ["ACTIVE", "INBOX"] },
              kind: { not: "RECURRING_TEMPLATE" },
            },
          },
        },
      },
    },
  });

  return NextResponse.json({ areas });
}
