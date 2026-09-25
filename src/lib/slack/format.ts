import { shortId } from "@/lib/slack/commands";
import type { DueTodayTask } from "@/lib/slack/due-today";

/** One person's due-today block (privacy: never mix users in one list). */
export function formatDueTodayForUser(args: {
  slackUserId: string;
  tasks: ReadonlyArray<DueTodayTask>;
  ymd: string;
}): string {
  const mention = `<@${args.slackUserId}>`;
  if (args.tasks.length === 0) {
    return `${mention} — *Due today* (${args.ymd})\nNothing due.`;
  }
  const lines = args.tasks.map((t) => `• \`${shortId(t.id)}\` ${t.title}`);
  return [
    `${mention} — *Due today* (${args.ymd}) — ${args.tasks.length} open`,
    ...lines,
    "",
    "_Reply in this thread:_ `done <id>` · `snooze <id>` · `snooze <id> 3d`",
    "_(Only your own AiEA tasks.)_",
  ].join("\n");
}
