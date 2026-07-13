import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAiConfig, pingAi } from "@/lib/ai";

/**
 * GET /api/ai/status?ping=1
 * Shows whether SpaceXAI is configured (never returns the raw key).
 * Optional ?ping=1 runs a live "pong" request (uses a few tokens).
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const shouldPing = searchParams.get("ping") === "1";

  const config = getAiConfig();

  if (!shouldPing) {
    return NextResponse.json({
      configured: config.configured,
      model: config.model,
      baseURL: config.baseURL,
      keyHint: config.keyHint,
      ready: config.configured,
      hint: config.configured
        ? "Key loaded. Use ?ping=1 to verify live connectivity."
        : "Add XAI_API_KEY to .env (from https://console.x.ai) and restart npm run dev.",
    });
  }

  const result = await pingAi();
  return NextResponse.json(result);
}
