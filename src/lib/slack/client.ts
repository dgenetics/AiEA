/**
 * Minimal Slack Web API client (fetch). Injectable for prove/mocks.
 */

export type SlackPostResult = {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
};

export type SlackApi = {
  postMessage: (args: {
    channel: string;
    text: string;
    thread_ts?: string;
  }) => Promise<SlackPostResult>;
  openDm?: (userId: string) => Promise<{ ok: boolean; channel?: string; error?: string }>;
};

export function createSlackApi(botToken: string): SlackApi {
  async function api<T extends Record<string, unknown>>(
    method: string,
    body: Record<string, unknown>,
  ): Promise<T & { ok: boolean; error?: string }> {
    const res = await fetch(`https://slack.com/api/${method}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${botToken}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
    });
    return (await res.json()) as T & { ok: boolean; error?: string };
  }

  return {
    async postMessage({ channel, text, thread_ts }) {
      const r = await api<{ channel?: string; ts?: string }>("chat.postMessage", {
        channel,
        text,
        thread_ts,
        unfurl_links: false,
        unfurl_media: false,
      });
      if (!r.ok) return { ok: false, error: r.error ?? "postMessage failed" };
      return { ok: true, channel: r.channel, ts: r.ts };
    },
    async openDm(userId) {
      const r = await api<{ channel?: { id?: string } }>("conversations.open", {
        users: userId,
      });
      if (!r.ok) return { ok: false, error: r.error ?? "conversations.open failed" };
      return { ok: true, channel: r.channel?.id };
    },
  };
}

/** Verify Slack signing secret (HTTP Events API). */
export async function verifySlackSignature(args: {
  signingSecret: string;
  signature: string | null;
  timestamp: string | null;
  rawBody: string;
  nowMs?: number;
}): Promise<boolean> {
  const { signingSecret, signature, timestamp, rawBody, nowMs = Date.now() } =
    args;
  if (!signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  // Reject replay older than 5 minutes
  if (Math.abs(nowMs / 1000 - ts) > 60 * 5) return false;

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const base = `v0:${timestamp}:${rawBody}`;
  const digest = createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${digest}`;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
