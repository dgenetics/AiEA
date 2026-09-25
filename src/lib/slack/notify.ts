import { prisma } from "@/lib/db";
import { localYmd } from "@/lib/calendar";
import { BOARD_STATUSES } from "@/lib/board";
import {
  linkedUsers,
  loadSlackConfig,
  type SlackConfig,
} from "@/lib/slack/config";
import { selectDueToday } from "@/lib/slack/due-today";
import { formatDueTodayForUser } from "@/lib/slack/format";
import { createSlackApi, type SlackApi } from "@/lib/slack/client";

export type NotifyPost = {
  slackUserId: string;
  aieaEmail: string;
  channel: string;
  ts?: string;
  taskCount: number;
};

export type NotifyResult =
  | {
      ok: true;
      skipped?: boolean;
      reason?: string;
      posted: number;
      posts: NotifyPost[];
    }
  | { ok: false; error: string; posts?: NotifyPost[] };

/**
 * Post due-today nudges — one Slack message per mapped user (privacy).
 * Channel mode: separate messages in SLACK_AIEA_CHANNEL, each <@U…>-tagged.
 * No channel: DM each mapped Slack user their own list.
 */
export async function postDueTodayNudges(opts?: {
  cfg?: SlackConfig | null;
  api?: SlackApi;
  now?: Date;
}): Promise<NotifyResult> {
  const cfg = opts?.cfg !== undefined ? opts.cfg : loadSlackConfig();
  if (!cfg) {
    return {
      ok: true,
      skipped: true,
      reason: "SLACK_BOT_TOKEN unset — no-op",
      posted: 0,
      posts: [],
    };
  }

  const users = linkedUsers(cfg);
  if (users.length === 0) {
    return {
      ok: false,
      error:
        "Set SLACK_USER_MAP JSON {\"U…\":\"email@…\"} (or SLACK_AIEA_USER_EMAIL + SLACK_NOTIFY_USER_ID for a single user)",
      posts: [],
    };
  }

  const api = opts?.api ?? createSlackApi(cfg.botToken);
  const now = opts?.now ?? new Date();
  const ymd = localYmd(now);
  const posts: NotifyPost[] = [];
  const errors: string[] = [];

  for (const link of users) {
    const user = await prisma.user.findUnique({
      where: { email: link.aieaEmail },
    });
    if (!user) {
      errors.push(`No AiEA user for ${link.aieaEmail}`);
      continue;
    }
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    if (!membership) {
      errors.push(`${link.aieaEmail} has no workspace`);
      continue;
    }

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: membership.workspaceId,
        kind: "ONE_TIME",
        status: { in: [...BOARD_STATUSES] },
        dueAt: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        status: true,
        kind: true,
        parentId: true,
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
    });
    const due = selectDueToday(tasks, now);
    const text = formatDueTodayForUser({
      slackUserId: link.slackUserId,
      tasks: due,
      ymd,
    });

    let channel = cfg.channel;
    if (!channel) {
      if (!api.openDm) {
        errors.push(`No channel and openDm unavailable for ${link.slackUserId}`);
        continue;
      }
      const opened = await api.openDm(link.slackUserId);
      if (!opened.ok || !opened.channel) {
        errors.push(
          `DM open failed for ${link.slackUserId}: ${opened.error ?? "unknown"}`,
        );
        continue;
      }
      channel = opened.channel;
    }

    const posted = await api.postMessage({ channel, text });
    if (!posted.ok) {
      errors.push(
        `postMessage failed for ${link.aieaEmail}: ${posted.error ?? "unknown"}`,
      );
      continue;
    }
    posts.push({
      slackUserId: link.slackUserId,
      aieaEmail: link.aieaEmail,
      channel: posted.channel ?? channel,
      ts: posted.ts,
      taskCount: due.length,
    });
  }

  if (posts.length === 0 && errors.length > 0) {
    return { ok: false, error: errors.join("; "), posts };
  }
  return {
    ok: true,
    posted: posts.length,
    posts,
    ...(errors.length ? { reason: `partial: ${errors.join("; ")}` } : {}),
  };
}
