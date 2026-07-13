import { prisma } from "@/lib/db";

export type CorrectionRow = {
  field: string;
  taskTitle: string;
  beforeValue: string | null;
  afterValue: string;
  note: string | null;
};

/** Recent user corrections used as few-shot training in capture prompts. */
export async function getRecentCorrections(
  workspaceId: string,
  limit = 40,
): Promise<CorrectionRow[]> {
  try {
    const rows = await prisma.aiCorrection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map((r) => ({
      field: r.field,
      taskTitle: r.taskTitle,
      beforeValue: r.beforeValue,
      afterValue: r.afterValue,
      note: r.note,
    }));
  } catch (err) {
    console.error("getRecentCorrections failed:", err);
    return [];
  }
}

export function formatCorrectionsForPrompt(rows: CorrectionRow[]): string {
  if (!rows.length) return "";

  const area = rows.filter((r) => r.field === "area").slice(0, 20);
  const priority = rows.filter((r) => r.field === "priority").slice(0, 10);
  const other = rows
    .filter((r) => r.field !== "area" && r.field !== "priority")
    .slice(0, 10);

  const lines: string[] = [
    "## User training corrections (MUST follow — these override default area guesses)",
    "The user has corrected past AI mistakes. Treat these as ground truth for similar tasks.",
    "",
  ];

  if (area.length) {
    lines.push("### Area corrections");
    for (const r of area) {
      lines.push(
        `- "${r.taskTitle}" → areaSlug **${r.afterValue}**` +
          (r.beforeValue ? ` (was wrongly ${r.beforeValue})` : "") +
          (r.note ? ` — ${r.note}` : ""),
      );
    }
    lines.push("");
  }

  if (priority.length) {
    lines.push("### Priority corrections");
    for (const r of priority) {
      lines.push(
        `- "${r.taskTitle}" → priority **${r.afterValue}**` +
          (r.beforeValue ? ` (was ${r.beforeValue})` : ""),
      );
    }
    lines.push("");
  }

  if (other.length) {
    lines.push("### Other corrections");
    for (const r of other) {
      lines.push(
        `- "${r.taskTitle}" ${r.field}: ${r.beforeValue ?? "?"} → **${r.afterValue}**`,
      );
    }
    lines.push("");
  }

  lines.push(
    "When a new task is similar in topic, person, or wording, apply the same area/priority pattern.",
  );

  return lines.join("\n");
}

export async function recordCorrections(
  workspaceId: string,
  items: Array<{
    field: string;
    taskTitle: string;
    beforeValue?: string | null;
    afterValue: string;
    note?: string | null;
  }>,
) {
  if (!items.length) return;

  // Prefer createMany; fall back to sequential create if client is stale
  try {
    await prisma.aiCorrection.createMany({
      data: items.map((i) => ({
        workspaceId,
        field: i.field,
        taskTitle: i.taskTitle.slice(0, 300),
        beforeValue: i.beforeValue ?? null,
        afterValue: i.afterValue,
        note: i.note ?? null,
      })),
    });
    return;
  } catch (err) {
    console.warn("createMany failed, trying individual creates:", err);
  }

  for (const i of items) {
    await prisma.aiCorrection.create({
      data: {
        workspaceId,
        field: i.field,
        taskTitle: i.taskTitle.slice(0, 300),
        beforeValue: i.beforeValue ?? null,
        afterValue: i.afterValue,
        note: i.note ?? null,
      },
    });
  }
}
