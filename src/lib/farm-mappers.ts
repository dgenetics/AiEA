import type { Component, System } from "@/generated/prisma/client";
import type { Asset, SystemComponent, SystemComponentInput } from "@/lib/farm-types";

type SystemWithComponents = System & { components: Component[] };

export function mapComponent(c: Component): SystemComponent {
  return {
    id: c.id,
    name: c.name,
    location: c.location,
    modelNumber: c.modelNumber,
    productNumber: c.productNumber,
    serialNumber: c.serialNumber,
    manufacturer: c.manufacturer,
    warrantyInfo: c.warrantyInfo,
    userManual: c.userManual,
    vendorName: c.vendorName,
    vendorContact: c.vendorContact,
    serviceCompanyName: c.serviceCompanyName,
    serviceCompanyContact: c.serviceCompanyContact,
    purchaseDate: c.purchaseDate ? c.purchaseDate.toISOString() : null,
    purchaseCost: c.purchaseCost,
    replacementCost: c.replacementCost,
    notes: c.notes,
  };
}

export function mapSystem(s: SystemWithComponents): Asset {
  const components = [...s.components]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map(mapComponent);
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    notes: s.notes,
    components,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export function componentCreateData(
  input: Partial<SystemComponentInput> & { name: string },
  sortOrder = 0,
) {
  return {
    name: input.name.trim(),
    location: input.location ?? "",
    modelNumber: input.modelNumber ?? "",
    productNumber: input.productNumber ?? "",
    serialNumber: input.serialNumber ?? "",
    manufacturer: input.manufacturer ?? "",
    warrantyInfo: input.warrantyInfo ?? "",
    userManual: input.userManual ?? "",
    vendorName: input.vendorName ?? "",
    vendorContact: input.vendorContact ?? "",
    serviceCompanyName: input.serviceCompanyName ?? "",
    serviceCompanyContact: input.serviceCompanyContact ?? "",
    purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
    purchaseCost: input.purchaseCost ?? null,
    replacementCost: input.replacementCost ?? null,
    notes: input.notes ?? "",
    sortOrder,
  };
}
