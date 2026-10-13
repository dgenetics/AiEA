import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mapComponent } from "@/lib/farm-mappers";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; componentId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const { id: systemId, componentId } = await ctx.params;
  const source = await prisma.component.findFirst({
    where: { id: componentId, systemId, workspaceId: auth.workspaceId },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.component.updateMany({
    where: { systemId, sortOrder: { gt: source.sortOrder } },
    data: { sortOrder: { increment: 1 } },
  });

  const created = await prisma.component.create({
    data: {
      workspaceId: auth.workspaceId,
      systemId,
      name: source.name,
      location: source.location,
      modelNumber: source.modelNumber,
      productNumber: source.productNumber,
      serialNumber: "",
      manufacturer: source.manufacturer,
      warrantyInfo: source.warrantyInfo,
      userManual: source.userManual,
      vendorName: source.vendorName,
      vendorContact: source.vendorContact,
      serviceCompanyName: source.serviceCompanyName,
      serviceCompanyContact: source.serviceCompanyContact,
      purchaseDate: source.purchaseDate,
      purchaseCost: source.purchaseCost,
      replacementCost: source.replacementCost,
      notes: source.notes,
      sortOrder: source.sortOrder + 1,
    },
  });
  await prisma.system.update({ where: { id: systemId }, data: { updatedAt: new Date() } });
  return NextResponse.json(mapComponent(created), { status: 201 });
}
