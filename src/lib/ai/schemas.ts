import { z } from "zod";

/** Capture v2: the model returns tasks, not a review queue. */
export const captureTaskSchema = z.object({
  title: z.string().min(1).max(300),
  notes: z.string().max(2000).nullable().optional(),
  dueAt: z.string().nullable().optional(),
  board: z.enum(["ICEBOX", "BACKLOG", "CURRENT"]),
  boardReason: z.string().max(80),
});

export const captureProposalsSchema = z.object({
  tasks: z.array(captureTaskSchema).max(25),
});

export type CaptureProposals = z.infer<typeof captureProposalsSchema>;
export type AiCaptureTask = z.infer<typeof captureTaskSchema>;

export const CAPTURE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      maxItems: 25,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "notes", "dueAt", "board", "boardReason"],
        properties: {
          title: {
            type: "string",
            description: "Short actionable title, 300 characters or fewer.",
          },
          notes: {
            type: ["string", "null"],
            description: "Extra context, or null.",
          },
          dueAt: {
            type: ["string", "null"],
            description:
              "ISO-8601 deadline in the user's timezone, or null when no date was said.",
          },
          board: {
            type: "string",
            enum: ["ICEBOX", "BACKLOG", "CURRENT"],
            description:
              "CURRENT = today/urgent/due within ~2 days. BACKLOG = this week/next week/soon/due within ~14 days. ICEBOX = vague, someday, or no signal. Default ICEBOX.",
          },
          boardReason: {
            type: "string",
            description: "At most 80 characters explaining the lane, e.g. said 'someday'.",
          },
        },
      },
    },
  },
} as const;
