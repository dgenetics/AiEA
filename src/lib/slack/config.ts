/**
 * Slack spike config. Prod is a no-op unless SLACK_BOT_TOKEN is set.
 *
 * Multi-user from the start: SLACK_USER_MAP is the source of truth
 *   { "U0123SLACK": "will@farm.example", "U0456SLACK": "other@farm.example" }
 * done/snooze only mutate the AiEA workspace for the mapped Slack user.
 *
 * Env (never commit values):
 *   SLACK_BOT_TOKEN          xoxb-…
 *   SLACK_SIGNING_SECRET     Events API verification
 *   SLACK_APP_TOKEN          xapp-… Socket Mode (local worker)
 *   SLACK_AIEA_CHANNEL       #aiea or C… (preferred; per-user messages in channel)
 *   SLACK_USER_MAP           required JSON Slack user id → AiEA email
 *   SLACK_NOTIFY_USER_ID     unused when channel set; if channel unset and map has
 *                            one entry, may omit (each map key is DM'd instead)
 */

export type SlackUserLink = {
  slackUserId: string;
  aieaEmail: string;
};

export type SlackConfig = {
  botToken: string;
  signingSecret: string | null;
  appToken: string | null;
  channel: string | null;
  /** Slack user id → AiEA email (lowercase). */
  userMap: Record<string, string>;
};

export function isSlackEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(env.SLACK_BOT_TOKEN?.trim());
}

export function parseUserMap(
  raw: string | null | undefined,
): Record<string, string> {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [slackId, email] of Object.entries(parsed)) {
      if (typeof slackId === "string" && typeof email === "string" && email.includes("@")) {
        out[slackId.trim()] = email.trim().toLowerCase();
      }
    }
    return out;
  } catch {
    console.warn("[slack] SLACK_USER_MAP is not valid JSON — ignoring");
    return {};
  }
}

export function loadSlackConfig(
  env: NodeJS.ProcessEnv = process.env,
): SlackConfig | null {
  const botToken = env.SLACK_BOT_TOKEN?.trim() ?? "";
  if (!botToken) return null;

  // Back-compat: single-user spike via SLACK_AIEA_USER_EMAIL + SLACK_NOTIFY_USER_ID
  // folds into the map when SLACK_USER_MAP is empty.
  let userMap = parseUserMap(env.SLACK_USER_MAP);
  if (Object.keys(userMap).length === 0) {
    const email = env.SLACK_AIEA_USER_EMAIL?.trim()?.toLowerCase();
    const slackId = env.SLACK_NOTIFY_USER_ID?.trim();
    if (email && slackId) {
      userMap = { [slackId]: email };
    }
  }

  return {
    botToken,
    signingSecret: env.SLACK_SIGNING_SECRET?.trim() || null,
    appToken: env.SLACK_APP_TOKEN?.trim() || null,
    channel: env.SLACK_AIEA_CHANNEL?.trim() || null,
    userMap,
  };
}

export function linkedUsers(cfg: SlackConfig): SlackUserLink[] {
  return Object.entries(cfg.userMap).map(([slackUserId, aieaEmail]) => ({
    slackUserId,
    aieaEmail,
  }));
}

export function aieaEmailForSlackUser(
  cfg: SlackConfig,
  slackUserId: string,
): string | null {
  return cfg.userMap[slackUserId] ?? null;
}
