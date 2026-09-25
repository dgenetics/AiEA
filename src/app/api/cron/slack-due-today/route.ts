import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/auth";
import { isSlackEnabled } from "@/lib/slack/config";
import { postDueTodayNudges } from "@/lib/slack/notify";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET/POST /api/cron/slack-due-today
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret
 *
 * No-op (200 skipped) when SLACK_BOT_TOKEN is unset — safe for prod until configured.
 */
async function handle(req: Request) {
  const auth =
    req.headers.get("authorization") ||
    req.headers.get("x-cron-secret") ||
    null;
  const bearer = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7).trim()
    : auth;
  if (!verifyCronSecret(bearer)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isSlackEnabled()) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "SLACK_BOT_TOKEN unset — Slack due-today is off",
    });
  }

  const result = await postDueTodayNudges();
  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }
  return NextResponse.json({ ranAt: new Date().toISOString(), ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
