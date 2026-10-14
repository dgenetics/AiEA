/** A piece of equipment that is part of a larger system. */
export interface SystemComponent {
  id: string;
  name: string;
  location: string;
  modelNumber: string;
  productNumber: string;
  serialNumber: string;
  manufacturer: string;
  warrantyInfo: string;
  userManual: string;
  vendorName: string;
  vendorContact: string;
  serviceCompanyName: string;
  serviceCompanyContact: string;
  purchaseDate: string | null;
  purchaseCost: number | null;
  replacementCost: number | null;
  notes: string;
}

export type SystemComponentInput = Omit<SystemComponent, "id">;

export type SystemComponentPatch = Partial<SystemComponentInput> & {
  systemId?: string;
};

export interface Asset {
  id: string;
  name: string;
  category: string;
  notes: string;
  components: SystemComponent[];
  createdAt: string;
  updatedAt: string;
}

export type AssetInput = Omit<Asset, "id" | "createdAt" | "updatedAt">;

export const ASSET_CATEGORIES = [
  "HVAC",
  "Culinary",
  "Laundry",
  "Water",
  "Electrical",
  "Plumbing",
  "Farm Equipment",
  "Vehicles",
  "Security",
  "Structures",
  "Other",
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

const LEGACY_CATEGORY_MAP: Record<string, AssetCategory> = {
  Appliance: "Culinary",
  Outdoor: "Farm Equipment",
};

export function isAssetCategory(s: string): s is AssetCategory {
  return (ASSET_CATEGORIES as readonly string[]).includes(s);
}

export function normalizeCategory(s: string): AssetCategory {
  const trimmed = (s ?? "").trim();
  if (!trimmed) return "Other";
  if (isAssetCategory(trimmed)) {
    return trimmed as AssetCategory;
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_CATEGORY_MAP, trimmed)) {
    return LEGACY_CATEGORY_MAP[trimmed]!;
  }
  return "Other";
}

export function systemReplacementTotal(asset: Asset): number {
  return asset.components.reduce((sum, c) => sum + (c.replacementCost ?? 0), 0);
}

export function systemPurchaseTotal(asset: Asset): number {
  return asset.components.reduce((sum, c) => sum + (c.purchaseCost ?? 0), 0);
}
