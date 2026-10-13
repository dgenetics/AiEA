import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { componentCreateData, mapSystem } from "@/lib/farm-mappers";
import { normalizeCategory } from "@/lib/farm-types";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const systems = await prisma.system.findMany({
    where: { workspaceId: auth.workspaceId },
    include: { components: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(systems.map(mapSystem));
}

export async function POST(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;
  const body = (await req.json()) as {
    name?: string;
    category?: string;
    notes?: string;
    components?: Array<Record<string, unknown>>;
  };
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const components = Array.isArray(body.components) ? body.components : [];
  const created = await prisma.system.create({
    data: {
      workspaceId: auth.workspaceId,
      name: body.name.trim(),
      category: normalizeCategory(body.category ?? ""),
      notes: body.notes ?? "",
      components: {
        create: components
          .filter((c) => String(c.name ?? "").trim())
          .map((c, i) => ({
            workspaceId: auth.workspaceId,
            ...componentCreateData(
              {
                name: String(c.name),
                location: c.location == null ? undefined : String(c.location),
                modelNumber: c.modelNumber as string | undefined,
                productNumber: c.productNumber as string | undefined,
                serialNumber: c.serialNumber as string | undefined,
                manufacturer: c.manufacturer as string | undefined,
                warrantyInfo: c.warrantyInfo as string | undefined,
                userManual: c.userManual as string | undefined,
                vendorName: c.vendorName as string | undefined,
                vendorContact: c.vendorContact as string | undefined,
                serviceCompanyName: c.serviceCompanyName as string | undefined,
                serviceCompanyContact: c.serviceCompanyContact as string | undefined,
                purchaseDate:
                  c.purchaseDate == null || c.purchaseDate === ""
                    ? null
                    : String(c.purchaseDate),
                purchaseCost: c.purchaseCost == null ? null : Number(c.purchaseCost),
                replacementCost:
                  c.replacementCost == null ? null : Number(c.replacementCost),
                notes: c.notes as string | undefined,
              },
              i,
            ),
          })),
      },
    },
    include: { components: true },
  });
  return NextResponse.json(mapSystem(created), { status: 201 });
}
