import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { componentCreateData, mapComponent } from "@/lib/farm-mappers";
import type { SystemComponentInput } from "@/lib/farm-types";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id: systemId } = await ctx.params;
  const body = (await req.json()) as SystemComponentInput;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const system = await prisma.system.findFirst({
    where: { id: systemId, workspaceId: auth.workspaceId },
    include: { components: true },
  });
  if (!system) return NextResponse.json({ error: "System not found" }, { status: 404 });
  const maxOrder = system.components.reduce((m, c) => Math.max(m, c.sortOrder), -1);
  const created = await prisma.component.create({
    data: {
      workspaceId: auth.workspaceId,
      systemId,
      ...componentCreateData(body, maxOrder + 1),
    },
  });
  await prisma.system.update({ where: { id: systemId }, data: { updatedAt: new Date() } });
  return NextResponse.json(mapComponent(created), { status: 201 });
}
