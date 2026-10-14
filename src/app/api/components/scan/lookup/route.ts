import { NextResponse } from "next/server";
import { getComponentScanConfig, lookupComponentManual } from "@/lib/component-scan-ai";
import { describeScheduleLookup, takeScanSlot } from "@/lib/component-scan";
import { requireWorkspace } from "@/lib/require-workspace";

export const runtime = "nodejs";
export const maxDuration = 300;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 300) : "";
}

/** Fills the manual link after the label read has already returned. */
export async function POST(req: Request) {
  const auth = await requireWorkspace();
  if ("error" in auth) return auth.error;

  const config = getComponentScanConfig();
  if (!config.configured) return NextResponse.json({ result: null });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ result: null });
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const manufacturer = text(record.manufacturer);
  const modelNumber = text(record.modelNumber);
  const productNumber = text(record.productNumber);
  const name = text(record.name);
  if (!manufacturer && !modelNumber && !productNumber) return NextResponse.json({ result: null });

  const slot = takeScanSlot(auth.workspaceId);
  if (!slot.ok) return NextResponse.json({ result: null });

  try {
    const raw = await lookupComponentManual({ manufacturer, modelNumber, productNumber, name }, config);
    const described = describeScheduleLookup(raw);
    const found = described.lookup?.schedules ?? [];
    if (found.length) {
      console.info(
        "schedule lookup: interval",
        found.map((item) => `${item.everyCount} ${item.everyUnit}`).join(", "),
      );
    } else if (described.scheduleNote === "manual did not include a maintenance interval") {
      console.warn("schedule lookup:", described.scheduleNote);
    } else if (described.scheduleNote) {
      console.error("schedule lookup:", described.scheduleNote);
    }
    return NextResponse.json({ result: described.lookup });
  } catch (error) {
    console.error("manual lookup failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ result: null });
  }
}
