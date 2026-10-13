import { NextResponse } from "next/server";
import { materializeMissingScheduleTasks } from "@/lib/schedule-tasks";

export const runtime = "nodejs";

/**
 * Daily safety net: recurring schedules with no open Task get one.
 * Auth: Authorization: Bearer $CRON_SECRET
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const header = req.headers.get("authorization") || "";
  const token = header.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await materializeMissingScheduleTasks();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
