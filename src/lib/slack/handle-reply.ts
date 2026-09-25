import { prisma } from "@/lib/db";
import { BOARD_STATUSES } from "@/lib/board";
import { localYmd } from "@/lib/calendar";
import {
  aieaEmailForSlackUser,
  loadSlackConfig,
  type SlackConfig,
} from "@/lib/slack/config";
import {
  parseSlackCommand,
  resolveTaskId,
  shortId,
} from "@/lib/slack/commands";
import {
  completeTaskForWorkspace,
  snoozeTaskForWorkspace,
} from "@/lib/slack/actions";
import type { SlackApi } from "@/lib/slack/client";

export type HandleReplyResult =
  | { handled: false; reason: string }
  | { handled: true; reply: string; ok: boolean };

/**
 * Thread reply `done` / `snooze` — mutates only the AiEA workspace linked to
 * this Slack user via SLACK_USER_MAP (never another teammate's tasks).
 */
export async function handleSlackReply(opts: {
  text: string;
  slackUserId: string;
  channel: string;
  threadTs?: string | null;
  cfg?: SlackConfig | null;
  api?: SlackApi;
}): Promise<HandleReplyResult> {
  const cfg = opts.cfg !== undefined ? opts.cfg : loadSlackConfig();
  if (!cfg) return { handled: false, reason: "slack disabled" };

  const cmd = parseSlackCommand(opts.text);
  if (!cmd) return { handled: false, reason: "not a command" };

  const email = aieaEmailForSlackUser(cfg, opts.slackUserId);
  if (!email) {
    return {
      handled: true,
      ok: false,
      reply:
        "Your Slack account is not linked to AiEA. Ask an admin to add you to `SLACK_USER_MAP`.",
    };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return {
      handled: true,
      ok: false,
      reply: `No AiEA user for ${email}`,
    };
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    return { handled: true, ok: false, reply: "AiEA user has no workspace" };
  }

  const candidates = await prisma.task.findMany({
    where: {
      workspaceId: membership.workspaceId,
      kind: "ONE_TIME",
      status: { in: [...BOARD_STATUSES, "DONE"] },
    },
    select: { id: true },
  });
  const taskId = resolveTaskId(candidates, cmd.shortId);
  if (!taskId) {
    return {
      handled: true,
      ok: false,
      reply: `No task matching \`${cmd.shortId}\` in *your* AiEA workspace.`,
    };
  }

  if (cmd.action === "done") {
    const r = await completeTaskForWorkspace(membership.workspaceId, taskId);
    if (!r.ok) return { handled: true, ok: false, reply: r.error };
    const reply = r.already
      ? `Already done: *${r.task.title}* (\`${shortId(r.task.id)}\`)`
      : `Done: *${r.task.title}* (\`${shortId(r.task.id)}\`)${r.bfSyncError ? ` — ${r.bfSyncError}` : ""}`;
    if (opts.api && opts.threadTs) {
      await opts.api.postMessage({
        channel: opts.channel,
        text: reply,
        thread_ts: opts.threadTs,
      });
    }
    return { handled: true, ok: true, reply };
  }

  const r = await snoozeTaskForWorkspace(
    membership.workspaceId,
    taskId,
    cmd.days,
  );
  if (!r.ok) return { handled: true, ok: false, reply: r.error };
  const due = r.task.dueAt ? localYmd(r.task.dueAt) : "?";
  const reply = `Snoozed ${cmd.days}d: *${r.task.title}* (\`${shortId(r.task.id)}\`) → due ${due}`;
  if (opts.api && opts.threadTs) {
    await opts.api.postMessage({
      channel: opts.channel,
      text: reply,
      thread_ts: opts.threadTs,
    });
  }
  return { handled: true, ok: true, reply };
}
