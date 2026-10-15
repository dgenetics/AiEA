import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteSystemCascade } from "@/lib/delete-cascade";
import { mapSystem } from "@/lib/farm-mappers";
import { normalizeCategory } from "@/lib/farm-types";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const system = await prisma.system.findFirst({
    where: { id, workspaceId: auth.workspaceId },
    include: { components: true },
  });
  if (!system) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(mapSystem(system));
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = (await req.json()) as {
    name?: string;
    category?: string;
    notes?: string;
  };
  const existing = await prisma.system.findFirst({
    where: { id, workspaceId: auth.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const updated = await prisma.system.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.category !== undefined ? { category: normalizeCategory(body.category) } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
    include: { components: true },
  });
  return NextResponse.json(mapSystem(updated));
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const existing = await prisma.system.findFirst({
    where: { id, workspaceId: auth.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Same cascade as a component delete, across every component on this system.
  // Tasks are removed in that transaction before the system row, or SetNull would keep them.
  const deleted = await deleteSystemCascade(prisma, {
    workspaceId: auth.workspaceId,
    systemId: id,
  });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
