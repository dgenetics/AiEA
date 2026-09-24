import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

/**
 * Service-to-service auth for BF Maintenance → AiEA.
 * Header: Authorization: Bearer <BF_INTEGRATION_SECRET>
 * or X-BF-Integration-Key: <secret>
 */
export function requireIntegrationAuth(req: Request): NextResponse | null {
  const expected = process.env.BF_INTEGRATION_SECRET?.trim();
  if (!expected) {
    return NextResponse.json(
      { error: "BF_INTEGRATION_SECRET is not configured" },
      { status: 503 },
    );
  }

  const auth = req.headers.get("authorization")?.trim() ?? "";
  const headerKey = req.headers.get("x-bf-integration-key")?.trim() ?? "";
  let provided = headerKey;
  if (auth.toLowerCase().startsWith("bearer ")) {
    provided = auth.slice(7).trim();
  }

  if (!provided || !secretsEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function secretsEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
