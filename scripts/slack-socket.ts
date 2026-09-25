/**
 * Local Socket Mode worker for Slack message events.
 * Requires SLACK_BOT_TOKEN + SLACK_APP_TOKEN (+ SLACK_USER_MAP, DB).
 *
 *   npm run slack:socket
 *
 * Hosted: prefer Events API → POST /api/slack/events (no long-lived socket on Vercel).
 */
import { createSlackApi } from "../src/lib/slack/client";
import { isSlackEnabled, loadSlackConfig } from "../src/lib/slack/config";
import { handleSlackReply } from "../src/lib/slack/handle-reply";

async function main() {
  if (!isSlackEnabled()) {
    console.error("SLACK_BOT_TOKEN unset — refusing to start");
    process.exit(1);
  }
  const cfg = loadSlackConfig()!;
  if (!cfg.appToken) {
    console.error("SLACK_APP_TOKEN unset — needed for Socket Mode");
    process.exit(1);
  }
  if (Object.keys(cfg.userMap).length === 0) {
    console.error("SLACK_USER_MAP empty — link Slack users to AiEA emails");
    process.exit(1);
  }

  // Minimal Socket Mode via apps.connections.open + WebSocket
  const { default: WebSocket } = await import("ws");
  const api = createSlackApi(cfg.botToken);

  async function openConnection(): Promise<string> {
    const res = await fetch("https://slack.com/api/apps.connections.open", {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.appToken}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "",
    });
    const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
    if (!data.ok || !data.url) {
      throw new Error(`apps.connections.open failed: ${data.error ?? "unknown"}`);
    }
    return data.url;
  }

  const url = await openConnection();
  console.log("[slack-socket] connected (Socket Mode). Listening for thread replies…");
  const ws = new WebSocket(url);

  ws.on("message", async (raw) => {
    let msg: {
      envelope_id?: string;
      type?: string;
      payload?: {
        event?: {
          type?: string;
          subtype?: string;
          bot_id?: string;
          user?: string;
          text?: string;
          channel?: string;
          thread_ts?: string;
        };
      };
    };
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.envelope_id) {
      ws.send(JSON.stringify({ envelope_id: msg.envelope_id }));
    }
    const ev = msg.payload?.event;
    if (
      ev?.type === "message" &&
      !ev.bot_id &&
      !ev.subtype &&
      ev.user &&
      ev.text &&
      ev.channel &&
      ev.thread_ts
    ) {
      const r = await handleSlackReply({
        text: ev.text,
        slackUserId: ev.user,
        channel: ev.channel,
        threadTs: ev.thread_ts,
        cfg,
        api,
      });
      if (r.handled) {
        console.log("[slack-socket]", r.ok ? "ok" : "err", r.reply);
      }
    }
  });

  ws.on("close", () => {
    console.warn("[slack-socket] closed — exiting");
    process.exit(0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
