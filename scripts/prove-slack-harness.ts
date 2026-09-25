/**
 * Invoked by prove-slack.mjs with DATABASE_URL + SLACK_* already set.
 * Writes PROVE_JSON result.
 */
import fs from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/db";
import { postDueTodayNudges } from "../src/lib/slack/notify";
import { handleSlackReply } from "../src/lib/slack/handle-reply";
import { shortId } from "../src/lib/slack/commands";
import { localNoonToday, localNoonPlusDays } from "../src/lib/calendar";
import { loadSlackConfig } from "../src/lib/slack/config";
import type { SlackApi } from "../src/lib/slack/client";

const posts: Array<{
  channel: string;
  text: string;
  thread_ts?: string;
  ts: string;
}> = [];

const api: SlackApi = {
  async postMessage({ channel, text, thread_ts }) {
    const ts = String(Date.now() / 1000 + posts.length);
    posts.push({ channel, text, thread_ts, ts });
    return { ok: true, channel, ts };
  },
  async openDm(userId) {
    return { ok: true, channel: "D" + userId };
  },
};

async function seedUser(email: string, name: string, slug: string) {
  const passwordHash = await bcrypt.hash("prove-slack-password-1", 10);
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
  });
  const ws = await prisma.workspace.create({
    data: { name: name + " WS", slug },
  });
  await prisma.workspaceMember.create({
    data: { workspaceId: ws.id, userId: user.id, role: "OWNER" },
  });
  return { user, ws };
}

async function main() {
  const will = await seedUser("will-prove@example.test", "Will", "will-prove");
  const other = await seedUser("other-prove@example.test", "Other", "other-prove");
  const today = localNoonToday();
  const tomorrow = localNoonPlusDays(1);

  const willDue = await prisma.task.create({
    data: {
      workspaceId: will.ws.id,
      title: "Will milk tanks",
      status: "ACTIVE",
      kind: "ONE_TIME",
      board: "CURRENT",
      priority: 1,
      dueAt: today,
    },
  });
  await prisma.task.create({
    data: {
      workspaceId: will.ws.id,
      title: "Will tomorrow chore",
      status: "ACTIVE",
      kind: "ONE_TIME",
      board: "BACKLOG",
      priority: 3,
      dueAt: tomorrow,
    },
  });
  const otherDue = await prisma.task.create({
    data: {
      workspaceId: other.ws.id,
      title: "Other fence repair",
      status: "ACTIVE",
      kind: "ONE_TIME",
      board: "CURRENT",
      priority: 1,
      dueAt: today,
    },
  });

  const cfg = loadSlackConfig();
  const nudge = await postDueTodayNudges({ cfg, api, now: today });
  const nudgePosts = posts.map((p) => ({ ...p }));

  posts.length = 0;
  const doneWill = await handleSlackReply({
    text: "done " + shortId(willDue.id),
    slackUserId: "UWILL",
    channel: "#aiea",
    threadTs: "111.1",
    cfg,
    api,
  });

  const doneCross = await handleSlackReply({
    text: "done " + shortId(otherDue.id),
    slackUserId: "UWILL",
    channel: "#aiea",
    threadTs: "111.1",
    cfg,
    api,
  });

  const snoozeOther = await handleSlackReply({
    text: "snooze " + shortId(otherDue.id) + " 3d",
    slackUserId: "UOTHER",
    channel: "#aiea",
    threadTs: "222.2",
    cfg,
    api,
  });

  const doneAgain = await handleSlackReply({
    text: "done " + shortId(willDue.id),
    slackUserId: "UWILL",
    channel: "#aiea",
    threadTs: "111.1",
    cfg,
    api,
  });

  const unmapped = await handleSlackReply({
    text: "done " + shortId(willDue.id),
    slackUserId: "USTRANGER",
    channel: "#aiea",
    threadTs: "111.1",
    cfg,
    api,
  });

  const willDueAfter = await prisma.task.findUnique({ where: { id: willDue.id } });
  const otherDueAfter = await prisma.task.findUnique({ where: { id: otherDue.id } });
  const willLater = await prisma.task.findFirst({
    where: { workspaceId: will.ws.id, title: "Will tomorrow chore" },
  });

  const outPath = process.env.PROVE_JSON!;
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        nudge,
        posts: nudgePosts,
        doneWill,
        doneCross,
        snoozeOther,
        doneAgain,
        unmapped,
        willDueAfter: { status: willDueAfter!.status },
        otherDueAfter: {
          status: otherDueAfter!.status,
          dueAt: otherDueAfter!.dueAt,
        },
        willLaterAfter: { status: willLater!.status },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
