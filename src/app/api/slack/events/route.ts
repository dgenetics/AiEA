import { NextResponse } from "next/server";
import { createSlackApi, verifySlackSignature } from "@/lib/slack/client";
import { isSlackEnabled, loadSlackConfig } from "@/lib/slack/config";
import { handleSlackReply } from "@/lib/slack/handle-reply";

export const runtime = "nodejs";

/**
 * POST /api/slack/events — Slack Events API (URL verification + message).
 * Prefer Socket Mode locally (`npm run slack:socket`); this route is for
 * hosted request URLs when Socket Mode is off.
 */
export async function POST(req: Request) {
  if (!isSlackEnabled()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const cfg = loadSlackConfig();
  if (!cfg?.signingSecret) {
    return NextResponse.json(
      { error: "SLACK_SIGNING_SECRET not configured" },
      { status: 503 },
    );
  }

  const rawBody = await req.text();
  const good = await verifySlackSignature({
    signingSecret: cfg.signingSecret,
    signature: req.headers.get("x-slack-signature"),
    timestamp: req.headers.get("x-slack-request-timestamp"),
    rawBody,
  });
  if (!good) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    type?: string;
    challenge?: string;
    event?: {
      type?: string;
      subtype?: string;
      bot_id?: string;
      user?: string;
      text?: string;
      channel?: string;
      thread_ts?: string;
      ts?: string;
      channel_type?: string;
    };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification" && payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const ev = payload.event;
  // Only thread replies (channel nudge threads or DM threads)
  if (
    ev?.type === "message" &&
    !ev.bot_id &&
    !ev.subtype &&
    ev.user &&
    ev.text &&
    ev.channel &&
    ev.thread_ts
  ) {
    const api = createSlackApi(cfg.botToken);
    // Fire-and-forget style but await so serverless finishes the work
    await handleSlackReply({
      text: ev.text,
      slackUserId: ev.user,
      channel: ev.channel,
      threadTs: ev.thread_ts,
      cfg,
      api,
    });
  }

  return NextResponse.json({ ok: true });
}
