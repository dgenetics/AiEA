import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteComponentCascade } from "@/lib/delete-cascade";
import { mapComponent } from "@/lib/farm-mappers";
import type { SystemComponentPatch } from "@/lib/farm-types";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; componentId: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id: systemId, componentId } = await ctx.params;
  const body = (await req.json()) as SystemComponentPatch;

  const existing = await prisma.component.findFirst({
    where: { id: componentId, systemId, workspaceId: auth.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const targetSystemId = body.systemId;
  if (targetSystemId !== undefined) {
    if (targetSystemId === systemId) {
      return NextResponse.json(
        { error: "Component is already in this system" },
        { status: 400 },
      );
    }
    const target = await prisma.system.findFirst({
      where: { id: targetSystemId, workspaceId: auth.workspaceId },
    });
    if (!target) {
      return NextResponse.json({ error: "Target system not found" }, { status: 404 });
    }
  }

  const updated = await prisma.component.update({
    where: { id: componentId },
    data: {
      ...(targetSystemId !== undefined ? { systemId: targetSystemId } : {}),
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.location !== undefined ? { location: body.location } : {}),
      ...(body.modelNumber !== undefined ? { modelNumber: body.modelNumber } : {}),
      ...(body.productNumber !== undefined ? { productNumber: body.productNumber } : {}),
      ...(body.serialNumber !== undefined ? { serialNumber: body.serialNumber } : {}),
      ...(body.manufacturer !== undefined ? { manufacturer: body.manufacturer } : {}),
      ...(body.warrantyInfo !== undefined ? { warrantyInfo: body.warrantyInfo } : {}),
      ...(body.userManual !== undefined ? { userManual: body.userManual } : {}),
      ...(body.vendorName !== undefined ? { vendorName: body.vendorName } : {}),
      ...(body.vendorContact !== undefined ? { vendorContact: body.vendorContact } : {}),
      ...(body.serviceCompanyName !== undefined
        ? { serviceCompanyName: body.serviceCompanyName }
        : {}),
      ...(body.serviceCompanyContact !== undefined
        ? { serviceCompanyContact: body.serviceCompanyContact }
        : {}),
      ...(body.purchaseDate !== undefined
        ? { purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null }
        : {}),
      ...(body.purchaseCost !== undefined ? { purchaseCost: body.purchaseCost } : {}),
      ...(body.replacementCost !== undefined
        ? { replacementCost: body.replacementCost }
        : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
    },
  });

  const now = new Date();
  await prisma.system.update({ where: { id: systemId }, data: { updatedAt: now } });
  if (targetSystemId !== undefined && targetSystemId !== systemId) {
    await prisma.system.update({ where: { id: targetSystemId }, data: { updatedAt: now } });
  }

  return NextResponse.json({ ...mapComponent(updated), systemId: updated.systemId });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id: systemId, componentId } = await ctx.params;
  const existing = await prisma.component.findFirst({
    where: { id: componentId, systemId, workspaceId: auth.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Tasks first, inside the transaction: component and schedule links are SetNull,
  // so deleting the component alone would orphan its tasks and its schedules' tasks.
  const deleted = await deleteComponentCascade(prisma, {
    workspaceId: auth.workspaceId,
    systemId,
    componentId,
  });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
