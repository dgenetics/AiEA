import type { AssetInput, SystemComponentInput } from "@/lib/farm-types";

export function formatMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function emptyComponentInput(): SystemComponentInput {
  return {
    name: "",
    location: "",
    modelNumber: "",
    productNumber: "",
    serialNumber: "",
    manufacturer: "",
    warrantyInfo: "",
    userManual: "",
    vendorName: "",
    vendorContact: "",
    serviceCompanyName: "",
    serviceCompanyContact: "",
    purchaseDate: null,
    purchaseCost: null,
    replacementCost: null,
    notes: "",
  };
}

export function emptyAssetInput(): AssetInput {
  return {
    name: "",
    category: "Other",
    notes: "",
    components: [],
  };
}
